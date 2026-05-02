import { type ComponentProps, useMemo } from 'react'
import { MessageToast } from '../components/MessageToast'
import type { AppFlowAppDomain } from './useAppDataFlow'

type ToastProps = ComponentProps<typeof MessageToast>

interface UseToastBindingsOptions {
  app: AppFlowAppDomain
}

export function useToastBindings({ app }: UseToastBindingsOptions): ToastProps {
  return useMemo(() => ({
    message: app.message,
    onClose: () => app.setMessage(null),
  }), [app.message, app.setMessage])
}
