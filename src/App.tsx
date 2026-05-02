import { useCallback, useEffect, useRef, useState } from 'react'
import { AppOverlays } from './components/AppOverlays'
import { AppTopbar } from './components/AppTopbar'
import { CanvasWorkspace } from './components/CanvasWorkspace'
import { AccessGate } from './components/AccessGate'
import { GenerateSidebar } from './components/GenerateSidebar'
import { HistoryPanel } from './components/HistoryPanel'
import { MessageToast, type ToastMessage } from './components/MessageToast'
import { useBackgroundTasks } from './hooks/useBackgroundTasks'
import { useGenerationTasks } from './hooks/useGenerationTasks'
import { useAccessSession } from './hooks/useAccessSession'
import { useAuthHandlers } from './hooks/useAuthHandlers'
import { useAppLifecycle } from './hooks/useAppLifecycle'
import { useAppSettings } from './hooks/useAppSettings'
import { useGenerateComposer } from './hooks/useGenerateComposer'
import { useHistoryHub } from './hooks/useHistoryHub'
import { useOverlayProps } from './hooks/useOverlayProps'
import { useTaskActions } from './hooks/useTaskActions'
import { useWorkspaceProps } from './hooks/useWorkspaceProps'
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

  const { handleAuthLogin, handleAuthRegister, handleAuthLogout } = useAuthHandlers({
    loginWithSession,
    registerWithSession,
    logoutWithSession,
    resetForLock,
    refreshWorks,
  })

  const { worksProps, taskQueueProps } = useWorkspaceProps({
    works,
    myWorks,
    favoriteWorks,
    me,
    worksLoading,
    myWorksLoading,
    favoriteWorksLoading,
    workSort,
    workOffset,
    workTotal,
    onRefreshSquare: handleRefreshSquare,
    onChangeWorkSort: handleChangeWorkSort,
    onChangeWorkPage: handleChangeWorkPage,
    onToggleLike: (work) => void handleToggleLike(work),
    onToggleFavorite: (work) => void handleToggleFavorite(work),
    onOpenComments: (work) => void handleOpenComments(work),
    onOpenUserProfile: (userId) => handleOpenUserProfile(userId),
    onDeleteMyWork: (work) => void handleDeleteMyWork(work),
    tasks,
    onUploadImage: handleUploadImage,
    onPublishWork: (taskId, result) => void handlePublishWork(taskId, result),
    onUseAsReference: handleUseAsReference,
    onMessage: showMessage,
    onRemoveTask: removeTask,
    onClearFinishedTasks: clearFinishedTasks,
    onSyncCloudTasks: syncCloudTasks,
    onRetryBackgroundTask: (taskId) => void handleRetryBackgroundTask(taskId),
    backgroundStats,
    syncingCloudTasks,
  })

  const overlayProps = useOverlayProps({
    settingsModalProps: {
      open: settingsOpen,
      settings,
      onClose: () => setSettingsOpen(false),
      onSave: updateSettings,
      onMessage: showMessage,
    },
    adminModalProps: {
      open: adminOpen,
      onClose: () => setAdminOpen(false),
      onMessage: showMessage,
      onAccessPasswordUpdated: handleAccessPasswordUpdated,
    },
    commentsModalProps: {
      open: Boolean(activeCommentWork),
      work: activeCommentWork,
      comments: workComments,
      total: workCommentsTotal,
      loading: workCommentsLoading,
      me,
      onClose: closeComments,
      onRefresh: (workId) => void refreshWorkComments(workId, true),
      onCreate: (content) => void handleCreateComment(content),
      onDelete: (commentId) => void handleDeleteComment(commentId),
    },
    profileModalProps: {
      open: Boolean(profileUserId),
      profile: profileData,
      works: profileWorks,
      loading: profileLoading,
      me,
      onClose: closeProfile,
      onOpenComments: (work) => {
        closeProfile()
        void handleOpenComments(work)
      },
      onToggleLike: (work) => void handleToggleLike(work),
      onToggleFavorite: (work) => void handleToggleFavorite(work),
    },
  })

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

      <AppOverlays {...overlayProps} />
    </div>
  )
}
