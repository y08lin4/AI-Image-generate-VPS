import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToastMessage } from '../components/MessageToast'

export function useAppKernel(accessPassword: string) {
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const accessPasswordRef = useRef(accessPassword)

  const showMessage = useCallback((text: string, type: 'ok' | 'error' | 'info' = 'info') => {
    setMessage({ text, type })
  }, [])

  const clearMessage = useCallback(() => {
    setMessage(null)
  }, [])

  const getAccessPassword = useCallback(() => accessPasswordRef.current.trim(), [])

  useEffect(() => {
    accessPasswordRef.current = accessPassword
  }, [accessPassword])

  return {
    message,
    setMessage,
    showMessage,
    clearMessage,
    adminOpen,
    setAdminOpen,
    getAccessPassword,
  }
}
