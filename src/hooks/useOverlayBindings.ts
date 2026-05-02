import type { ComponentProps } from 'react'
import { AppOverlays } from '../components/AppOverlays'
import type { AppDataFlow } from './useAppDataFlow'
import { useOverlayProps } from './useOverlayProps'

type OverlayProps = ComponentProps<typeof AppOverlays>

export function useOverlayBindings(flow: AppDataFlow): OverlayProps {
  return useOverlayProps({
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
}
