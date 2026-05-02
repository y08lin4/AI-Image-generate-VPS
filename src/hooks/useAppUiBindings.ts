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
    loginWithSession: flow.auth.loginWithSession,
    registerWithSession: flow.auth.registerWithSession,
    logoutWithSession: flow.auth.logoutWithSession,
    resetForLock: flow.auth.resetForLock,
    refreshWorks: flow.auth.refreshWorks,
  })

  const { worksProps, taskQueueProps } = useWorkspaceProps({
    works: flow.workspace.works,
    myWorks: flow.workspace.myWorks,
    favoriteWorks: flow.workspace.favoriteWorks,
    me: flow.auth.me,
    worksLoading: flow.auth.worksLoading,
    myWorksLoading: flow.workspace.myWorksLoading,
    favoriteWorksLoading: flow.workspace.favoriteWorksLoading,
    workSort: flow.workspace.workSort,
    workOffset: flow.workspace.workOffset,
    workTotal: flow.workspace.workTotal,
    onRefreshSquare: flow.workspace.handleRefreshSquare,
    onChangeWorkSort: flow.workspace.handleChangeWorkSort,
    onChangeWorkPage: flow.workspace.handleChangeWorkPage,
    onToggleLike: (work) => void flow.workspace.handleToggleLike(work),
    onToggleFavorite: (work) => void flow.workspace.handleToggleFavorite(work),
    onOpenComments: (work) => void flow.workspace.handleOpenComments(work),
    onOpenUserProfile: (userId) => flow.workspace.handleOpenUserProfile(userId),
    onDeleteMyWork: (work) => void flow.workspace.handleDeleteMyWork(work),
    tasks: flow.tasks.tasks,
    onUploadImage: flow.tasks.handleUploadImage,
    onPublishWork: (taskId, result) => void flow.tasks.handlePublishWork(taskId, result),
    onUseAsReference: flow.generation.handleUseAsReference,
    onMessage: flow.app.showMessage,
    onRemoveTask: flow.tasks.removeTask,
    onClearFinishedTasks: flow.tasks.clearFinishedTasks,
    onSyncCloudTasks: flow.tasks.syncCloudTasks,
    onRetryBackgroundTask: (taskId) => void flow.tasks.handleRetryBackgroundTask(taskId),
    backgroundStats: flow.tasks.backgroundStats,
    syncingCloudTasks: flow.tasks.syncingCloudTasks,
  })

  const overlayProps = useOverlayProps({
    settingsModalProps: {
      open: flow.settings.settingsOpen,
      settings: flow.settings.settings,
      onClose: () => flow.settings.setSettingsOpen(false),
      onSave: flow.settings.updateSettings,
      onMessage: flow.app.showMessage,
    },
    adminModalProps: {
      open: flow.app.adminOpen,
      onClose: () => flow.app.setAdminOpen(false),
      onMessage: flow.app.showMessage,
      onAccessPasswordUpdated: flow.auth.handleAccessPasswordUpdated,
    },
    commentsModalProps: {
      open: Boolean(flow.comments.activeCommentWork),
      work: flow.comments.activeCommentWork,
      comments: flow.comments.workComments,
      total: flow.comments.workCommentsTotal,
      loading: flow.comments.workCommentsLoading,
      me: flow.auth.me,
      onClose: flow.comments.closeComments,
      onRefresh: (workId) => void flow.comments.refreshWorkComments(workId, true),
      onCreate: (content) => void flow.comments.handleCreateComment(content),
      onDelete: (commentId) => void flow.comments.handleDeleteComment(commentId),
    },
    profileModalProps: {
      open: Boolean(flow.profile.profileUserId),
      profile: flow.profile.profileData,
      works: flow.profile.profileWorks,
      loading: flow.profile.profileLoading,
      me: flow.auth.me,
      onClose: flow.profile.closeProfile,
      onOpenComments: (work) => {
        flow.profile.closeProfile()
        void flow.workspace.handleOpenComments(work)
      },
      onToggleLike: (work) => void flow.workspace.handleToggleLike(work),
      onToggleFavorite: (work) => void flow.workspace.handleToggleFavorite(work),
    },
  })

  const topbarProps: TopbarProps = useMemo(() => ({
    baseUrl: flow.settings.settings.baseUrl,
    requestMode: flow.settings.settings.requestMode,
    onOpenAdmin: () => flow.app.setAdminOpen(true),
    onOpenSettings: () => flow.settings.setSettingsOpen(true),
  }), [flow.settings.settings.baseUrl, flow.settings.settings.requestMode, flow.app.setAdminOpen, flow.settings.setSettingsOpen])

  const toastProps: ToastProps = useMemo(() => ({
    message: flow.app.message,
    onClose: () => flow.app.setMessage(null),
  }), [flow.app.message, flow.app.setMessage])

  const sidebarProps: SidebarProps = useMemo(() => ({
    mode: flow.generation.mode,
    prompt: flow.generation.prompt,
    inputImages: flow.generation.inputImages,
    settings: flow.settings.settings,
    ratio: flow.settings.ratio,
    resolution: flow.settings.resolution,
    size: flow.generation.size,
    me: flow.auth.me,
    authLoading: flow.auth.worksLoading,
    onModeChange: flow.generation.setMode,
    onPromptChange: flow.generation.setPrompt,
    onInputImagesChange: flow.generation.setInputImages,
    onInputImageError: (text) => flow.app.showMessage(text, 'error'),
    onPatchSettings: flow.settings.patchSettings,
    onRatioChange: flow.settings.setRatio,
    onResolutionChange: flow.settings.setResolution,
    onGenerate: flow.generation.handleGenerate,
    onLogin: handleAuthLogin,
    onRegister: handleAuthRegister,
    onLogout: handleAuthLogout,
  }), [
    flow.generation.mode,
    flow.generation.prompt,
    flow.generation.inputImages,
    flow.settings.settings,
    flow.settings.ratio,
    flow.settings.resolution,
    flow.generation.size,
    flow.auth.me,
    flow.auth.worksLoading,
    flow.generation.setMode,
    flow.generation.setPrompt,
    flow.generation.setInputImages,
    flow.app.showMessage,
    flow.settings.patchSettings,
    flow.settings.setRatio,
    flow.settings.setResolution,
    flow.generation.handleGenerate,
    handleAuthLogin,
    handleAuthRegister,
    handleAuthLogout,
  ])

  const canvasProps: CanvasProps = useMemo(() => ({
    mode: flow.generation.mode,
    ratio: flow.settings.ratio,
    resolution: flow.settings.resolution,
    size: flow.generation.size,
    requestMode: flow.settings.settings.requestMode,
    concurrency: flow.settings.settings.concurrency,
    worksProps,
    taskQueueProps,
  }), [
    flow.generation.mode,
    flow.settings.ratio,
    flow.settings.resolution,
    flow.generation.size,
    flow.settings.settings.requestMode,
    flow.settings.settings.concurrency,
    worksProps,
    taskQueueProps,
  ])

  const historyProps: HistoryProps = useMemo(() => ({
    items: flow.history.history,
    collapsed: flow.history.historyCollapsed,
    onToggleCollapsed: flow.history.toggleHistoryCollapsed,
    onReusePrompt: flow.history.reusePrompt,
    onUseImage: flow.history.handleUseAsReference,
    onShowInResults: flow.history.handleShowHistoryInResults,
    onDelete: flow.history.handleDeleteHistory,
    onClear: flow.history.handleClearHistory,
    onMessage: flow.app.showMessage,
  }), [
    flow.history.history,
    flow.history.historyCollapsed,
    flow.history.toggleHistoryCollapsed,
    flow.history.reusePrompt,
    flow.history.handleUseAsReference,
    flow.history.handleShowHistoryInResults,
    flow.history.handleDeleteHistory,
    flow.history.handleClearHistory,
    flow.app.showMessage,
  ])

  return {
    unlocked: flow.app.unlocked,
    unlocking: flow.app.unlocking,
    accessPassword: flow.app.accessPassword,
    handleUnlock: flow.app.handleUnlock,
    topbarProps,
    toastProps,
    workspaceClassName: `workspace ${flow.history.historyCollapsed ? 'history-collapsed' : ''}`,
    sidebarProps,
    canvasProps,
    historyProps,
    overlayProps,
  }
}
