import { useEffect } from 'react'

interface UseAppLifecycleOptions {
  accessPassword: string
  unlocked: boolean
  meId?: number
  profileUserId: number | null
  workSort: string
  workOffset: number
  restoreActiveBackgroundTasks: (notify: boolean) => Promise<void> | void
  resetForLock: () => void
  resetForNoUser: () => void
  refreshCurrentUser: () => Promise<void> | void
  refreshWorks: () => Promise<void> | void
  refreshMyWorks: () => Promise<void> | void
  refreshMyFavorites: () => Promise<void> | void
  refreshProfile: (userId: number) => Promise<void> | void
}

export function useAppLifecycle({
  accessPassword,
  unlocked,
  meId,
  profileUserId,
  workSort,
  workOffset,
  restoreActiveBackgroundTasks,
  resetForLock,
  resetForNoUser,
  refreshCurrentUser,
  refreshWorks,
  refreshMyWorks,
  refreshMyFavorites,
  refreshProfile,
}: UseAppLifecycleOptions) {
  useEffect(() => {
    if (!accessPassword.trim()) return
    void restoreActiveBackgroundTasks(false)
  }, [accessPassword])

  useEffect(() => {
    if (!unlocked) {
      resetForLock()
      return
    }
    void refreshCurrentUser()
  }, [unlocked, accessPassword])

  useEffect(() => {
    if (!unlocked) return
    void refreshWorks()
  }, [unlocked, accessPassword, workSort, workOffset])

  useEffect(() => {
    if (!unlocked || !meId) {
      resetForNoUser()
      return
    }
    void refreshMyWorks()
    void refreshMyFavorites()
  }, [unlocked, meId, accessPassword, workSort])

  useEffect(() => {
    if (!unlocked || !profileUserId) return
    void refreshProfile(profileUserId)
  }, [unlocked, profileUserId, accessPassword, workSort])
}
