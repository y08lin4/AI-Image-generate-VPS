import { useCallback } from 'react'

interface UseAuthHandlersOptions {
  loginWithSession: (username: string, password: string) => Promise<void>
  registerWithSession: (username: string, password: string) => Promise<void>
  logoutWithSession: () => Promise<void>
  resetForLock: () => void
  refreshWorks: () => Promise<void>
}

export function useAuthHandlers({
  loginWithSession,
  registerWithSession,
  logoutWithSession,
  resetForLock,
  refreshWorks,
}: UseAuthHandlersOptions) {
  const handleAuthLogin = useCallback(async (username: string, password: string) => {
    await loginWithSession(username, password)
    await refreshWorks()
  }, [loginWithSession, refreshWorks])

  const handleAuthRegister = useCallback(async (username: string, password: string) => {
    await registerWithSession(username, password)
    await refreshWorks()
  }, [registerWithSession, refreshWorks])

  const handleAuthLogout = useCallback(async () => {
    await logoutWithSession()
    resetForLock()
    await refreshWorks()
  }, [logoutWithSession, resetForLock, refreshWorks])

  return {
    handleAuthLogin,
    handleAuthRegister,
    handleAuthLogout,
  }
}
