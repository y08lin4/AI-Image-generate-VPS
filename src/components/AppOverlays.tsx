import type { ComponentProps } from 'react'
import { AdminModal } from './AdminModal'
import { SettingsModal } from './SettingsModal'
import { UserProfileModal } from './UserProfileModal'
import { WorkCommentsModal } from './WorkCommentsModal'

interface Props {
  settingsModalProps: ComponentProps<typeof SettingsModal>
  adminModalProps: ComponentProps<typeof AdminModal>
  commentsModalProps: ComponentProps<typeof WorkCommentsModal>
  profileModalProps: ComponentProps<typeof UserProfileModal>
}

export function AppOverlays({
  settingsModalProps,
  adminModalProps,
  commentsModalProps,
  profileModalProps,
}: Props) {
  return (
    <>
      <SettingsModal {...settingsModalProps} />
      <AdminModal {...adminModalProps} />
      <WorkCommentsModal {...commentsModalProps} />
      <UserProfileModal {...profileModalProps} />
    </>
  )
}
