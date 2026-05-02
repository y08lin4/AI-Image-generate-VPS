import { type ComponentProps, useMemo } from 'react'
import { GenerateSidebar } from '../components/GenerateSidebar'
import type { AppDataFlow } from './useAppDataFlow'
import { useAuthHandlers } from './useAuthHandlers'

type SidebarProps = ComponentProps<typeof GenerateSidebar>

export function useSidebarBindings(flow: AppDataFlow): SidebarProps {
  const { handleAuthLogin, handleAuthRegister, handleAuthLogout } = useAuthHandlers({
    loginWithSession: flow.auth.loginWithSession,
    registerWithSession: flow.auth.registerWithSession,
    logoutWithSession: flow.auth.logoutWithSession,
    resetForLock: flow.auth.resetForLock,
    refreshWorks: flow.auth.refreshWorks,
  })

  return useMemo(() => ({
    mode: flow.generation.mode,
    prompt: flow.generation.prompt,
    inputImages: flow.generation.inputImages,
    settings: flow.settings.settings,
    ratio: flow.settings.ratio,
    resolution: flow.settings.resolution,
    size: flow.generation.size,
    me: flow.auth.me,
    authLoading: flow.auth.worksLoading,
    onModeChange: flow.generation.setMode,
    onPromptChange: flow.generation.setPrompt,
    onInputImagesChange: flow.generation.setInputImages,
    onInputImageError: (text) => flow.app.showMessage(text, 'error'),
    onPatchSettings: flow.settings.patchSettings,
    onRatioChange: flow.settings.setRatio,
    onResolutionChange: flow.settings.setResolution,
    onGenerate: flow.generation.handleGenerate,
    onLogin: handleAuthLogin,
    onRegister: handleAuthRegister,
    onLogout: handleAuthLogout,
  }), [
    flow.generation.mode,
    flow.generation.prompt,
    flow.generation.inputImages,
    flow.settings.settings,
    flow.settings.ratio,
    flow.settings.resolution,
    flow.generation.size,
    flow.auth.me,
    flow.auth.worksLoading,
    flow.generation.setMode,
    flow.generation.setPrompt,
    flow.generation.setInputImages,
    flow.app.showMessage,
    flow.settings.patchSettings,
    flow.settings.setRatio,
    flow.settings.setResolution,
    flow.generation.handleGenerate,
    handleAuthLogin,
    handleAuthRegister,
    handleAuthLogout,
  ])
}
