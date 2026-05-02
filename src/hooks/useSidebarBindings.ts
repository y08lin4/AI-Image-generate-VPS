import { type ComponentProps, useMemo } from 'react'
import { GenerateSidebar } from '../components/GenerateSidebar'
import type {
  AppFlowAppDomain,
  AppFlowAuthDomain,
  AppFlowGenerationDomain,
  AppFlowSettingsDomain,
} from './useAppDataFlow'
import { useAuthHandlers } from './useAuthHandlers'

type SidebarProps = ComponentProps<typeof GenerateSidebar>

interface UseSidebarBindingsOptions {
  app: AppFlowAppDomain
  auth: AppFlowAuthDomain
  generation: AppFlowGenerationDomain
  settings: AppFlowSettingsDomain
}

export function useSidebarBindings({
  app,
  auth,
  generation,
  settings,
}: UseSidebarBindingsOptions): SidebarProps {
  const { handleAuthLogin, handleAuthRegister, handleAuthLogout } = useAuthHandlers({
    loginWithSession: auth.loginWithSession,
    registerWithSession: auth.registerWithSession,
    logoutWithSession: auth.logoutWithSession,
    resetForLock: auth.resetForLock,
    refreshWorks: auth.refreshWorks,
  })

  return useMemo(() => ({
    mode: generation.mode,
    prompt: generation.prompt,
    inputImages: generation.inputImages,
    settings: settings.settings,
    ratio: settings.ratio,
    resolution: settings.resolution,
    size: generation.size,
    me: auth.me,
    authLoading: auth.worksLoading,
    onModeChange: generation.setMode,
    onPromptChange: generation.setPrompt,
    onInputImagesChange: generation.setInputImages,
    onInputImageError: (text) => app.showMessage(text, 'error'),
    onPatchSettings: settings.patchSettings,
    onRatioChange: settings.setRatio,
    onResolutionChange: settings.setResolution,
    onGenerate: generation.handleGenerate,
    onLogin: handleAuthLogin,
    onRegister: handleAuthRegister,
    onLogout: handleAuthLogout,
  }), [
    generation.mode,
    generation.prompt,
    generation.inputImages,
    settings.settings,
    settings.ratio,
    settings.resolution,
    generation.size,
    auth.me,
    auth.worksLoading,
    generation.setMode,
    generation.setPrompt,
    generation.setInputImages,
    app.showMessage,
    settings.patchSettings,
    settings.setRatio,
    settings.setResolution,
    generation.handleGenerate,
    handleAuthLogin,
    handleAuthRegister,
    handleAuthLogout,
  ])
}
