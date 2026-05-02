import type { AppDataFlow } from './useAppDataFlow'
import { useCanvasBindings } from './useCanvasBindings'
import { useHistoryBindings } from './useHistoryBindings'
import { useOverlayBindings } from './useOverlayBindings'
import { useSidebarBindings } from './useSidebarBindings'
import { useToastBindings } from './useToastBindings'
import { useTopbarBindings } from './useTopbarBindings'

export function useAppUiBindings(flow: AppDataFlow) {
  const { app, settings, auth, generation, workspace, tasks, history, comments, profile } = flow

  return {
    unlocked: app.unlocked,
    unlocking: app.unlocking,
    accessPassword: app.accessPassword,
    handleUnlock: app.handleUnlock,
    topbarProps: useTopbarBindings({ app, settings }),
    toastProps: useToastBindings({ app }),
    workspaceClassName: `workspace ${history.historyCollapsed ? 'history-collapsed' : ''}`,
    sidebarProps: useSidebarBindings({ app, auth, generation, settings }),
    canvasProps: useCanvasBindings({ app, auth, generation, settings, workspace, tasks }),
    historyProps: useHistoryBindings({ app, history }),
    overlayProps: useOverlayBindings({ app, settings, auth, workspace, comments, profile }),
  }
}
