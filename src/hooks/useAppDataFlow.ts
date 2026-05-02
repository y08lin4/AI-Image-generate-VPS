import { useCallback, useEffect, useRef, useState } from 'react'
import { type ToastMessage } from '../components/MessageToast'
import { useBackgroundTasks } from './useBackgroundTasks'
import { useGenerationTasks } from './useGenerationTasks'
import { useAccessSession } from './useAccessSession'
import { useAppLifecycle } from './useAppLifecycle'
import { useAppSettings } from './useAppSettings'
import { useGenerateComposer } from './useGenerateComposer'
import { useHistoryHub } from './useHistoryHub'
import { useTaskActions } from './useTaskActions'
import { useWorksHub } from './useWorksHub'
import { getImageSize } from '../lib/ratios'

export function useAppDataFlow() {
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

  return {
    settings,
    settingsOpen,
    ratio,
    resolution,
    setSettingsOpen,
    setRatio,
    setResolution,
    updateSettings,
    patchSettings,
    message,
    setMessage,
    showMessage,
    adminOpen,
    setAdminOpen,
    history,
    historyCollapsed,
    handleDeleteHistory,
    handleClearHistory,
    toggleHistoryCollapsed,
    me,
    unlocked,
    unlocking,
    handleUnlock,
    handleAccessPasswordUpdated,
    loginWithSession,
    registerWithSession,
    logoutWithSession,
    worksLoading,
    mode,
    setMode,
    prompt,
    setPrompt,
    inputImages,
    setInputImages,
    size,
    handleGenerate,
    handleUseAsReference,
    reusePrompt,
    works,
    myWorks,
    favoriteWorks,
    myWorksLoading,
    favoriteWorksLoading,
    workSort,
    workOffset,
    workTotal,
    refreshWorks,
    resetForLock,
    handleRefreshSquare,
    handleChangeWorkSort,
    handleChangeWorkPage,
    handleToggleLike,
    handleToggleFavorite,
    handleOpenComments,
    handleOpenUserProfile,
    handleDeleteMyWork,
    tasks,
    handleUploadImage,
    removeTask,
    clearFinishedTasks,
    syncCloudTasks,
    backgroundStats,
    syncingCloudTasks,
    handlePublishWork,
    handleRetryBackgroundTask,
    handleShowHistoryInResults,
    activeCommentWork,
    workComments,
    workCommentsTotal,
    workCommentsLoading,
    closeComments,
    refreshWorkComments,
    handleCreateComment,
    handleDeleteComment,
    profileUserId,
    profileData,
    profileWorks,
    profileLoading,
    closeProfile,
  }
}

export type AppDataFlow = ReturnType<typeof useAppDataFlow>
