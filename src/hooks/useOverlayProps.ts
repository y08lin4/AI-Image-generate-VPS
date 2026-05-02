import { type ComponentProps, useMemo } from 'react'
import { AppOverlays } from '../components/AppOverlays'

type OverlayProps = ComponentProps<typeof AppOverlays>

interface UseOverlayPropsOptions {
  settingsModalProps: OverlayProps['settingsModalProps']
  adminModalProps: OverlayProps['adminModalProps']
  commentsModalProps: OverlayProps['commentsModalProps']
  profileModalProps: OverlayProps['profileModalProps']
}

export function useOverlayProps({
  settingsModalProps,
  adminModalProps,
  commentsModalProps,
  profileModalProps,
}: UseOverlayPropsOptions) {
  return useMemo<OverlayProps>(() => ({
    settingsModalProps,
    adminModalProps,
    commentsModalProps,
    profileModalProps,
  }), [settingsModalProps, adminModalProps, commentsModalProps, profileModalProps])
}
