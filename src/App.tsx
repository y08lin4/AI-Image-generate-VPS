import { useCallback, useEffect, useRef, useState } from 'react'
import { SettingsModal } from './components/SettingsModal'
import { AccessGate } from './components/AccessGate'
import { AdminModal } from './components/AdminModal'
import { GenerateSidebar } from './components/GenerateSidebar'
import { HistoryPanel } from './components/HistoryPanel'
import { TaskQueue } from './components/TaskQueue'
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
import { getImageSize, getResolutionLabel } from './lib/ratios'
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

  const handleAuthLogin = useCallback(async (username: string, password: string) => {
    await loginWithSession(username, password)
    await refreshWorks()
  }, [loginWithSession, refreshWorks])

  const handleAuthRegister = useCallback(async (username: string, password: string) => {
    await registerWithSession(username, password)
    await refreshWorks()
  }, [registerWithSession, refreshWorks])

  const handleAuthLogout = useCallback(async () => {
    await logoutWithSession()
    resetForLock()
    await refreshWorks()
  }, [logoutWithSession, resetForLock, refreshWorks])

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
        <GenerateSidebar
          mode={mode}
          prompt={prompt}
          inputImages={inputImages}
          settings={settings}
          ratio={ratio}
          resolution={resolution}
          size={size}
          me={me}
          authLoading={worksLoading}
          onModeChange={setMode}
          onPromptChange={setPrompt}
          onInputImagesChange={setInputImages}
          onInputImageError={(text) => showMessage(text, 'error')}
          onPatchSettings={patchSettings}
          onRatioChange={setRatio}
          onResolutionChange={setResolution}
          onGenerate={handleGenerate}
          onLogin={handleAuthLogin}
          onRegister={handleAuthRegister}
          onLogout={handleAuthLogout}
        />

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
