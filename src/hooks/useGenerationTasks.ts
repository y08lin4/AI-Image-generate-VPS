import { type Dispatch, type SetStateAction, useRef, useState } from 'react'
import { generateImagesDirect, generateImagesStream, uploadImageToPixhost } from '../lib/api'
import { addHistory, updateHistoryImageUrl } from '../lib/db'
import type { AppSettings, GenerationTask, GenerateResultItem } from '../types'
import type { GenerateTaskPayload } from '../lib/appTask'

type MessageType = 'ok' | 'error' | 'info'
type UploadResult = { index: number; remoteUrl: string; remoteThumbUrl?: string }

interface UseGenerationTasksOptions {
  showMessage: (text: string, type?: MessageType) => void
  getAccessPassword: () => string
  onOpenSettings: () => void
  onHistoryRefresh: () => Promise<void>
}

export function useGenerationTasks({
  showMessage,
  getAccessPassword,
  onOpenSettings,
  onHistoryRefresh,
}: UseGenerationTasksOptions) {
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const uploadCacheRef = useRef(new Map<string, Map<number, UploadResult>>())

  function patchTask(id: string, patch: Partial<GenerationTask>) {
    setTasks((prev) => prev.map((task) => task.id === id ? { ...task, ...patch } : task))
  }

  function updateTaskResult(taskId: string, result: GenerateResultItem) {
    setTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task
      const nextResults = [...task.results]
      nextResults[result.index] = { ...nextResults[result.index], ...result }
      return { ...task, results: nextResults.filter(Boolean) }
    }))
  }

  function patchTaskResult(taskId: string, index: number, patch: Partial<GenerateResultItem>) {
    setTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task
      const nextResults = [...task.results]
      const existing = nextResults.find((item) => item.index === index) || nextResults[index]
      if (!existing) return task
      const merged = { ...existing, ...patch, index }
      const slot = nextResults.findIndex((item) => item.index === index)
      if (slot >= 0) nextResults[slot] = merged
      else nextResults[index] = merged
      return { ...task, results: nextResults.filter(Boolean) }
    }))
  }

  function rememberUploadResult(taskId: string, uploaded: UploadResult) {
    const taskUploads = uploadCacheRef.current.get(taskId) || new Map<number, UploadResult>()
    taskUploads.set(uploaded.index, uploaded)
    uploadCacheRef.current.set(taskId, taskUploads)
  }

  function collectCachedUploads(taskId: string, target: Map<number, UploadResult>) {
    const cachedUploads = uploadCacheRef.current.get(taskId)
    if (!cachedUploads) return
    for (const [index, uploaded] of cachedUploads) {
      target.set(index, uploaded)
    }
  }

  function completeTask(taskId: string, responseResults: GenerateResultItem[], elapsedMs: number) {
    setTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task
      const localByIndex = new Map(task.results.map((item) => [item.index, item]))
      const merged = responseResults.map((item) => ({ ...item, ...localByIndex.get(item.index) }))
      return { ...task, status: 'completed', results: merged, elapsedMs }
    }))
  }

  async function uploadGeneratedResult(
    taskId: string,
    result: GenerateResultItem,
    accessPassword: string,
    notify = false,
  ): Promise<UploadResult | null> {
    if (!result.ok || !result.image) return null

    patchTaskResult(taskId, result.index, { uploading: true, uploadError: undefined })
    try {
      const uploaded = await uploadImageToPixhost(
        result.image,
        `ai-image-${taskId}-${result.index + 1}.png`,
        accessPassword,
      )
      const uploadResult = { index: result.index, ...uploaded }
      patchTaskResult(taskId, result.index, {
        uploading: false,
        remoteUrl: uploaded.remoteUrl,
        remoteThumbUrl: uploaded.remoteThumbUrl,
        uploadError: undefined,
      })
      rememberUploadResult(taskId, uploadResult)
      if (notify) showMessage('图床上传成功，URL 已可复制', 'ok')
      return uploadResult
    } catch (error) {
      const message = error instanceof Error ? error.message : '图床上传失败'
      patchTaskResult(taskId, result.index, {
        uploading: false,
        uploadError: message,
      })
      if (notify) showMessage(message, 'error')
      return null
    }
  }

  async function runGenerationTask(
    taskId: string,
    payload: GenerateTaskPayload,
    requestMode: AppSettings['requestMode'],
    accessPassword: string,
    autoUploadPixhost: boolean,
    startedAt: number,
  ) {
    try {
      let lastPingAt = 0
      const uploadPromises: Array<Promise<UploadResult | null>> = []
      const handleResult = (result: GenerateResultItem) => {
        updateTaskResult(taskId, result)
        if (autoUploadPixhost) {
          uploadPromises.push(uploadGeneratedResult(taskId, result, accessPassword))
        }
      }
      const response = requestMode === 'direct'
        ? await generateImagesDirect(payload, handleResult)
        : await generateImagesStream(payload, accessPassword, (event) => {
            if (event.event === 'result') handleResult(event.data)
            if (event.event === 'ping' && Date.now() - lastPingAt > 30_000) {
              lastPingAt = Date.now()
              showMessage('服务端代理连接保持中...', 'info')
            }
          })

      completeTask(taskId, response.results, response.elapsedMs)

      const uploadedByIndex = new Map<number, UploadResult>()
      collectCachedUploads(taskId, uploadedByIndex)
      if (uploadPromises.length) {
        const settled = await Promise.allSettled(uploadPromises)
        for (const item of settled) {
          if (item.status === 'fulfilled' && item.value) {
            uploadedByIndex.set(item.value.index, item.value)
          }
        }
      }
      collectCachedUploads(taskId, uploadedByIndex)

      const historyResults = response.results.map((item) => ({
        ...item,
        remoteUrl: uploadedByIndex.get(item.index)?.remoteUrl || item.remoteUrl,
        remoteThumbUrl: uploadedByIndex.get(item.index)?.remoteThumbUrl || item.remoteThumbUrl,
      }))
      const okResults = historyResults.filter((item) => item.ok && item.image)
      const okImages = okResults.map((item) => item.image!)
      const failedCount = response.results.length - okImages.length

      if (uploadedByIndex.size) {
        completeTask(taskId, historyResults, response.elapsedMs)
      }

      if (okImages.length) {
        await addHistory({
          id: taskId,
          createdAt: startedAt,
          mode: payload.mode,
          prompt: payload.prompt,
          ratio: payload.ratio,
          resolution: payload.resolution,
          size: response.size,
          model: response.model,
          images: okImages,
          imageResultIndexes: okResults.map((item) => item.index),
          remoteUrls: okResults.map((item) => item.remoteUrl || ''),
          remoteThumbUrls: okResults.map((item) => item.remoteThumbUrl || ''),
          failedCount,
          elapsedMs: response.elapsedMs,
        })
        await onHistoryRefresh()
      }

      showMessage(
        failedCount ? `任务完成 ${okImages.length} 张，失败 ${failedCount} 张` : `任务成功生成 ${okImages.length} 张图片`,
        failedCount ? 'info' : 'ok',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败'
      patchTask(taskId, {
        status: 'failed',
        error: message,
        elapsedMs: Date.now() - startedAt,
      })
      showMessage(message, 'error')
    }
  }

  function handleUploadImage(taskId: string, result: GenerateResultItem) {
    const accessPassword = getAccessPassword()
    if (!accessPassword) {
      showMessage('上传图床需要先填写服务端访问密码', 'error')
      onOpenSettings()
      return
    }
    if (result.uploading) return
    void uploadGeneratedResult(taskId, result, accessPassword, true).then(async (uploaded) => {
      if (!uploaded) return
      await updateHistoryImageUrl(taskId, uploaded.index, uploaded.remoteUrl, uploaded.remoteThumbUrl)
      await onHistoryRefresh()
    })
  }

  function removeTask(id: string) {
    uploadCacheRef.current.delete(id)
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }

  function clearFinishedTasks() {
    setTasks((prev) => prev.filter((task) => task.status === 'running'))
  }

  return {
    tasks,
    setTasks: setTasks as Dispatch<SetStateAction<GenerationTask[]>>,
    runGenerationTask,
    handleUploadImage,
    removeTask,
    clearFinishedTasks,
  }
}
