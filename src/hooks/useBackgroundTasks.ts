import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
import { fetchBackgroundTaskImage, getBackgroundStats, getBackgroundTask, listBackgroundTasks } from '../lib/api'
import { cloudTaskToGenerationTask, isCloudTaskFinished } from '../lib/appTask'
import { addActiveBackgroundTask, loadActiveBackgroundTasks, removeActiveBackgroundTask } from '../lib/storage'
import type { BackgroundStats, BackgroundTask, GenerationTask } from '../types'

type MessageType = 'ok' | 'error' | 'info'

interface UseBackgroundTasksOptions {
  getAccessPassword: () => string
  showMessage: (text: string, type?: MessageType) => void
  setTasks: Dispatch<SetStateAction<GenerationTask[]>>
  onSaveCloudTaskToHistory: (task: BackgroundTask) => Promise<void>
  onMissingAccessPassword?: () => void
}

export function useBackgroundTasks({
  getAccessPassword,
  showMessage,
  setTasks,
  onSaveCloudTaskToHistory,
  onMissingAccessPassword,
}: UseBackgroundTasksOptions) {
  const [backgroundStats, setBackgroundStats] = useState<BackgroundStats | null>(null)
  const [syncingCloudTasks, setSyncingCloudTasks] = useState(false)
  const pollTimersRef = useRef(new Map<string, number>())

  function clearPollTimers() {
    for (const timer of pollTimersRef.current.values()) window.clearTimeout(timer)
    pollTimersRef.current.clear()
  }

  function upsertTask(nextTask: GenerationTask) {
    setTasks((prev) => {
      const index = prev.findIndex((task) => task.id === nextTask.id)
      if (index < 0) return [nextTask, ...prev]
      const next = [...prev]
      next[index] = { ...next[index], ...nextTask }
      return next
    })
  }

  async function refreshBackgroundStats() {
    const password = getAccessPassword()
    if (!password) return
    try {
      setBackgroundStats(await getBackgroundStats(password))
    } catch {
      // 未配置后台数据库时不阻塞主流程
    }
  }

  async function hydrateCloudTaskLocalImages(task: BackgroundTask): Promise<BackgroundTask> {
    const password = getAccessPassword()
    if (!password || !task.results.some((item) => item.localImageUrl && !item.image)) return task

    const hydratedResults = await Promise.all(task.results.map(async (item) => {
      if (!item.localImageUrl || item.image) return item
      try {
        const local = await fetchBackgroundTaskImage(item.localImageUrl, password)
        return {
          ...item,
          image: local.dataUrl,
          mime: local.mime,
          localImageBytes: item.localImageBytes || local.size,
        }
      } catch (error) {
        return {
          ...item,
          ok: false,
          error: error instanceof Error ? error.message : '本地回传图片下载失败',
        }
      }
    }))

    return { ...task, results: hydratedResults }
  }

  async function applyCloudTask(task: BackgroundTask) {
    const hydratedTask = await hydrateCloudTaskLocalImages(task)
    upsertTask(cloudTaskToGenerationTask(hydratedTask))
    if (isCloudTaskFinished(hydratedTask)) {
      removeActiveBackgroundTask(hydratedTask.id)
      const timer = pollTimersRef.current.get(task.id)
      if (timer) window.clearTimeout(timer)
      pollTimersRef.current.delete(task.id)
      await onSaveCloudTaskToHistory(hydratedTask)
      await refreshBackgroundStats()
    } else {
      addActiveBackgroundTask(hydratedTask.id, hydratedTask.createdAt)
      startBackgroundPolling(hydratedTask.id)
    }
  }

  function startBackgroundPolling(taskId: string) {
    if (pollTimersRef.current.has(taskId)) return

    const tick = async () => {
      const password = getAccessPassword()
      if (!password) {
        pollTimersRef.current.delete(taskId)
        return
      }

      try {
        const task = await getBackgroundTask(taskId, password)
        await applyCloudTask(task)
        if (!isCloudTaskFinished(task)) {
          const timer = window.setTimeout(tick, 5000)
          pollTimersRef.current.set(taskId, timer)
        }
      } catch (error) {
        const timer = window.setTimeout(tick, 10_000)
        pollTimersRef.current.set(taskId, timer)
        if (error instanceof Error) showMessage(`后台任务同步失败：${error.message}`, 'error')
      }
    }

    const timer = window.setTimeout(tick, 1000)
    pollTimersRef.current.set(taskId, timer)
  }

  async function restoreActiveBackgroundTasks(notify: boolean) {
    const password = getAccessPassword()
    if (!password) return
    const active = loadActiveBackgroundTasks()
    if (!active.length) {
      await refreshBackgroundStats()
      return
    }

    try {
      const tasks = await Promise.all(active.map((item) => getBackgroundTask(item.id, password)))
      for (const task of tasks) await applyCloudTask(task)
      if (notify) showMessage(`已恢复 ${tasks.length} 个后台任务`, 'ok')
    } catch (error) {
      if (notify) showMessage(error instanceof Error ? error.message : '恢复后台任务失败', 'error')
    }
  }

  async function syncCloudTasks() {
    const password = getAccessPassword()
    if (!password) {
      showMessage('同步云端任务需要先填写服务端访问密码', 'error')
      onMissingAccessPassword?.()
      return
    }
    setSyncingCloudTasks(true)
    try {
      const cloudTasks = await listBackgroundTasks(password, 30)
      for (const task of cloudTasks) await applyCloudTask(task)
      showMessage(`已同步 ${cloudTasks.length} 个云端任务`, 'ok')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '同步云端任务失败', 'error')
    } finally {
      setSyncingCloudTasks(false)
    }
  }

  const restoreRef = useRef(restoreActiveBackgroundTasks)
  restoreRef.current = restoreActiveBackgroundTasks

  useEffect(() => {
    void refreshBackgroundStats()
  }, [])

  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        void restoreRef.current(false)
      }
    }
    const handleFocus = () => {
      void restoreRef.current(false)
    }
    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('focus', handleFocus)
      clearPollTimers()
    }
  }, [])

  return {
    backgroundStats,
    syncingCloudTasks,
    refreshBackgroundStats,
    applyCloudTask,
    restoreActiveBackgroundTasks,
    syncCloudTasks,
  }
}
