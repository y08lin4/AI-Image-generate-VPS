import type { Dispatch, SetStateAction } from 'react'
import { fetchBackgroundTaskImage, publishWork, retryBackgroundTask } from '../lib/api'
import { historyItemToGenerationTask } from '../lib/appTask'
import type { AppSettings, AuthUser, BackgroundTask, GenerationTask, GenerateResultItem, HistoryItem } from '../types'

type MessageType = 'ok' | 'error' | 'info'

interface UseTaskActionsOptions {
  me: AuthUser | null
  tasks: GenerationTask[]
  setTasks: Dispatch<SetStateAction<GenerationTask[]>>
  settings: AppSettings
  getAccessPassword: () => string
  showMessage: (text: string, type?: MessageType) => void
  onOpenSettings: () => void
  applyCloudTask: (task: BackgroundTask) => Promise<void>
  refreshWorks: () => Promise<void>
  refreshMyWorks: () => Promise<void>
}

export function useTaskActions({
  me,
  tasks,
  setTasks,
  settings,
  getAccessPassword,
  showMessage,
  onOpenSettings,
  applyCloudTask,
  refreshWorks,
  refreshMyWorks,
}: UseTaskActionsOptions) {
  async function handlePublishWork(taskId: string, result: GenerateResultItem) {
    if (!me) {
      showMessage('请先登录后再发布作品', 'error')
      return
    }
    const accessPassword = getAccessPassword()
    if (!accessPassword) {
      showMessage('缺少服务端访问密码', 'error')
      return
    }
    const task = tasks.find((item) => item.id === taskId)
    if (!task) {
      showMessage('任务不存在，无法发布', 'error')
      return
    }
    let imageUrl = result.remoteUrl || result.image || ''
    if (!imageUrl && result.localImageUrl) {
      try {
        const local = await fetchBackgroundTaskImage(result.localImageUrl, accessPassword)
        imageUrl = local.dataUrl
      } catch (error) {
        showMessage(error instanceof Error ? error.message : '读取本地回传图片失败', 'error')
        return
      }
    }
    if (!imageUrl) {
      showMessage('当前结果没有可发布的图片', 'error')
      return
    }
    const defaultTitle = task.prompt.trim().slice(0, 32) || `作品 #${result.index + 1}`
    const userInput = window.prompt('输入作品标题（可修改）', defaultTitle)
    if (userInput === null) return
    const title = userInput.trim() || defaultTitle

    try {
      await publishWork(accessPassword, {
        title,
        prompt: task.prompt,
        imageUrl,
        thumbUrl: result.remoteThumbUrl || result.remoteUrl,
      })
      showMessage('作品发布成功，已进入广场', 'ok')
      await Promise.all([refreshWorks(), refreshMyWorks()])
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '发布作品失败', 'error')
    }
  }

  async function handleRetryBackgroundTask(taskId: string) {
    const accessPassword = getAccessPassword()
    if (!accessPassword) {
      showMessage('重试后台任务需要先填写服务端访问密码', 'error')
      onOpenSettings()
      return
    }
    if (!settings.apiKey.trim()) {
      showMessage('重试后台任务需要当前浏览器里的 API Key', 'error')
      onOpenSettings()
      return
    }

    try {
      const cloudTask = await retryBackgroundTask(
        taskId,
        {
          apiKey: settings.apiKey.trim(),
          baseUrl: settings.baseUrl.trim(),
          timeoutSec: settings.timeoutSec,
          concurrency: settings.concurrency,
          model: settings.model.trim(),
        },
        accessPassword,
      )
      await applyCloudTask(cloudTask)
      showMessage('已创建重试后台任务', 'ok')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '重试后台任务失败', 'error')
    }
  }

  function handleShowHistoryInResults(item: HistoryItem) {
    const taskId = `history_${item.id}_${Date.now()}`
    const task = historyItemToGenerationTask(item, taskId)
    setTasks((prev) => [task, ...prev])
    showMessage(`已把历史记录放到生成结果区，共 ${item.images.length} 张`, 'ok')
    window.setTimeout(() => document.querySelector('.canvas-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return {
    handlePublishWork,
    handleRetryBackgroundTask,
    handleShowHistoryInResults,
  }
}
