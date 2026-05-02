import { type ComponentProps, useMemo } from 'react'
import { HistoryPanel } from '../components/HistoryPanel'
import type { AppFlowAppDomain, AppFlowHistoryDomain } from './useAppDataFlow'

type HistoryProps = ComponentProps<typeof HistoryPanel>

interface UseHistoryBindingsOptions {
  app: AppFlowAppDomain
  history: AppFlowHistoryDomain
}

export function useHistoryBindings({ app, history }: UseHistoryBindingsOptions): HistoryProps {
  return useMemo(() => ({
    items: history.history,
    collapsed: history.historyCollapsed,
    onToggleCollapsed: history.toggleHistoryCollapsed,
    onReusePrompt: history.reusePrompt,
    onUseImage: history.handleUseAsReference,
    onShowInResults: history.handleShowHistoryInResults,
    onDelete: history.handleDeleteHistory,
    onClear: history.handleClearHistory,
    onMessage: app.showMessage,
  }), [
    history.history,
    history.historyCollapsed,
    history.toggleHistoryCollapsed,
    history.reusePrompt,
    history.handleUseAsReference,
    history.handleShowHistoryInResults,
    history.handleDeleteHistory,
    history.handleClearHistory,
    app.showMessage,
  ])
}
