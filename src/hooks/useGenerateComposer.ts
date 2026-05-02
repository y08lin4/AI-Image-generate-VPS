import { type Dispatch, type SetStateAction, useState } from 'react'
import { createBackgroundTask, createId } from '../lib/api'
import type { GenerateTaskPayload } from '../lib/appTask'
import type { AppSettings, AspectRatio, BackgroundTask, GenerationTask, InputImage, Mode, ResolutionTier } from '../types'

type MessageType = 'ok' | 'error' | 'info'

interface UseGenerateComposerOptions {
  settings: AppSettings
  ratio: AspectRatio
  resolution: ResolutionTier
  size: string
  updateSettings: (next: AppSettings) => void
  getAccessPassword: () => string
  showMessage: (text: string, type?: MessageType) => void
  clearMessage: () => void
  onOpenSettings: () => void
  setTasks: Dispatch<SetStateAction<GenerationTask[]>>
  runGenerationTask: (
    taskId: string,
    payload: GenerateTaskPayload,
    requestMode: AppSettings['requestMode'],
    accessPassword: string,
    autoUploadPixhost: boolean,
    startedAt: number,
  ) => Promise<void> | void
  applyCloudTask: (task: BackgroundTask) => Promise<void>
}

export function useGenerateComposer({
  settings,
  ratio,
  resolution,
  size,
  updateSettings,
  getAccessPassword,
  showMessage,
  clearMessage,
  onOpenSettings,
  setTasks,
  runGenerationTask,
  applyCloudTask,
}: UseGenerateComposerOptions) {
  const [mode, setMode] = useState<Mode>('text-to-image')
  const [prompt, setPrompt] = useState('')
  const [inputImages, setInputImages] = useState<InputImage[]>([])

  function validateBeforeGenerate() {
    const accessPassword = getAccessPassword()
    if ((settings.requestMode === 'worker' || settings.requestMode === 'background') && !accessPassword) return '请先在设置里填写服务端访问密码'
    if (settings.autoUploadPixhost && !accessPassword) return '自动上传图床需要服务端访问密码'
    if (!settings.baseUrl.trim()) return '请先填写 API URL'
    if (!settings.apiKey.trim()) return '请先填写 API Key'
    if (!settings.model.trim()) return '请先填写模型名称'
    if (!prompt.trim()) return '请输入提示词'
    if (mode === 'image-to-image' && inputImages.length === 0) return '图生图模式需要先上传参考图'
    return ''
  }

  async function submitBackgroundTask(payload: GenerateTaskPayload, accessPassword: string) {
    try {
      const cloudTask = await createBackgroundTask(payload, accessPassword)
      await applyCloudTask(cloudTask)
      showMessage('后台任务已提交，App 切后台也不会丢任务，回前台会自动恢复', 'ok')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '创建后台任务失败', 'error')
    }
  }

  function handleGenerate() {
    const invalid = validateBeforeGenerate()
    if (invalid) {
      showMessage(invalid, 'error')
      onOpenSettings()
      return
    }

    clearMessage()
    updateSettings(settings)

    const accessPassword = getAccessPassword()
    const startedAt = Date.now()
    const taskId = createId('task')
    const payload: GenerateTaskPayload = {
      mode,
      prompt: prompt.trim(),
      ratio,
      resolution,
      model: settings.model.trim(),
      baseUrl: settings.baseUrl.trim(),
      apiKey: settings.apiKey.trim(),
      timeoutSec: settings.timeoutSec,
      count: settings.count,
      concurrency: settings.concurrency,
      inputImages: mode === 'image-to-image' ? inputImages.map((image) => ({ ...image })) : [],
    }

    if (settings.requestMode === 'background') {
      showMessage(mode === 'image-to-image' ? '正在创建后台任务并上传参考图...' : '正在创建后台任务...', 'info')
      void submitBackgroundTask(payload, accessPassword)
      return
    }

    const task: GenerationTask = {
      id: taskId,
      createdAt: startedAt,
      mode,
      requestMode: settings.requestMode,
      prompt: payload.prompt,
      ratio,
      resolution,
      size,
      model: payload.model,
      count: payload.count,
      concurrency: payload.concurrency,
      status: 'running',
      results: [],
    }
    setTasks((prev) => [task, ...prev])
    showMessage('任务已提交，可以继续提交新任务', 'ok')
    void runGenerationTask(taskId, payload, settings.requestMode, accessPassword, settings.autoUploadPixhost, startedAt)
  }

  function handleUseAsReference(dataUrl: string) {
    const nextImage = {
      id: createId('ref'),
      name: 'generated-reference.png',
      type: dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/png',
      dataUrl,
      size: dataUrl.length,
    }
    setInputImages((prev) => {
      if (prev.length >= 8) {
        showMessage('参考图最多 8 张，已替换为当前图片', 'info')
        return [nextImage]
      }
      return [...prev, nextImage]
    })
    setMode('image-to-image')
    showMessage('已放入图生图参考图', 'ok')
  }

  function reusePrompt(nextPrompt: string) {
    setPrompt(nextPrompt)
    showMessage('提示词已复用', 'ok')
  }

  return {
    mode,
    setMode,
    prompt,
    setPrompt,
    inputImages,
    setInputImages,
    handleGenerate,
    handleUseAsReference,
    reusePrompt,
  }
}
