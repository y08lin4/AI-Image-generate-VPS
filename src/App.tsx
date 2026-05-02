import { useCallback, useEffect, useRef, useState } from 'react'
import type { GenerateResultItem, HistoryItem } from './types'
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
import { fetchBackgroundTaskImage, publishWork, retryBackgroundTask } from './lib/api'
import { getRequestModeLabel, historyItemToGenerationTask, WORK_LIST_PAGE_SIZE } from './lib/appTask'
import { useBackgroundTasks } from './hooks/useBackgroundTasks'
import { useGenerationTasks } from './hooks/useGenerationTasks'
import { useAccessSession } from './hooks/useAccessSession'
import { useAppSettings } from './hooks/useAppSettings'
import { useGenerateComposer } from './hooks/useGenerateComposer'
import { useHistoryHub } from './hooks/useHistoryHub'
import { useWorksHub } from './hooks/useWorksHub'
import { getAvailableRatios, getImageSize, getResolutionLabel, normalizeRatioForResolution } from './lib/ratios'
import './styles.css'

type Message = { text: string; type: 'ok' | 'error' | 'info' } | null

export default function App() {
  const {
    settings,
    settingsOpen,
    ratio,
    resolution,
    setSettingsOpen,
    setRatio,
    setResolution,
    updateSettings,
    patchSettings,
  } = useAppSettings()
  const [message, setMessage] = useState<Message>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const settingsRef = useRef(settings)
  const showMessage = useCallback((text: string, type: 'ok' | 'error' | 'info' = 'info') => {
    setMessage({ text, type })
  }, [])
  const clearMessage = useCallback(() => {
    setMessage(null)
  }, [])
  const getAccessPassword = useCallback(() => settingsRef.current.accessPassword.trim(), [])
  const {
    history,
    historyCollapsed,
    refreshHistory,
    saveCloudTaskToHistory,
    handleDeleteHistory,
    handleClearHistory,
    toggleHistoryCollapsed,
  } = useHistoryHub()
  const {
    me,
    unlocked,
    unlocking,
    handleUnlock,
    handleAccessPasswordUpdated,
    refreshCurrentUser,
    handleLogin: loginWithSession,
    handleRegister: registerWithSession,
    handleLogout: logoutWithSession,
  } = useAccessSession({
    accessPassword: settings.accessPassword,
    getAccessPassword,
    showMessage,
    onAccessPasswordUpdated: (nextPassword) => patchSettings({ accessPassword: nextPassword }),
  })
  const {
    tasks,
    setTasks,
    runGenerationTask,
    handleUploadImage,
    removeTask,
    clearFinishedTasks,
  } = useGenerationTasks({
    showMessage,
    getAccessPassword,
    onOpenSettings: () => setSettingsOpen(true),
    onHistoryRefresh: refreshHistory,
  })
  const {
    works,
    worksLoading,
    workSort,
    workOffset,
    workTotal,
    myWorks,
    myWorksLoading,
    favoriteWorks,
    favoriteWorksLoading,
    activeCommentWork,
    workComments,
    workCommentsLoading,
    workCommentsTotal,
    profileUserId,
    profileData,
    profileWorks,
    profileLoading,
    resetForLock,
    resetForNoUser,
    closeComments,
    closeProfile,
    refreshWorks,
    refreshMyWorks,
    refreshMyFavorites,
    refreshWorkComments,
    refreshProfile,
    handleToggleLike,
    handleToggleFavorite,
    handleOpenComments,
    handleCreateComment,
    handleDeleteComment,
    handleOpenUserProfile,
    handleDeleteMyWork,
    handleChangeWorkSort,
    handleChangeWorkPage,
    handleRefreshSquare,
  } = useWorksHub({ me, getAccessPassword, showMessage })
  const size = getImageSize(ratio, resolution)
  const {
    backgroundStats,
    syncingCloudTasks,
    applyCloudTask,
    restoreActiveBackgroundTasks,
    syncCloudTasks,
  } = useBackgroundTasks({
    getAccessPassword,
    showMessage,
    setTasks,
    onSaveCloudTaskToHistory: saveCloudTaskToHistory,
    onMissingAccessPassword: () => setSettingsOpen(true),
  })
  const {
    mode,
    setMode,
    prompt,
    setPrompt,
    inputImages,
    setInputImages,
    handleGenerate,
    handleUseAsReference,
    reusePrompt,
  } = useGenerateComposer({
    settings,
    ratio,
    resolution,
    size,
    updateSettings,
    getAccessPassword,
    showMessage,
    clearMessage,
    onOpenSettings: () => setSettingsOpen(true),
    setTasks,
    runGenerationTask,
    applyCloudTask,
  })

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    if (!settings.accessPassword.trim()) return
    void restoreActiveBackgroundTasks(false)
  }, [settings.accessPassword])

  useEffect(() => {
    if (!unlocked) {
      resetForLock()
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
      resetForNoUser()
      return
    }
    void refreshMyWorks()
    void refreshMyFavorites()
  }, [unlocked, me?.id, settings.accessPassword, workSort])

  useEffect(() => {
    if (!unlocked || !profileUserId) return
    void refreshProfile(profileUserId)
  }, [unlocked, profileUserId, settings.accessPassword, workSort])

  async function handleLogin(username: string, password: string) {
    await loginWithSession(username, password)
    await refreshWorks()
  }

  async function handleRegister(username: string, password: string) {
    await registerWithSession(username, password)
    await refreshWorks()
  }

  async function handleLogout() {
    await logoutWithSession()
    resetForLock()
    await refreshWorks()
  }

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
          onToggleCollapsed={toggleHistoryCollapsed}
          onReusePrompt={reusePrompt}
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
        onClose={closeComments}
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
        onClose={closeProfile}
        onOpenComments={(work) => {
          closeProfile()
          void handleOpenComments(work)
        }}
        onToggleLike={(work) => void handleToggleLike(work)}
        onToggleFavorite={(work) => void handleToggleFavorite(work)}
      />
    </div>
  )
}
