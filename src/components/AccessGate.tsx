import { useEffect, useState } from 'react'

interface Props {
  initialPassword?: string
  loading?: boolean
  onUnlock: (password: string) => Promise<void>
}

export function AccessGate({ initialPassword = '', loading = false, onUnlock }: Props) {
  const [password, setPassword] = useState(initialPassword)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPassword(initialPassword)
  }, [initialPassword])

  async function submit() {
    const value = password.trim()
    if (!value) {
      setError('请输入访问密码')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onUnlock(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="access-gate">
      <section className="access-gate-card" role="dialog" aria-modal="true" aria-label="访问验证">
        <h1>请输入访问密码</h1>
        <p>验证通过后才能进入生图工作台。</p>
        <input
          type="password"
          value={password}
          autoFocus
          placeholder="服务端访问密码"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
        />
        {error ? <div className="access-gate-error">{error}</div> : null}
        <button type="button" className="primary-btn" onClick={() => void submit()} disabled={submitting || loading}>
          {submitting || loading ? '验证中...' : '进入系统'}
        </button>
      </section>
    </div>
  )
}
