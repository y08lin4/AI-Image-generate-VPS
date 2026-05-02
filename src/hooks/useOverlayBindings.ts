import type { ComponentProps } from 'react'
import { AppOverlays } from '../components/AppOverlays'
import type {
  AppFlowAppDomain,
  AppFlowAuthDomain,
  AppFlowCommentsDomain,
  AppFlowProfileDomain,
  AppFlowSettingsDomain,
  AppFlowWorkspaceDomain,
} from './useAppDataFlow'
import { useOverlayProps } from './useOverlayProps'

type OverlayProps = ComponentProps<typeof AppOverlays>

interface UseOverlayBindingsOptions {
  app: AppFlowAppDomain
  settings: AppFlowSettingsDomain
  auth: AppFlowAuthDomain
  workspace: AppFlowWorkspaceDomain
  comments: AppFlowCommentsDomain
  profile: AppFlowProfileDomain
}

export function useOverlayBindings({
  app,
  settings,
  auth,
  workspace,
  comments,
  profile,
}: UseOverlayBindingsOptions): OverlayProps {
  return useOverlayProps({
    settingsModalProps: {
      open: settings.settingsOpen,
      settings: settings.settings,
      onClose: () => settings.setSettingsOpen(false),
      onSave: settings.updateSettings,
      onMessage: app.showMessage,
    },
    adminModalProps: {
      open: app.adminOpen,
      onClose: () => app.setAdminOpen(false),
      onMessage: app.showMessage,
      onAccessPasswordUpdated: auth.handleAccessPasswordUpdated,
    },
    commentsModalProps: {
      open: Boolean(comments.activeCommentWork),
      work: comments.activeCommentWork,
      comments: comments.workComments,
      total: comments.workCommentsTotal,
      loading: comments.workCommentsLoading,
      me: auth.me,
      onClose: comments.closeComments,
      onRefresh: (workId) => void comments.refreshWorkComments(workId, true),
      onCreate: (content) => void comments.handleCreateComment(content),
      onDelete: (commentId) => void comments.handleDeleteComment(commentId),
    },
    profileModalProps: {
      open: Boolean(profile.profileUserId),
      profile: profile.profileData,
      works: profile.profileWorks,
      loading: profile.profileLoading,
      me: auth.me,
      onClose: profile.closeProfile,
      onOpenComments: (work) => {
        profile.closeProfile()
        void workspace.handleOpenComments(work)
      },
      onToggleLike: (work) => void workspace.handleToggleLike(work),
      onToggleFavorite: (work) => void workspace.handleToggleFavorite(work),
    },
  })
}
