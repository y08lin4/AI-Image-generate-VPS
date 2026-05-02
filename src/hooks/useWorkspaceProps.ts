import { type ComponentProps, useMemo } from 'react'
import { WORK_LIST_PAGE_SIZE } from '../lib/appTask'
import { TaskQueue } from '../components/TaskQueue'
import { WorksSquare } from '../components/WorksSquare'

type WorksSquareProps = ComponentProps<typeof WorksSquare>
type TaskQueueProps = ComponentProps<typeof TaskQueue>

interface UseWorkspacePropsOptions {
  works: WorksSquareProps['works']
  myWorks: WorksSquareProps['myWorks']
  favoriteWorks: WorksSquareProps['favoriteWorks']
  me: WorksSquareProps['me']
  worksLoading: WorksSquareProps['loading']
  myWorksLoading: WorksSquareProps['myWorksLoading']
  favoriteWorksLoading: WorksSquareProps['favoriteWorksLoading']
  workSort: WorksSquareProps['sort']
  workOffset: WorksSquareProps['offset']
  workTotal: WorksSquareProps['total']
  onRefreshSquare: () => Promise<void>
  onChangeWorkSort: WorksSquareProps['onSortChange']
  onChangeWorkPage: WorksSquareProps['onPageChange']
  onToggleLike: WorksSquareProps['onToggleLike']
  onToggleFavorite: WorksSquareProps['onToggleFavorite']
  onOpenComments: WorksSquareProps['onOpenComments']
  onOpenUserProfile: WorksSquareProps['onOpenUserProfile']
  onDeleteMyWork: WorksSquareProps['onDeleteMyWork']
  tasks: TaskQueueProps['tasks']
  onUploadImage: TaskQueueProps['onUploadImage']
  onPublishWork: TaskQueueProps['onPublishWork']
  onUseAsReference: TaskQueueProps['onUseAsReference']
  onMessage: TaskQueueProps['onMessage']
  onRemoveTask: TaskQueueProps['onRemove']
  onClearFinishedTasks: TaskQueueProps['onClearFinished']
  onSyncCloudTasks: () => Promise<void>
  onRetryBackgroundTask: TaskQueueProps['onRetryBackgroundTask']
  backgroundStats: TaskQueueProps['backgroundStats']
  syncingCloudTasks: TaskQueueProps['syncingCloudTasks']
}

export function useWorkspaceProps({
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
  onRefreshSquare,
  onChangeWorkSort,
  onChangeWorkPage,
  onToggleLike,
  onToggleFavorite,
  onOpenComments,
  onOpenUserProfile,
  onDeleteMyWork,
  tasks,
  onUploadImage,
  onPublishWork,
  onUseAsReference,
  onMessage,
  onRemoveTask,
  onClearFinishedTasks,
  onSyncCloudTasks,
  onRetryBackgroundTask,
  backgroundStats,
  syncingCloudTasks,
}: UseWorkspacePropsOptions) {
  const worksProps: WorksSquareProps = useMemo(() => ({
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
    onRefresh: () => void onRefreshSquare(),
    onSortChange: onChangeWorkSort,
    onPageChange: onChangeWorkPage,
    onToggleLike,
    onToggleFavorite,
    onOpenComments,
    onOpenUserProfile,
    onDeleteMyWork,
  }), [
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
    onRefreshSquare,
    onChangeWorkSort,
    onChangeWorkPage,
    onToggleLike,
    onToggleFavorite,
    onOpenComments,
    onOpenUserProfile,
    onDeleteMyWork,
  ])

  const taskQueueProps: TaskQueueProps = useMemo(() => ({
    tasks,
    onUploadImage,
    onPublishWork,
    onUseAsReference,
    onMessage,
    onRemove: onRemoveTask,
    onClearFinished: onClearFinishedTasks,
    onSyncCloudTasks: () => void onSyncCloudTasks(),
    onRetryBackgroundTask,
    backgroundStats,
    syncingCloudTasks,
  }), [
    tasks,
    onUploadImage,
    onPublishWork,
    onUseAsReference,
    onMessage,
    onRemoveTask,
    onClearFinishedTasks,
    onSyncCloudTasks,
    onRetryBackgroundTask,
    backgroundStats,
    syncingCloudTasks,
  ])

  return {
    worksProps,
    taskQueueProps,
  }
}
