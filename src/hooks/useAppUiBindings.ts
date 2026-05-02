import type { AppDataFlow } from './useAppDataFlow'
import { useCanvasBindings } from './useCanvasBindings'
import { useHistoryBindings } from './useHistoryBindings'
import { useOverlayBindings } from './useOverlayBindings'
import { useSidebarBindings } from './useSidebarBindings'
import { useToastBindings } from './useToastBindings'
import { useTopbarBindings } from './useTopbarBindings'

export function useAppUiBindings(flow: AppDataFlow) {
  return {
    unlocked: flow.app.unlocked,
    unlocking: flow.app.unlocking,
    accessPassword: flow.app.accessPassword,
    handleUnlock: flow.app.handleUnlock,
    topbarProps: useTopbarBindings(flow),
    toastProps: useToastBindings(flow),
    workspaceClassName: `workspace ${flow.history.historyCollapsed ? 'history-collapsed' : ''}`,
    sidebarProps: useSidebarBindings(flow),
    canvasProps: useCanvasBindings(flow),
    historyProps: useHistoryBindings(flow),
    overlayProps: useOverlayBindings(flow),
  }
}
