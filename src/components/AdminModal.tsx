import { useEffect, useState } from 'react'
import type { AdminDailyReport } from '../types'
import { getAdminDailyReport, updateAccessPasswordByAdmin, verifyAdminPassword } from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
  onMessage: (message: string, type?: 'ok' | 'error') => void
  onAccessPasswordUpdated: (nextPassword: string) => void
}

export function AdminModal({ open, onClose, onMessage, onAccessPasswordUpdated }: Props) {
  const [adminPassword, setAdminPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [report, setReport] = useState<AdminDailyReport | null>(null)
  const [newAccessPassword, setNewAccessPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  useEffect(() => {
    if (!open) return
    setVerified(false)
    setReport(null)
    setNewAccessPassword('')
  }, [open])

  if (!open) return null

  async function handleVerify() {
    const password = adminPassword.trim()
    if (!password) {
      onMessage('请输入管理员密码', 'error')
      return
    }
    setVerifying(true)
    try {
      await verifyAdminPassword(password)
      setVerified(true)
      onMessage('管理员验证通过', 'ok')
      await refreshReport(password)
    } catch (error) {
      setVerified(false)
      onMessage(error instanceof Error ? error.message : '管理员验证失败', 'error')
    } finally {
      setVerifying(false)
    }
  }

  async function refreshReport(password = adminPassword.trim()) {
    if (!password) return
    setReportLoading(true)
    try {
      setReport(await getAdminDailyReport(password))
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '获取日报失败', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  async function handleChangeAccessPassword() {
    const password = adminPassword.trim()
    const nextPassword = newAccessPassword.trim()
    if (!password) {
      onMessage('请先输入管理员密码', 'error')
      return
    }
    if (!nextPassword) {
      onMessage('请输入新的访问密码', 'error')
      return
    }
    setUpdatingPassword(true)
    try {
      const result = await updateAccessPasswordByAdmin(password, nextPassword)
      onAccessPasswordUpdated(nextPassword)
      onMessage(result.message, 'ok')
      setNewAccessPassword('')
      await refreshReport(password)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : '修改访问密码失败', 'error')
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="settings-modal admin-modal" role="dialog" aria-modal="true" aria-label="管理员面板">
        <header className="modal-header">
          <div>
            <h2>管理员面板</h2>
            <p>可修改访问密码并查看今日生成统计。</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </header>

        <div className="settings-grid">
          <label className="field full">
            <span>管理员密码</span>
            <div className="inline-input">
              <input
                type="password"
                value={adminPassword}
                placeholder="请输入 ADMIN_PASSWORD"
                onChange={(e) => setAdminPassword(e.target.value)}
              />
              <button type="button" className="secondary-btn" disabled={verifying} onClick={() => void handleVerify()}>
                {verifying ? '验证中' : '验证'}
              </button>
            </div>
          </label>

          {verified ? (
            <>
              <div className="admin-stats full">
                <div className="admin-stats-head">
                  <strong>今日统计（{report?.date || '--'}）</strong>
                  <button type="button" className="ghost-btn small" disabled={reportLoading} onClick={() => void refreshReport()}>
                    {reportLoading ? '刷新中...' : '刷新'}
                  </button>
                </div>
                {report ? (
                  <ul>
                    <li>任务总数：{report.totalTasks}</li>
                    <li>请求总张数：{report.totalRequested}</li>
                    <li>成功张数：{report.successCount}</li>
                    <li>失败张数：{report.failedCount}</li>
                    <li>处理中：{report.pendingCount}</li>
                  </ul>
                ) : (
                  <p>暂无统计数据</p>
                )}
              </div>

              <div className="admin-failure full">
                <strong>失败原因 Top</strong>
                {report?.failureReasons?.length ? (
                  <ol>
                    {report.failureReasons.map((item, index) => (
                      <li key={`${item.reason}-${index}`}>
                        <span>{item.reason}</span>
                        <em>x{item.count}</em>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>今日暂无失败原因</p>
                )}
              </div>

              <label className="field full">
                <span>修改访问密码</span>
                <div className="inline-input">
                  <input
                    type="password"
                    value={newAccessPassword}
                    placeholder="至少 4 位，不要使用 change-me"
                    onChange={(e) => setNewAccessPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={updatingPassword}
                    onClick={() => void handleChangeAccessPassword()}
                  >
                    {updatingPassword ? '修改中...' : '修改'}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <small className="settings-note full">请先验证管理员密码。</small>
          )}
        </div>

        <footer className="modal-actions">
          <div className="spacer" />
          <button type="button" className="ghost-btn" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </div>
  )
}
