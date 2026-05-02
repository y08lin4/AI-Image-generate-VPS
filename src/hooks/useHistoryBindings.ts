import { type ComponentProps, useMemo } from 'react'
import { HistoryPanel } from '../components/HistoryPanel'
import type { AppDataFlow } from './useAppDataFlow'

type HistoryProps = ComponentProps<typeof HistoryPanel>

export function useHistoryBindings(flow: AppDataFlow): HistoryProps {
  return useMemo(() => ({
    items: flow.history.history,
    collapsed: flow.history.historyCollapsed,
    onToggleCollapsed: flow.history.toggleHistoryCollapsed,
    onReusePrompt: flow.history.reusePrompt,
    onUseImage: flow.history.handleUseAsReference,
    onShowInResults: flow.history.handleShowHistoryInResults,
    onDelete: flow.history.handleDeleteHistory,
    onClear: flow.history.handleClearHistory,
    onMessage: flow.app.showMessage,
  }), [
    flow.history.history,
    flow.history.historyCollapsed,
    flow.history.toggleHistoryCollapsed,
    flow.history.reusePrompt,
    flow.history.handleUseAsReference,
    flow.history.handleShowHistoryInResults,
    flow.history.handleDeleteHistory,
    flow.history.handleClearHistory,
    flow.app.showMessage,
  ])
}
