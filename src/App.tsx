import { useEffect, useRef, useState } from 'react'
import type { AppSettings, AspectRatio, AuthUser, BackgroundStats, BackgroundTask, GenerationTask, GenerateResultItem, HistoryItem, InputImage, Mode, ResolutionTier, UserProfile, WorkComment, WorkItem, WorkSort } from './types'
import { RatioPicker } from './components/RatioPicker'
import { ResolutionPicker } from './components/ResolutionPicker'
import { ImageUploader } from './components/ImageUploader'
import { SettingsModal } from './components/SettingsModal'
import { AccessGate } from './components/AccessGate'
import { AdminModal } from './components/AdminModal'
import { HistoryPanel } from './components/HistoryPanel'
import { TaskQueue } from './components/TaskQueue'
import { AuthPanel } from './components/AuthPanel'
import { WorksSquare } from './components/WorksSquare'
import { WorkCommentsModal } from './components/WorkCommentsModal'
import { UserProfileModal } from './components/UserProfileModal'
import { checkServerPassword, createBackgroundTask, createId, createWorkComment, deleteWork, deleteWorkComment, favoriteWork, fetchBackgroundTaskImage, generateImagesDirect, generateImagesStream, getBackgroundStats, getBackgroundTask, getCurrentUser, getUserProfileById, likeWork, listBackgroundTasks, listMyFavoriteWorks, listMyWorks, listUserWorksById, listWorkComments, listWorks as listWorksSquare, loginUser, logoutUser, publishWork, registerUser, retryBackgroundTask, unfavoriteWork, unlikeWork, uploadImageToPixhost } from './lib/api'
import { addHistory, clearHistory, deleteHistory, getHistory, updateHistoryImageUrl } from './lib/db'
import { getAvailableRatios, getImageSize, getResolutionLabel, normalizeRatioForResolution } from './lib/ratios'
import { addActiveBackgroundTask, loadActiveBackgroundTasks, removeActiveBackgroundTask, DEFAULT_SETTINGS, loadSettings, saveSettings } from './lib/storage'
import './styles.css'

type Message = { text: string; type: 'ok' | 'error' | 'info' } | null

type UploadResult = { index: number; remoteUrl: string; remoteThumbUrl?: string }
const WORK_LIST_PAGE_SIZE = 20

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('text-to-image')
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState<AspectRatio>(() => loadSettings().defaultRatio)
  const [resolution, setResolution] = useState<ResolutionTier>(() => loadSettings().defaultResolution)
  const [inputImages, setInputImages] = useState<InputImage[]>([])
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [backgroundStats, setBackgroundStats] = useState<BackgroundStats | null>(null)
  const [syncingCloudTasks, setSyncingCloudTasks] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [me, setMe] = useState<AuthUser | null>(null)
  const [works, setWorks] = useState<WorkItem[]>([])
  const [worksLoading, setWorksLoading] = useState(false)
  const [workSort, setWorkSort] = useState<WorkSort>('latest')
  const [workOffset, setWorkOffset] = useState(0)
  const [workTotal, setWorkTotal] = useState(0)
  const [myWorks, setMyWorks] = useState<WorkItem[]>([])
  const [myWorksLoading, setMyWorksLoading] = useState(false)
  const [favoriteWorks, setFavoriteWorks] = useState<WorkItem[]>([])
  const [favoriteWorksLoading, setFavoriteWorksLoading] = useState(false)
  const [activeCommentWork, setActiveCommentWork] = useState<WorkItem | null>(null)
  const [workComments, setWorkComments] = useState<WorkComment[]>([])
  const [workCommentsLoading, setWorkCommentsLoading] = useState(false)
  const [workCommentsTotal, setWorkCommentsTotal] = useState(0)
  const [profileUserId, setProfileUserId] = useState<number | null>(null)
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [profileWorks, setProfileWorks] = useState<WorkItem[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
  const uploadCacheRef = useRef(new Map<string, Map<number, UploadResult>>())
  const pollTimersRef = useRef(new Map<string, number>())
  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const savedPassword = settings.accessPassword.trim()
    if (!savedPassword) {
      setUnlocked(false)
      return
    }
    let active = true
    setUnlocking(true)
    void checkServerPassword(savedPassword)
      .then((result) => {
        if (!active) return
        setUnlocked(result.ok)
      })
      .catch(() => {
        if (!active) return
        setUnlocked(false)
      })
      .finally(() => {
        if (!active) return
        setUnlocking(false)
      })
    return () => {
      active = false
    }
  }, [settings.accessPassword])

  useEffect(() => {
    void refreshHistory()
    void refreshBackgroundStats()
  }, [])

  useEffect(() => {
    if (!settings.accessPassword.trim()) return
    void restoreActiveBackgroundTasks(false)
  }, [settings.accessPassword])

  useEffect(() => {
    if (!unlocked) {
      setMe(null)
      setWorks([])
      setMyWorks([])
      setFavoriteWorks([])
      setWorkOffset(0)
      setWorkTotal(0)
      setActiveCommentWork(null)
      setProfileUserId(null)
      return
    }
    void refreshCurrentUser()
  }, [unlocked, settings.accessPassword])

  useEffect(() => {
    if (!unlocked) return
    void refreshWorks()
  }, [unlocked, settings.accessPassword, workSort, workOffset])

  useEffect(() => {
    if (!unlocked || !me) {
      setMyWorks([])
      setFavoriteWorks([])
      return
    }
    void refreshMyWorks()
    void refreshMyFavorites()
  }, [unlocked, me?.id, settings.accessPassword, workSort])

  useEffect(() => {
    if (!unlocked || !profileUserId) {
      setProfileData(null)
      setProfileWorks([])
      return
    }
    void refreshProfile(profileUserId)
  }, [unlocked, profileUserId, settings.accessPassword, workSort])

  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        void restoreActiveBackgroundTasks(false)
      }
    }
    const handleFocus = () => {
      void restoreActiveBackgroundTasks(false)
    }
    document.addEventListener('visibilitychange', handleResume)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleResume)
      window.removeEventListener('focus', handleFocus)
      for (const timer of pollTimersRef.current.values()) window.clearTimeout(timer)
      pollTimersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    setResolution(settings.defaultResolution)
    setRatio(normalizeRatioForResolution(settings.defaultRatio, settings.defaultResolution))
  }, [settings.defaultRatio, settings.defaultResolution])

  function showMessage(text: string, type: 'ok' | 'error' | 'info' = 'info') {
    setMessage({ text, type })
  }

  async function handleUnlock(accessPassword: string) {
    const password = accessPassword.trim()
    if (!password) throw new Error('请输入访问密码')
    setUnlocking(true)
    try {
      const result = await checkServerPassword(password)
      if (!result.ok) throw new Error(result.message || '访问密码验证失败')
      patchSettings({ accessPassword: password })
      setUnlocked(true)
      return
    } finally {
      setUnlocking(false)
    }
  }

  function handleAccessPasswordUpdated(nextPassword: string) {
    patchSettings({ accessPassword: nextPassword.trim() })
  }

  function patchSettings(patch: Partial<AppSettings>) {
    updateSettings({ ...settings, ...patch })
  }

  function mapWorkCollections(updater: (item: WorkItem) => WorkItem) {
    setWorks((prev) => prev.map(updater))
    setMyWorks((prev) => prev.map(updater))
    setFavoriteWorks((prev) => prev.map(updater))
    setProfileWorks((prev) => prev.map(updater))
  }

  function replaceWorkInCollections(target: WorkItem) {
    mapWorkCollections((item) => (item.id === target.id ? target : item))
  }

  function removeWorkFromCollections(workId: number) {
    setWorks((prev) => prev.filter((item) => item.id !== workId))
    setMyWorks((prev) => prev.filter((item) => item.id !== workId))
    setFavoriteWorks((prev) => prev.filter((item) => item.id !== workId))
    setProfileWorks((prev) => prev.filter((item) => item.id !== workId))
  }

  async function handleLogin(username: string, password: string) {
    const accessPassword = settingsRef.current.accessPassword.trim()
    const user = await loginUser(accessPassword, username, password)
    setMe(user)
    showMessage(`欢迎回来，${user.username}`, 'ok')
    await refreshWorks()
  }

  async function handleRegister(username: string, password: string) {
    const accessPassword = settingsRef.current.accessPassword.trim()
    const user = await registerUser(accessPassword, username, password)
    setMe(user)
    showMessage(`注册成功，欢迎 ${user.username}`, 'ok')
    await refreshWorks()
  }

  async function handleLogout() {
    const accessPassword = settingsRef.current.accessPassword.trim()
    await logoutUser(accessPassword)
    setMe(null)
    setMyWorks([])
    setFavoriteWorks([])
    setActiveCommentWork(null)
    setProfileUserId(null)
    showMessage('已退出登录', 'ok')
    await refreshWorks()
  }

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

  function updateSettings(next: AppSettings) {
    const normalized = {
      ...DEFAULT_SETTINGS,
      ...next,
      count: Math.max(1, Math.min(12, Math.round(Number(next.count) || DEFAULT_SETTINGS.count))),
      concurrency: Math.max(1, Math.min(6, Math.round(Number(next.concurrency) || DEFAULT_SETTINGS.concurrency))),
      timeoutSec: Math.max(10, Math.min(900, Math.round(Number(next.timeoutSec) || DEFAULT_SETTINGS.timeoutSec))),
      defaultRatio: next.defaultRatio,
      defaultResolution: next.defaultResolution,
      autoUploadPixhost: next.autoUploadPixhost === true,
    }
    setSettings(normalized)
    saveSettings(normalized)
  }

  async function refreshHistory() {
    setHistory(await getHistory())
  }

  async function refreshBackgroundStats() {
    const password = settingsRef.current.accessPassword.trim()
    if (!password) return
    try {
      setBackgroundStats(await getBackgroundStats(password))
    } catch {
      // 未配置后台数据库时不阻塞主流程
    }
  }

  async function refreshCurrentUser() {
    const password = settingsRef.current.accessPassword.trim()
    if (!password) {
      setMe(null)
      return
    }
    try {
      setMe(await getCurrentUser(password))
    } catch {
      setMe(null)
    }
  }

  async function refreshWorks(showError = false) {
    const password = settingsRef.current.accessPassword.trim()
    if (!password) {
      setWorks([])
      setWorkTotal(0)
      return
    }
    setWorksLoading(true)
    try {
      const data = await listWorksSquare(password, { limit: WORK_LIST_PAGE_SIZE, offset: workOffset, sort: workSort })
      setWorks(data.works)
      setWorkTotal(data.total)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取作品广场失败', 'error')
    } finally {
      setWorksLoading(false)
    }
  }

  async function refreshMyWorks(showError = false) {
    const password = settingsRef.current.accessPassword.trim()
    if (!password || !me) {
      setMyWorks([])
      return
    }
    setMyWorksLoading(true)
    try {
      const data = await listMyWorks(password, { limit: WORK_LIST_PAGE_SIZE, offset: 0, sort: workSort })
      setMyWorks(data.works)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取我的作品失败', 'error')
    } finally {
      setMyWorksLoading(false)
    }
  }

  async function refreshMyFavorites(showError = false) {
    const password = settingsRef.current.accessPassword.trim()
    if (!password || !me) {
      setFavoriteWorks([])
      return
    }
    setFavoriteWorksLoading(true)
    try {
      const data = await listMyFavoriteWorks(password, { limit: WORK_LIST_PAGE_SIZE, offset: 0, sort: workSort })
      setFavoriteWorks(data.works)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取我的收藏失败', 'error')
    } finally {
      setFavoriteWorksLoading(false)
    }
  }

  async function refreshWorkComments(workId: number, showError = false) {
    const password = settingsRef.current.accessPassword.trim()
    if (!password) return
    setWorkCommentsLoading(true)
    try {
      const data = await listWorkComments(password, workId, { limit: 50, offset: 0 })
      setWorkComments(data.comments)
      setWorkCommentsTotal(data.total)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取评论失败', 'error')
    } finally {
      setWorkCommentsLoading(false)
    }
  }

  async function refreshProfile(userId: number, showError = false) {
    const password = settingsRef.current.accessPassword.trim()
    if (!password) return
    setProfileLoading(true)
    try {
      const [profile, worksRes] = await Promise.all([
        getUserProfileById(password, userId),
        listUserWorksById(password, userId, { limit: 30, offset: 0, sort: workSort }),
      ])
      setProfileData(profile)
      setProfileWorks(worksRes.works)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '加载用户主页失败', 'error')
    } finally {
      setProfileLoading(false)
    }
  }

  function getRequestModeLabel(value: AppSettings['requestMode']) {
    if (value === 'background') return '服务端后台任务'
    if (value === 'worker') return '服务端流式代理'
    return '浏览器直连'
  }

  function isCloudTaskFinished(task: BackgroundTask) {
    return task.status === 'completed' || task.status === 'failed' || task.status === 'partial_failed'
  }

  function cloudTaskToGenerationTask(task: BackgroundTask): GenerationTask {
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

  function upsertTask(nextTask: GenerationTask) {
    setTasks((prev) => {
      const index = prev.findIndex((task) => task.id === nextTask.id)
      if (index < 0) return [nextTask, ...prev]
      const next = [...prev]
      next[index] = { ...next[index], ...nextTask }
      return next
    })
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

  async function hydrateCloudTaskLocalImages(task: BackgroundTask): Promise<BackgroundTask> {
    const password = settingsRef.current.accessPassword.trim()
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
      await saveCloudTaskToHistory(hydratedTask)
      await refreshBackgroundStats()
    } else {
      addActiveBackgroundTask(hydratedTask.id, hydratedTask.createdAt)
      startBackgroundPolling(hydratedTask.id)
    }
  }

  function startBackgroundPolling(taskId: string) {
    if (pollTimersRef.current.has(taskId)) return

    const tick = async () => {
      const password = settingsRef.current.accessPassword.trim()
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
    const password = settingsRef.current.accessPassword.trim()
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
    const password = settings.accessPassword.trim()
    if (!password) {
      showMessage('同步云端任务需要先填写服务端访问密码', 'error')
      setSettingsOpen(true)
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

  function validateBeforeGenerate() {
    if ((settings.requestMode === 'worker' || settings.requestMode === 'background') && !settings.accessPassword.trim()) return '请先在设置里填写服务端访问密码'
    if (settings.autoUploadPixhost && !settings.accessPassword.trim()) return '自动上传图床需要服务端访问密码'
    if (!settings.baseUrl.trim()) return '请先填写 API URL'
    if (!settings.apiKey.trim()) return '请先填写 API Key'
    if (!settings.model.trim()) return '请先填写模型名称'
    if (!prompt.trim()) return '请输入提示词'
    if (mode === 'image-to-image' && inputImages.length === 0) return '图生图模式需要先上传参考图'
    return ''
  }

  function handleGenerate() {
    const invalid = validateBeforeGenerate()
    if (invalid) {
      showMessage(invalid, 'error')
      setSettingsOpen(true)
      return
    }

    setMessage(null)
    updateSettings(settings)

    const startedAt = Date.now()
    const taskId = createId('task')
    const payload = {
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
      void submitBackgroundTask(payload, settings.accessPassword)
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
    void runGenerationTask(taskId, payload, settings.requestMode, settings.accessPassword, settings.autoUploadPixhost, startedAt)
  }

  async function submitBackgroundTask(
    payload: {
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
    },
    accessPassword: string,
  ) {
    try {
      const cloudTask = await createBackgroundTask(payload, accessPassword)
      addActiveBackgroundTask(cloudTask.id, cloudTask.createdAt)
      await applyCloudTask(cloudTask)
      showMessage('后台任务已提交，App 切后台也不会丢任务，回前台会自动恢复', 'ok')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '创建后台任务失败', 'error')
    }
  }

  async function runGenerationTask(
    taskId: string,
    payload: {
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
    },
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
        await refreshHistory()
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

  function handleUploadImage(taskId: string, result: GenerateResultItem) {
    if (!settings.accessPassword.trim()) {
      showMessage('上传图床需要先填写服务端访问密码', 'error')
      setSettingsOpen(true)
      return
    }
    if (result.uploading) return
    void uploadGeneratedResult(taskId, result, settings.accessPassword, true).then(async (uploaded) => {
      if (!uploaded) return
      await updateHistoryImageUrl(taskId, uploaded.index, uploaded.remoteUrl, uploaded.remoteThumbUrl)
      await refreshHistory()
    })
  }

  async function handlePublishWork(taskId: string, result: GenerateResultItem) {
    if (!me) {
      showMessage('请先登录后再发布作品', 'error')
      return
    }
    const accessPassword = settings.accessPassword.trim()
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

  async function handleToggleLike(work: WorkItem) {
    if (!me) {
      showMessage('请先登录后再点赞', 'error')
      return
    }

    const accessPassword = settings.accessPassword.trim()
    const nextLiked = !work.likedByMe
    const nextLikeCount = Math.max(0, work.likeCount + (nextLiked ? 1 : -1))
    mapWorkCollections((item) => item.id === work.id ? { ...item, likedByMe: nextLiked, likeCount: nextLikeCount } : item)

    try {
      if (nextLiked) await likeWork(accessPassword, work.id)
      else await unlikeWork(accessPassword, work.id)
    } catch (error) {
      replaceWorkInCollections(work)
      showMessage(error instanceof Error ? error.message : '点赞操作失败', 'error')
    }
  }

  async function handleToggleFavorite(work: WorkItem) {
    if (!me) {
      showMessage('请先登录后再收藏', 'error')
      return
    }
    const accessPassword = settings.accessPassword.trim()
    const nextFavorited = !work.favoritedByMe
    const nextFavoriteCount = Math.max(0, work.favoriteCount + (nextFavorited ? 1 : -1))

    const patchItem = (item: WorkItem) => (item.id === work.id ? { ...item, favoritedByMe: nextFavorited, favoriteCount: nextFavoriteCount } : item)
    mapWorkCollections(patchItem)
    setFavoriteWorks((prev) => {
      if (nextFavorited) {
        return prev.some((item) => item.id === work.id)
          ? prev.map(patchItem)
          : [{ ...work, favoritedByMe: true, favoriteCount: nextFavoriteCount }, ...prev]
      }
      return prev.filter((item) => item.id !== work.id).map(patchItem)
    })

    try {
      if (nextFavorited) await favoriteWork(accessPassword, work.id)
      else await unfavoriteWork(accessPassword, work.id)
    } catch (error) {
      replaceWorkInCollections(work)
      await Promise.all([refreshWorks(), refreshMyFavorites()])
      showMessage(error instanceof Error ? error.message : '收藏操作失败', 'error')
    }
  }

  async function handleOpenComments(work: WorkItem) {
    setActiveCommentWork(work)
    setWorkComments([])
    setWorkCommentsTotal(0)
    await refreshWorkComments(work.id, true)
  }

  async function handleCreateComment(content: string) {
    if (!activeCommentWork) return
    if (!me) {
      showMessage('请先登录后再评论', 'error')
      return
    }
    const accessPassword = settings.accessPassword.trim()
    try {
      const comment = await createWorkComment(accessPassword, activeCommentWork.id, content)
      setWorkComments((prev) => [comment, ...prev])
      setWorkCommentsTotal((prev) => prev + 1)
      const updateCommentCount = (item: WorkItem) => item.id === activeCommentWork.id ? { ...item, commentCount: item.commentCount + 1 } : item
      mapWorkCollections(updateCommentCount)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '发表评论失败', 'error')
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!activeCommentWork) return
    const accessPassword = settings.accessPassword.trim()
    try {
      await deleteWorkComment(accessPassword, commentId)
      setWorkComments((prev) => prev.filter((item) => item.id !== commentId))
      setWorkCommentsTotal((prev) => Math.max(0, prev - 1))
      const updateCommentCount = (item: WorkItem) => item.id === activeCommentWork.id ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item
      mapWorkCollections(updateCommentCount)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '删除评论失败', 'error')
    }
  }

  function handleOpenUserProfile(userId: number) {
    setProfileUserId(userId)
  }

  async function handleDeleteMyWork(work: WorkItem) {
    if (!me) {
      showMessage('请先登录', 'error')
      return
    }
    if (work.userId !== me.id) {
      showMessage('只能删除自己的作品', 'error')
      return
    }
    if (!confirm(`确认删除作品「${work.title}」？`)) return

    const accessPassword = settings.accessPassword.trim()
    try {
      await deleteWork(accessPassword, work.id)
      removeWorkFromCollections(work.id)
      showMessage('作品已删除', 'ok')
      await Promise.all([refreshWorks(), refreshMyWorks(), refreshMyFavorites()])
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '删除作品失败', 'error')
    }
  }

  function handleChangeWorkSort(nextSort: WorkSort) {
    setWorkSort(nextSort)
    setWorkOffset(0)
  }

  function handleChangeWorkPage(nextOffset: number) {
    setWorkOffset(Math.max(0, nextOffset))
  }

  async function handleRefreshSquare() {
    const jobs: Array<Promise<unknown>> = [
      refreshWorks(true),
      refreshMyWorks(true),
      refreshMyFavorites(true),
    ]
    if (profileUserId) jobs.push(refreshProfile(profileUserId, true))
    if (activeCommentWork) jobs.push(refreshWorkComments(activeCommentWork.id, true))
    await Promise.all(jobs)
  }

  async function handleRetryBackgroundTask(taskId: string) {
    if (!settings.accessPassword.trim()) {
      showMessage('重试后台任务需要先填写服务端访问密码', 'error')
      setSettingsOpen(true)
      return
    }
    if (!settings.apiKey.trim()) {
      showMessage('重试后台任务需要当前浏览器里的 API Key', 'error')
      setSettingsOpen(true)
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
        settings.accessPassword.trim(),
      )
      addActiveBackgroundTask(cloudTask.id, cloudTask.createdAt)
      await applyCloudTask(cloudTask)
      showMessage('已创建重试后台任务', 'ok')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '重试后台任务失败', 'error')
    }
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

  function handleShowHistoryInResults(item: HistoryItem) {
    const taskId = `history_${item.id}_${Date.now()}`
    const results: GenerateResultItem[] = item.images.map((image, index) => {
      const remoteUrl = item.remoteUrls?.[index] || (/^https?:\/\//i.test(image) ? image : undefined)
      return {
        index,
        ok: true,
        image,
        remoteUrl,
        remoteThumbUrl: item.remoteThumbUrls?.[index],
      }
    })

    const task: GenerationTask = {
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

    setTasks((prev) => [task, ...prev])
    showMessage(`已把历史记录放到生成结果区，共 ${item.images.length} 张`, 'ok')
    window.setTimeout(() => document.querySelector('.canvas-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
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

  function removeTask(id: string) {
    uploadCacheRef.current.delete(id)
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }

  function clearFinishedTasks() {
    setTasks((prev) => prev.filter((task) => task.status === 'running'))
  }

  const size = getImageSize(ratio, resolution)

  if (!unlocked) {
    return (
      <AccessGate
        initialPassword={settings.accessPassword}
        loading={unlocking}
        onUnlock={handleUnlock}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <h1>AI Image Generate</h1>
            <p>自定义 URL / Key 的私人生图工作台</p>
          </div>
        </div>
        <div className="top-actions">
          <div className="config-pill" title={settings.baseUrl}>
            <span>{getRequestModeLabel(settings.requestMode)}</span>
          </div>
          <button type="button" className="ghost-btn" onClick={() => setAdminOpen(true)}>Admin</button>
          <button type="button" className="secondary-btn" onClick={() => setSettingsOpen(true)}>设置</button>
        </div>
      </header>

      {message ? (
        <div className={`toast ${message.type}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)}>×</button>
        </div>
      ) : null}

      <main className={`workspace ${historyCollapsed ? 'history-collapsed' : ''}`}>
        <aside className="sidebar">
          <section className="panel">
            <label className="label">模式</label>
            <div className="mode-tabs">
              <button type="button" className={mode === 'text-to-image' ? 'active' : ''} onClick={() => setMode('text-to-image')}>文生图</button>
              <button type="button" className={mode === 'image-to-image' ? 'active' : ''} onClick={() => setMode('image-to-image')}>图生图</button>
            </div>
          </section>

          <section className="panel">
            <label className="label" htmlFor="prompt">提示词</label>
            <textarea
              id="prompt"
              className="prompt-input"
              placeholder={mode === 'text-to-image' ? '描述你想生成的内容...' : '描述你希望如何修改这张图...'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </section>

          {mode === 'image-to-image' ? (
            <section className="panel">
              <label className="label">参考图片</label>
              <ImageUploader images={inputImages} onChange={setInputImages} onError={(text) => showMessage(text, 'error')} />
            </section>
          ) : null}

          <section className="panel">
            <label className="label">模型</label>
            <input
              className="text-input"
              value={settings.model}
              onChange={(e) => patchSettings({ model: e.target.value })}
              placeholder="gpt-image-2"
            />
          </section>

          <section className="panel">
            <div className="label-row">
              <label className="label">分辨率档位</label>
              <span>{getResolutionLabel(resolution)}</span>
            </div>
            <ResolutionPicker
              value={resolution}
              onChange={(next) => {
                const nextRatio = normalizeRatioForResolution(ratio, next)
                setResolution(next)
                setRatio(nextRatio)
                patchSettings({ defaultResolution: next, defaultRatio: nextRatio })
              }}
            />
            <small className="hint-text">先选分辨率，再选比例。分辨率选「自动」时，比例也可以固定；固定比例会按标准档尺寸传给接口。</small>
          </section>

          <section className="panel">
            <div className="label-row">
              <label className="label">比例</label>
              <span>{ratio === 'auto' ? '自动' : ratio}</span>
            </div>
            <RatioPicker
              value={ratio}
              ratios={getAvailableRatios(resolution)}
              onChange={(next) => {
                setRatio(next)
                patchSettings({ defaultRatio: next })
              }}
            />
            <small className="hint-text">
              当前请求尺寸：{size}。只有「分辨率=自动」且「比例=自动」时才不传 size；只要选择具体比例就会传实际尺寸，避免 16:9 变成竖图。
            </small>
          </section>

          <section className="panel split-2">
            <label className="field compact">
              <span>张数</span>
              <input type="number" min={1} max={12} value={settings.count} onChange={(e) => patchSettings({ count: Number(e.target.value) })} />
            </label>
            <label className="field compact">
              <span>超时</span>
              <input type="number" min={10} max={900} value={settings.timeoutSec} onChange={(e) => patchSettings({ timeoutSec: Number(e.target.value) })} />
            </label>
          </section>

          <button type="button" className="generate-btn" onClick={handleGenerate}>
            提交任务（{settings.count} 张）
          </button>

          <AuthPanel
            me={me}
            loading={worksLoading}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onLogout={handleLogout}
          />
        </aside>

        <section className="canvas-area">
          <div className="canvas-header">
            <div>
              <h2>生成结果</h2>
              <p>{mode === 'image-to-image' ? '图生图' : '文生图'} · {ratio} · {getResolutionLabel(resolution)} · {size} · {getRequestModeLabel(settings.requestMode)} · 并发 {settings.concurrency}</p>
            </div>
          </div>
          <WorksSquare
            works={works}
            myWorks={myWorks}
            favoriteWorks={favoriteWorks}
            me={me}
            loading={worksLoading}
            myWorksLoading={myWorksLoading}
            favoriteWorksLoading={favoriteWorksLoading}
            sort={workSort}
            offset={workOffset}
            total={workTotal}
            pageSize={WORK_LIST_PAGE_SIZE}
            onRefresh={() => void handleRefreshSquare()}
            onSortChange={handleChangeWorkSort}
            onPageChange={handleChangeWorkPage}
            onToggleLike={(work) => void handleToggleLike(work)}
            onToggleFavorite={(work) => void handleToggleFavorite(work)}
            onOpenComments={(work) => void handleOpenComments(work)}
            onOpenUserProfile={(userId) => handleOpenUserProfile(userId)}
            onDeleteMyWork={(work) => void handleDeleteMyWork(work)}
          />
          <TaskQueue
            tasks={tasks}
            onUploadImage={handleUploadImage}
            onPublishWork={(taskId, result) => void handlePublishWork(taskId, result)}
            onUseAsReference={handleUseAsReference}
            onMessage={showMessage}
            onRemove={removeTask}
            onClearFinished={clearFinishedTasks}
            onSyncCloudTasks={() => void syncCloudTasks()}
            onRetryBackgroundTask={(taskId) => void handleRetryBackgroundTask(taskId)}
            backgroundStats={backgroundStats}
            syncingCloudTasks={syncingCloudTasks}
          />
        </section>

        <HistoryPanel
          items={history}
          collapsed={historyCollapsed}
          onToggleCollapsed={() => setHistoryCollapsed((prev) => !prev)}
          onReusePrompt={(value) => {
            setPrompt(value)
            showMessage('提示词已复用', 'ok')
          }}
          onUseImage={handleUseAsReference}
          onShowInResults={handleShowHistoryInResults}
          onDelete={handleDeleteHistory}
          onClear={handleClearHistory}
          onMessage={showMessage}
        />
      </main>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={updateSettings}
        onMessage={showMessage}
      />

      <AdminModal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onMessage={showMessage}
        onAccessPasswordUpdated={handleAccessPasswordUpdated}
      />

      <WorkCommentsModal
        open={Boolean(activeCommentWork)}
        work={activeCommentWork}
        comments={workComments}
        total={workCommentsTotal}
        loading={workCommentsLoading}
        me={me}
        onClose={() => setActiveCommentWork(null)}
        onRefresh={(workId) => void refreshWorkComments(workId, true)}
        onCreate={(content) => void handleCreateComment(content)}
        onDelete={(commentId) => void handleDeleteComment(commentId)}
      />

      <UserProfileModal
        open={Boolean(profileUserId)}
        profile={profileData}
        works={profileWorks}
        loading={profileLoading}
        me={me}
        onClose={() => setProfileUserId(null)}
        onOpenComments={(work) => {
          setProfileUserId(null)
          void handleOpenComments(work)
        }}
        onToggleLike={(work) => void handleToggleLike(work)}
        onToggleFavorite={(work) => void handleToggleFavorite(work)}
      />
    </div>
  )
}
