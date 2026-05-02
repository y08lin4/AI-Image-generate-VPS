import { useCallback, useEffect, useRef, useState } from 'react'
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
import { getRequestModeLabel, WORK_LIST_PAGE_SIZE } from './lib/appTask'
import { useBackgroundTasks } from './hooks/useBackgroundTasks'
import { useGenerationTasks } from './hooks/useGenerationTasks'
import { useAccessSession } from './hooks/useAccessSession'
import { useAppLifecycle } from './hooks/useAppLifecycle'
import { useAppSettings } from './hooks/useAppSettings'
import { useGenerateComposer } from './hooks/useGenerateComposer'
import { useHistoryHub } from './hooks/useHistoryHub'
import { useTaskActions } from './hooks/useTaskActions'
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
  const {
    handlePublishWork,
    handleRetryBackgroundTask,
    handleShowHistoryInResults,
  } = useTaskActions({
    me,
    tasks,
    setTasks,
    settings,
    getAccessPassword,
    showMessage,
    onOpenSettings: () => setSettingsOpen(true),
    applyCloudTask,
    refreshWorks,
    refreshMyWorks,
  })
  useAppLifecycle({
    accessPassword: settings.accessPassword,
    unlocked,
    meId: me?.id,
    profileUserId,
    workSort,
    workOffset,
    restoreActiveBackgroundTasks,
    resetForLock,
    resetForNoUser,
    refreshCurrentUser,
    refreshWorks,
    refreshMyWorks,
    refreshMyFavorites,
    refreshProfile,
  })

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

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
            onLogin={async (username, password) => {
              await loginWithSession(username, password)
              await refreshWorks()
            }}
            onRegister={async (username, password) => {
              await registerWithSession(username, password)
              await refreshWorks()
            }}
            onLogout={async () => {
              await logoutWithSession()
              resetForLock()
              await refreshWorks()
            }}
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
