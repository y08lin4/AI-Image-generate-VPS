import { type ComponentProps, useMemo } from 'react'
import { MessageToast } from '../components/MessageToast'
import type { AppDataFlow } from './useAppDataFlow'

type ToastProps = ComponentProps<typeof MessageToast>

export function useToastBindings(flow: AppDataFlow): ToastProps {
  return useMemo(() => ({
    message: flow.app.message,
    onClose: () => flow.app.setMessage(null),
  }), [flow.app.message, flow.app.setMessage])
}
