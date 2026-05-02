import { type ComponentProps, useMemo } from 'react'
import { AppOverlays } from '../components/AppOverlays'
import { AppTopbar } from '../components/AppTopbar'
import { CanvasWorkspace } from '../components/CanvasWorkspace'
import { GenerateSidebar } from '../components/GenerateSidebar'
import { HistoryPanel } from '../components/HistoryPanel'
import { MessageToast } from '../components/MessageToast'
import type { AppDataFlow } from './useAppDataFlow'
import { useAuthHandlers } from './useAuthHandlers'
import { useOverlayProps } from './useOverlayProps'
import { useWorkspaceProps } from './useWorkspaceProps'

type TopbarProps = ComponentProps<typeof AppTopbar>
type ToastProps = ComponentProps<typeof MessageToast>
type SidebarProps = ComponentProps<typeof GenerateSidebar>
type CanvasProps = ComponentProps<typeof CanvasWorkspace>
type HistoryProps = ComponentProps<typeof HistoryPanel>

export function useAppUiBindings(flow: AppDataFlow) {
  const { handleAuthLogin, handleAuthRegister, handleAuthLogout } = useAuthHandlers({
    loginWithSession: flow.loginWithSession,
    registerWithSession: flow.registerWithSession,
    logoutWithSession: flow.logoutWithSession,
    resetForLock: flow.resetForLock,
    refreshWorks: flow.refreshWorks,
  })

  const { worksProps, taskQueueProps } = useWorkspaceProps({
    works: flow.works,
    myWorks: flow.myWorks,
    favoriteWorks: flow.favoriteWorks,
    me: flow.me,
    worksLoading: flow.worksLoading,
    myWorksLoading: flow.myWorksLoading,
    favoriteWorksLoading: flow.favoriteWorksLoading,
    workSort: flow.workSort,
    workOffset: flow.workOffset,
    workTotal: flow.workTotal,
    onRefreshSquare: flow.handleRefreshSquare,
    onChangeWorkSort: flow.handleChangeWorkSort,
    onChangeWorkPage: flow.handleChangeWorkPage,
    onToggleLike: (work) => void flow.handleToggleLike(work),
    onToggleFavorite: (work) => void flow.handleToggleFavorite(work),
    onOpenComments: (work) => void flow.handleOpenComments(work),
    onOpenUserProfile: (userId) => flow.handleOpenUserProfile(userId),
    onDeleteMyWork: (work) => void flow.handleDeleteMyWork(work),
    tasks: flow.tasks,
    onUploadImage: flow.handleUploadImage,
    onPublishWork: (taskId, result) => void flow.handlePublishWork(taskId, result),
    onUseAsReference: flow.handleUseAsReference,
    onMessage: flow.showMessage,
    onRemoveTask: flow.removeTask,
    onClearFinishedTasks: flow.clearFinishedTasks,
    onSyncCloudTasks: flow.syncCloudTasks,
    onRetryBackgroundTask: (taskId) => void flow.handleRetryBackgroundTask(taskId),
    backgroundStats: flow.backgroundStats,
    syncingCloudTasks: flow.syncingCloudTasks,
  })

  const overlayProps = useOverlayProps({
    settingsModalProps: {
      open: flow.settingsOpen,
      settings: flow.settings,
      onClose: () => flow.setSettingsOpen(false),
      onSave: flow.updateSettings,
      onMessage: flow.showMessage,
    },
    adminModalProps: {
      open: flow.adminOpen,
      onClose: () => flow.setAdminOpen(false),
      onMessage: flow.showMessage,
      onAccessPasswordUpdated: flow.handleAccessPasswordUpdated,
    },
    commentsModalProps: {
      open: Boolean(flow.activeCommentWork),
      work: flow.activeCommentWork,
      comments: flow.workComments,
      total: flow.workCommentsTotal,
      loading: flow.workCommentsLoading,
      me: flow.me,
      onClose: flow.closeComments,
      onRefresh: (workId) => void flow.refreshWorkComments(workId, true),
      onCreate: (content) => void flow.handleCreateComment(content),
      onDelete: (commentId) => void flow.handleDeleteComment(commentId),
    },
    profileModalProps: {
      open: Boolean(flow.profileUserId),
      profile: flow.profileData,
      works: flow.profileWorks,
      loading: flow.profileLoading,
      me: flow.me,
      onClose: flow.closeProfile,
      onOpenComments: (work) => {
        flow.closeProfile()
        void flow.handleOpenComments(work)
      },
      onToggleLike: (work) => void flow.handleToggleLike(work),
      onToggleFavorite: (work) => void flow.handleToggleFavorite(work),
    },
  })

  const topbarProps: TopbarProps = useMemo(() => ({
    baseUrl: flow.settings.baseUrl,
    requestMode: flow.settings.requestMode,
    onOpenAdmin: () => flow.setAdminOpen(true),
    onOpenSettings: () => flow.setSettingsOpen(true),
  }), [flow.settings.baseUrl, flow.settings.requestMode, flow.setAdminOpen, flow.setSettingsOpen])

  const toastProps: ToastProps = useMemo(() => ({
    message: flow.message,
    onClose: () => flow.setMessage(null),
  }), [flow.message, flow.setMessage])

  const sidebarProps: SidebarProps = useMemo(() => ({
    mode: flow.mode,
    prompt: flow.prompt,
    inputImages: flow.inputImages,
    settings: flow.settings,
    ratio: flow.ratio,
    resolution: flow.resolution,
    size: flow.size,
    me: flow.me,
    authLoading: flow.worksLoading,
    onModeChange: flow.setMode,
    onPromptChange: flow.setPrompt,
    onInputImagesChange: flow.setInputImages,
    onInputImageError: (text) => flow.showMessage(text, 'error'),
    onPatchSettings: flow.patchSettings,
    onRatioChange: flow.setRatio,
    onResolutionChange: flow.setResolution,
    onGenerate: flow.handleGenerate,
    onLogin: handleAuthLogin,
    onRegister: handleAuthRegister,
    onLogout: handleAuthLogout,
  }), [
    flow.mode,
    flow.prompt,
    flow.inputImages,
    flow.settings,
    flow.ratio,
    flow.resolution,
    flow.size,
    flow.me,
    flow.worksLoading,
    flow.setMode,
    flow.setPrompt,
    flow.setInputImages,
    flow.showMessage,
    flow.patchSettings,
    flow.setRatio,
    flow.setResolution,
    flow.handleGenerate,
    handleAuthLogin,
    handleAuthRegister,
    handleAuthLogout,
  ])

  const canvasProps: CanvasProps = useMemo(() => ({
    mode: flow.mode,
    ratio: flow.ratio,
    resolution: flow.resolution,
    size: flow.size,
    requestMode: flow.settings.requestMode,
    concurrency: flow.settings.concurrency,
    worksProps,
    taskQueueProps,
  }), [
    flow.mode,
    flow.ratio,
    flow.resolution,
    flow.size,
    flow.settings.requestMode,
    flow.settings.concurrency,
    worksProps,
    taskQueueProps,
  ])

  const historyProps: HistoryProps = useMemo(() => ({
    items: flow.history,
    collapsed: flow.historyCollapsed,
    onToggleCollapsed: flow.toggleHistoryCollapsed,
    onReusePrompt: flow.reusePrompt,
    onUseImage: flow.handleUseAsReference,
    onShowInResults: flow.handleShowHistoryInResults,
    onDelete: flow.handleDeleteHistory,
    onClear: flow.handleClearHistory,
    onMessage: flow.showMessage,
  }), [
    flow.history,
    flow.historyCollapsed,
    flow.toggleHistoryCollapsed,
    flow.reusePrompt,
    flow.handleUseAsReference,
    flow.handleShowHistoryInResults,
    flow.handleDeleteHistory,
    flow.handleClearHistory,
    flow.showMessage,
  ])

  return {
    unlocked: flow.unlocked,
    unlocking: flow.unlocking,
    accessPassword: flow.settings.accessPassword,
    handleUnlock: flow.handleUnlock,
    topbarProps,
    toastProps,
    workspaceClassName: `workspace ${flow.historyCollapsed ? 'history-collapsed' : ''}`,
    sidebarProps,
    canvasProps,
    historyProps,
    overlayProps,
  }
}
