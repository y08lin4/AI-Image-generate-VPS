import { type ComponentProps, useMemo } from 'react'
import { CanvasWorkspace } from '../components/CanvasWorkspace'
import type { AppDataFlow } from './useAppDataFlow'
import { useWorkspaceProps } from './useWorkspaceProps'

type CanvasProps = ComponentProps<typeof CanvasWorkspace>

export function useCanvasBindings(flow: AppDataFlow): CanvasProps {
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

  return useMemo(() => ({
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
}
