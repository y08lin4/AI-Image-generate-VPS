import { type ComponentProps, useMemo } from 'react'
import { CanvasWorkspace } from '../components/CanvasWorkspace'
import type {
  AppFlowAppDomain,
  AppFlowAuthDomain,
  AppFlowGenerationDomain,
  AppFlowSettingsDomain,
  AppFlowTasksDomain,
  AppFlowWorkspaceDomain,
} from './useAppDataFlow'
import { useWorkspaceProps } from './useWorkspaceProps'

type CanvasProps = ComponentProps<typeof CanvasWorkspace>

interface UseCanvasBindingsOptions {
  app: AppFlowAppDomain
  auth: AppFlowAuthDomain
  generation: AppFlowGenerationDomain
  settings: AppFlowSettingsDomain
  workspace: AppFlowWorkspaceDomain
  tasks: AppFlowTasksDomain
}

export function useCanvasBindings({
  app,
  auth,
  generation,
  settings,
  workspace,
  tasks,
}: UseCanvasBindingsOptions): CanvasProps {
  const { worksProps, taskQueueProps } = useWorkspaceProps({
    works: workspace.works,
    myWorks: workspace.myWorks,
    favoriteWorks: workspace.favoriteWorks,
    me: auth.me,
    worksLoading: auth.worksLoading,
    myWorksLoading: workspace.myWorksLoading,
    favoriteWorksLoading: workspace.favoriteWorksLoading,
    workSort: workspace.workSort,
    workOffset: workspace.workOffset,
    workTotal: workspace.workTotal,
    onRefreshSquare: workspace.handleRefreshSquare,
    onChangeWorkSort: workspace.handleChangeWorkSort,
    onChangeWorkPage: workspace.handleChangeWorkPage,
    onToggleLike: (work) => void workspace.handleToggleLike(work),
    onToggleFavorite: (work) => void workspace.handleToggleFavorite(work),
    onOpenComments: (work) => void workspace.handleOpenComments(work),
    onOpenUserProfile: (userId) => workspace.handleOpenUserProfile(userId),
    onDeleteMyWork: (work) => void workspace.handleDeleteMyWork(work),
    tasks: tasks.tasks,
    onUploadImage: tasks.handleUploadImage,
    onPublishWork: (taskId, result) => void tasks.handlePublishWork(taskId, result),
    onUseAsReference: generation.handleUseAsReference,
    onMessage: app.showMessage,
    onRemoveTask: tasks.removeTask,
    onClearFinishedTasks: tasks.clearFinishedTasks,
    onSyncCloudTasks: tasks.syncCloudTasks,
    onRetryBackgroundTask: (taskId) => void tasks.handleRetryBackgroundTask(taskId),
    backgroundStats: tasks.backgroundStats,
    syncingCloudTasks: tasks.syncingCloudTasks,
  })

  return useMemo(() => ({
    mode: generation.mode,
    ratio: settings.ratio,
    resolution: settings.resolution,
    size: generation.size,
    requestMode: settings.settings.requestMode,
    concurrency: settings.settings.concurrency,
    worksProps,
    taskQueueProps,
  }), [
    generation.mode,
    settings.ratio,
    settings.resolution,
    generation.size,
    settings.settings.requestMode,
    settings.settings.concurrency,
    worksProps,
    taskQueueProps,
  ])
}
