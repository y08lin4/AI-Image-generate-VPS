import { useState } from 'react'
import type { AuthUser } from '../types'

interface Props {
  me: AuthUser | null
  loading?: boolean
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, password: string) => Promise<void>
  onLogout: () => Promise<void>
}

export function AuthPanel({ me, loading = false, onLogin, onRegister, onLogout }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const name = username.trim()
    if (!name || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      if (mode === 'register') await onRegister(name, password)
      else await onLogin(name, password)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function logout() {
    setSubmitting(true)
    setError('')
    try {
      await onLogout()
    } catch (err) {
      setError(err instanceof Error ? err.message : '退出失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (me) {
    return (
      <section className="auth-panel">
        <div className="auth-panel-head">
          <h3>用户中心</h3>
          <span className="auth-status ok">已登录</span>
        </div>
        <div className="auth-user-info">
          <strong>{me.username}</strong>
          <small>ID: {me.id}</small>
        </div>
        {error ? <div className="auth-error">{error}</div> : null}
        <button type="button" className="ghost-btn small" onClick={() => void logout()} disabled={submitting || loading}>
          {submitting ? '处理中...' : '退出登录'}
        </button>
      </section>
    )
  }

  return (
    <section className="auth-panel">
      <div className="auth-panel-head">
        <h3>用户系统</h3>
        <span className="auth-status">未登录</span>
      </div>
      <div className="auth-mode-tabs">
        <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button>
        <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button>
      </div>
      <label className="auth-field">
        <span>用户名</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3-24 位，字母/数字/下划线" />
      </label>
      <label className="auth-field">
        <span>密码</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" />
      </label>
      {error ? <div className="auth-error">{error}</div> : null}
      <button type="button" className="primary-btn" onClick={() => void submit()} disabled={submitting || loading}>
        {submitting ? '处理中...' : mode === 'register' ? '注册并登录' : '登录'}
      </button>
    </section>
  )
}
