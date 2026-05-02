import type { AppSettings, AspectRatio, BackgroundTask, GenerationTask, HistoryItem, InputImage, Mode, ResolutionTier } from '../types'

export type GenerateTaskPayload = {
  mode: Mode
  prompt: string
  ratio: AspectRatio
  resolution: ResolutionTier
  model: string
  baseUrl: string
  apiKey: string
  timeoutSec: number
  count: number
  concurrency: number
  inputImages: InputImage[]
}

export const WORK_LIST_PAGE_SIZE = 20

export function getRequestModeLabel(value: AppSettings['requestMode']) {
  if (value === 'background') return '服务端后台任务'
  if (value === 'worker') return '服务端流式代理'
  return '浏览器直连'
}

export function isCloudTaskFinished(task: BackgroundTask) {
  return task.status === 'completed' || task.status === 'failed' || task.status === 'partial_failed'
}

export function cloudTaskToGenerationTask(task: BackgroundTask): GenerationTask {
  return {
    id: task.id,
    cloudTaskId: task.id,
    cloudStatus: task.status,
    retryOf: task.retryOf,
    createdAt: task.createdAt,
    mode: task.mode,
    requestMode: 'background',
    prompt: task.prompt,
    ratio: task.ratio,
    resolution: task.resolution,
    size: task.size,
    model: task.model,
    count: task.count,
    concurrency: task.concurrency,
    status: task.status === 'failed' ? 'failed' : isCloudTaskFinished(task) ? 'completed' : 'running',
    results: task.results,
    elapsedMs: task.elapsedMs,
    error: task.error,
  }
}

export function historyItemToGenerationTask(item: HistoryItem, taskId: string): GenerationTask {
  const results = item.images.map((image, index) => {
    const remoteUrl = item.remoteUrls?.[index] || (/^https?:\/\//i.test(image) ? image : undefined)
    return {
      index,
      ok: true,
      image,
      remoteUrl,
      remoteThumbUrl: item.remoteThumbUrls?.[index],
    }
  })

  return {
    id: taskId,
    createdAt: item.createdAt,
    mode: item.mode,
    requestMode: 'history',
    prompt: item.prompt,
    ratio: item.ratio,
    resolution: item.resolution || 'auto',
    size: item.size,
    model: item.model,
    count: item.images.length,
    concurrency: 1,
    status: 'completed',
    results,
    elapsedMs: item.elapsedMs,
  }
}
