import { useEffect, useRef } from 'react'

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
  const restoreActiveBackgroundTasksRef = useRef(restoreActiveBackgroundTasks)
  const resetForLockRef = useRef(resetForLock)
  const resetForNoUserRef = useRef(resetForNoUser)
  const refreshCurrentUserRef = useRef(refreshCurrentUser)
  const refreshWorksRef = useRef(refreshWorks)
  const refreshMyWorksRef = useRef(refreshMyWorks)
  const refreshMyFavoritesRef = useRef(refreshMyFavorites)
  const refreshProfileRef = useRef(refreshProfile)

  restoreActiveBackgroundTasksRef.current = restoreActiveBackgroundTasks
  resetForLockRef.current = resetForLock
  resetForNoUserRef.current = resetForNoUser
  refreshCurrentUserRef.current = refreshCurrentUser
  refreshWorksRef.current = refreshWorks
  refreshMyWorksRef.current = refreshMyWorks
  refreshMyFavoritesRef.current = refreshMyFavorites
  refreshProfileRef.current = refreshProfile

  useEffect(() => {
    if (!accessPassword.trim()) return
    void restoreActiveBackgroundTasksRef.current(false)
  }, [accessPassword])

  useEffect(() => {
    if (!unlocked) {
      resetForLockRef.current()
      return
    }
    void refreshCurrentUserRef.current()
  }, [unlocked, accessPassword])

  useEffect(() => {
    if (!unlocked) return
    void refreshWorksRef.current()
  }, [unlocked, accessPassword, workSort, workOffset])

  useEffect(() => {
    if (!unlocked || !meId) {
      resetForNoUserRef.current()
      return
    }
    void refreshMyWorksRef.current()
    void refreshMyFavoritesRef.current()
  }, [unlocked, meId, accessPassword, workSort])

  useEffect(() => {
    if (!unlocked || !profileUserId) return
    void refreshProfileRef.current(profileUserId)
  }, [unlocked, profileUserId, accessPassword, workSort])
}
