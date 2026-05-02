import { getRequestModeLabel } from '../lib/appTask'
import type { RequestMode } from '../types'

interface Props {
  baseUrl: string
  requestMode: RequestMode
  onOpenAdmin: () => void
  onOpenSettings: () => void
}

export function AppTopbar({
  baseUrl,
  requestMode,
  onOpenAdmin,
  onOpenSettings,
}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">AI</div>
        <div>
          <h1>AI Image Generate</h1>
          <p>自定义 URL / Key 的私人生图工作台</p>
        </div>
      </div>
      <div className="top-actions">
        <div className="config-pill" title={baseUrl}>
          <span>{getRequestModeLabel(requestMode)}</span>
        </div>
        <button type="button" className="ghost-btn" onClick={onOpenAdmin}>Admin</button>
        <button type="button" className="secondary-btn" onClick={onOpenSettings}>设置</button>
      </div>
    </header>
  )
}
