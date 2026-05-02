import { AccessGate } from './components/AccessGate'
import { AppOverlays } from './components/AppOverlays'
import { AppTopbar } from './components/AppTopbar'
import { CanvasWorkspace } from './components/CanvasWorkspace'
import { GenerateSidebar } from './components/GenerateSidebar'
import { HistoryPanel } from './components/HistoryPanel'
import { MessageToast } from './components/MessageToast'
import { useAppViewModel } from './hooks/useAppViewModel'
import './styles.css'

export default function App() {
  const vm = useAppViewModel()

  if (!vm.unlocked) {
    return (
      <AccessGate
        initialPassword={vm.accessPassword}
        loading={vm.unlocking}
        onUnlock={vm.handleUnlock}
      />
    )
  }

  return (
    <div className="app-shell">
      <AppTopbar {...vm.topbarProps} />
      <MessageToast {...vm.toastProps} />

      <main className={vm.workspaceClassName}>
        <GenerateSidebar {...vm.sidebarProps} />
        <CanvasWorkspace {...vm.canvasProps} />
        <HistoryPanel {...vm.historyProps} />
      </main>

      <AppOverlays {...vm.overlayProps} />
    </div>
  )
}
