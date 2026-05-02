import { useEffect, useState } from 'react'
import { checkServerPassword, getCurrentUser, loginUser, logoutUser, registerUser } from '../lib/api'
import type { AuthUser } from '../types'

type MessageType = 'ok' | 'error' | 'info'

interface UseAccessSessionOptions {
  accessPassword: string
  getAccessPassword: () => string
  showMessage: (text: string, type?: MessageType) => void
  onAccessPasswordUpdated: (nextPassword: string) => void
}

export function useAccessSession({
  accessPassword,
  getAccessPassword,
  showMessage,
  onAccessPasswordUpdated,
}: UseAccessSessionOptions) {
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [me, setMe] = useState<AuthUser | null>(null)

  useEffect(() => {
    const savedPassword = accessPassword.trim()
    if (!savedPassword) {
      setUnlocked(false)
      setMe(null)
      return
    }
    let active = true
    setUnlocking(true)
    void checkServerPassword(savedPassword)
      .then((result) => {
        if (!active) return
        setUnlocked(result.ok)
        if (!result.ok) setMe(null)
      })
      .catch(() => {
        if (!active) return
        setUnlocked(false)
        setMe(null)
      })
      .finally(() => {
        if (!active) return
        setUnlocking(false)
      })
    return () => {
      active = false
    }
  }, [accessPassword])

  async function handleUnlock(inputPassword: string) {
    const password = inputPassword.trim()
    if (!password) throw new Error('请输入访问密码')
    setUnlocking(true)
    try {
      const result = await checkServerPassword(password)
      if (!result.ok) throw new Error(result.message || '访问密码验证失败')
      onAccessPasswordUpdated(password)
      setUnlocked(true)
    } finally {
      setUnlocking(false)
    }
  }

  function handleAccessPasswordUpdated(nextPassword: string) {
    onAccessPasswordUpdated(nextPassword.trim())
  }

  async function refreshCurrentUser() {
    const password = getAccessPassword()
    if (!password) {
      setMe(null)
      return
    }
    try {
      setMe(await getCurrentUser(password))
    } catch {
      setMe(null)
    }
  }

  async function handleLogin(username: string, password: string) {
    const accessPasswordValue = getAccessPassword()
    const user = await loginUser(accessPasswordValue, username, password)
    setMe(user)
    showMessage(`欢迎回来，${user.username}`, 'ok')
  }

  async function handleRegister(username: string, password: string) {
    const accessPasswordValue = getAccessPassword()
    const user = await registerUser(accessPasswordValue, username, password)
    setMe(user)
    showMessage(`注册成功，欢迎 ${user.username}`, 'ok')
  }

  async function handleLogout() {
    const accessPasswordValue = getAccessPassword()
    await logoutUser(accessPasswordValue)
    setMe(null)
    showMessage('已退出登录', 'ok')
  }

  return {
    me,
    unlocked,
    unlocking,
    handleUnlock,
    handleAccessPasswordUpdated,
    refreshCurrentUser,
    handleLogin,
    handleRegister,
    handleLogout,
  }
}
