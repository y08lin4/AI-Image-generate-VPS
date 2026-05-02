import { type ComponentProps, useMemo } from 'react'
import { AppTopbar } from '../components/AppTopbar'
import type { AppDataFlow } from './useAppDataFlow'

type TopbarProps = ComponentProps<typeof AppTopbar>

export function useTopbarBindings(flow: AppDataFlow): TopbarProps {
  return useMemo(() => ({
    baseUrl: flow.settings.settings.baseUrl,
    requestMode: flow.settings.settings.requestMode,
    onOpenAdmin: () => flow.app.setAdminOpen(true),
    onOpenSettings: () => flow.settings.setSettingsOpen(true),
  }), [flow.settings.settings.baseUrl, flow.settings.settings.requestMode, flow.app.setAdminOpen, flow.settings.setSettingsOpen])
}
