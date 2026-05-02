import { useEffect, useState } from 'react'
import { addHistory, clearHistory, deleteHistory, getHistory } from '../lib/db'
import type { BackgroundTask, HistoryItem } from '../types'

export function useHistoryHub() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyCollapsed, setHistoryCollapsed] = useState(false)

  async function refreshHistory() {
    setHistory(await getHistory())
  }

  async function saveCloudTaskToHistory(task: BackgroundTask) {
    const okResults = task.results.filter((item) => item.ok && (item.remoteUrl || item.image))
    if (!okResults.length) return
    await addHistory({
      id: task.id,
      createdAt: task.createdAt,
      mode: task.mode,
      prompt: task.prompt,
      ratio: task.ratio,
      resolution: task.resolution,
      size: task.size,
      model: task.model,
      images: okResults.map((item) => item.image || item.remoteUrl!),
      imageResultIndexes: okResults.map((item) => item.index),
      remoteUrls: okResults.map((item) => item.remoteUrl || ''),
      remoteThumbUrls: okResults.map((item) => item.remoteThumbUrl || ''),
      failedCount: Math.max(0, task.count - okResults.length),
      elapsedMs: task.elapsedMs || (task.completedAt ? task.completedAt - task.createdAt : 0),
    })
    await refreshHistory()
  }

  async function handleDeleteHistory(id: string) {
    await deleteHistory(id)
    await refreshHistory()
  }

  async function handleClearHistory() {
    if (!confirm('确认清空本地历史记录？')) return
    await clearHistory()
    await refreshHistory()
  }

  function toggleHistoryCollapsed() {
    setHistoryCollapsed((prev) => !prev)
  }

  useEffect(() => {
    void refreshHistory()
  }, [])

  return {
    history,
    historyCollapsed,
    refreshHistory,
    saveCloudTaskToHistory,
    handleDeleteHistory,
    handleClearHistory,
    toggleHistoryCollapsed,
  }
}
