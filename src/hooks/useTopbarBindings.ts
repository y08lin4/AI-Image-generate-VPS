import { type ComponentProps, useMemo } from 'react'
import { AppTopbar } from '../components/AppTopbar'
import type { AppFlowAppDomain, AppFlowSettingsDomain } from './useAppDataFlow'

type TopbarProps = ComponentProps<typeof AppTopbar>

interface UseTopbarBindingsOptions {
  app: AppFlowAppDomain
  settings: AppFlowSettingsDomain
}

export function useTopbarBindings({ app, settings }: UseTopbarBindingsOptions): TopbarProps {
  return useMemo(() => ({
    baseUrl: settings.settings.baseUrl,
    requestMode: settings.settings.requestMode,
    onOpenAdmin: () => app.setAdminOpen(true),
    onOpenSettings: () => settings.setSettingsOpen(true),
  }), [settings.settings.baseUrl, settings.settings.requestMode, app.setAdminOpen, settings.setSettingsOpen])
}
