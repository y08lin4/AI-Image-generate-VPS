import { useCallback, useEffect, useRef, useState } from 'react'
import { AppTopbar } from './components/AppTopbar'
import { CanvasWorkspace } from './components/CanvasWorkspace'
import { SettingsModal } from './components/SettingsModal'
import { AccessGate } from './components/AccessGate'
import { AdminModal } from './components/AdminModal'
import { GenerateSidebar } from './components/GenerateSidebar'
import { HistoryPanel } from './components/HistoryPanel'
import { MessageToast, type ToastMessage } from './components/MessageToast'
import { WorkCommentsModal } from './components/WorkCommentsModal'
import { UserProfileModal } from './components/UserProfileModal'
import { WORK_LIST_PAGE_SIZE } from './lib/appTask'
import { useBackgroundTasks } from './hooks/useBackgroundTasks'
import { useGenerationTasks } from './hooks/useGenerationTasks'
import { useAccessSession } from './hooks/useAccessSession'
import { useAppLifecycle } from './hooks/useAppLifecycle'
import { useAppSettings } from './hooks/useAppSettings'
import { useGenerateComposer } from './hooks/useGenerateComposer'
import { useHistoryHub } from './hooks/useHistoryHub'
import { useTaskActions } from './hooks/useTaskActions'
import { useWorksHub } from './hooks/useWorksHub'
import { getImageSize } from './lib/ratios'
import './styles.css'

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
  const [message, setMessage] = useState<ToastMessage | null>(null)
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

  const worksProps = {
    works,
    myWorks,
    favoriteWorks,
    me,
    loading: worksLoading,
    myWorksLoading,
    favoriteWorksLoading,
    sort: workSort,
    offset: workOffset,
    total: workTotal,
    pageSize: WORK_LIST_PAGE_SIZE,
    onRefresh: () => void handleRefreshSquare(),
    onSortChange: handleChangeWorkSort,
    onPageChange: handleChangeWorkPage,
    onToggleLike: (work: typeof works[number]) => void handleToggleLike(work),
    onToggleFavorite: (work: typeof works[number]) => void handleToggleFavorite(work),
    onOpenComments: (work: typeof works[number]) => void handleOpenComments(work),
    onOpenUserProfile: (userId: number) => handleOpenUserProfile(userId),
    onDeleteMyWork: (work: typeof works[number]) => void handleDeleteMyWork(work),
  }

  const taskQueueProps = {
    tasks,
    onUploadImage: handleUploadImage,
    onPublishWork: (taskId: string, result: typeof tasks[number]['results'][number]) => void handlePublishWork(taskId, result),
    onUseAsReference: handleUseAsReference,
    onMessage: showMessage,
    onRemove: removeTask,
    onClearFinished: clearFinishedTasks,
    onSyncCloudTasks: () => void syncCloudTasks(),
    onRetryBackgroundTask: (taskId: string) => void handleRetryBackgroundTask(taskId),
    backgroundStats,
    syncingCloudTasks,
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
      <AppTopbar
        baseUrl={settings.baseUrl}
        requestMode={settings.requestMode}
        onOpenAdmin={() => setAdminOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <MessageToast message={message} onClose={() => setMessage(null)} />

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

        <CanvasWorkspace
          mode={mode}
          ratio={ratio}
          resolution={resolution}
          size={size}
          requestMode={settings.requestMode}
          concurrency={settings.concurrency}
          worksProps={worksProps}
          taskQueueProps={taskQueueProps}
        />

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
