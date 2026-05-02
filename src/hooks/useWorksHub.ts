import { useState } from 'react'
import {
  createWorkComment,
  deleteWork,
  deleteWorkComment,
  favoriteWork,
  getUserProfileById,
  likeWork,
  listMyFavoriteWorks,
  listMyWorks,
  listUserWorksById,
  listWorkComments,
  listWorks as listWorksSquare,
  unfavoriteWork,
  unlikeWork,
} from '../lib/api'
import { WORK_LIST_PAGE_SIZE } from '../lib/appTask'
import type { AuthUser, UserProfile, WorkComment, WorkItem, WorkSort } from '../types'

type MessageType = 'ok' | 'error' | 'info'

interface UseWorksHubOptions {
  me: AuthUser | null
  getAccessPassword: () => string
  showMessage: (text: string, type?: MessageType) => void
}

export function useWorksHub({ me, getAccessPassword, showMessage }: UseWorksHubOptions) {
  const [works, setWorks] = useState<WorkItem[]>([])
  const [worksLoading, setWorksLoading] = useState(false)
  const [workSort, setWorkSort] = useState<WorkSort>('latest')
  const [workOffset, setWorkOffset] = useState(0)
  const [workTotal, setWorkTotal] = useState(0)
  const [myWorks, setMyWorks] = useState<WorkItem[]>([])
  const [myWorksLoading, setMyWorksLoading] = useState(false)
  const [favoriteWorks, setFavoriteWorks] = useState<WorkItem[]>([])
  const [favoriteWorksLoading, setFavoriteWorksLoading] = useState(false)
  const [activeCommentWork, setActiveCommentWork] = useState<WorkItem | null>(null)
  const [workComments, setWorkComments] = useState<WorkComment[]>([])
  const [workCommentsLoading, setWorkCommentsLoading] = useState(false)
  const [workCommentsTotal, setWorkCommentsTotal] = useState(0)
  const [profileUserId, setProfileUserId] = useState<number | null>(null)
  const [profileData, setProfileData] = useState<UserProfile | null>(null)
  const [profileWorks, setProfileWorks] = useState<WorkItem[]>([])
  const [profileLoading, setProfileLoading] = useState(false)

  function mapWorkCollections(updater: (item: WorkItem) => WorkItem) {
    setWorks((prev) => prev.map(updater))
    setMyWorks((prev) => prev.map(updater))
    setFavoriteWorks((prev) => prev.map(updater))
    setProfileWorks((prev) => prev.map(updater))
  }

  function replaceWorkInCollections(target: WorkItem) {
    mapWorkCollections((item) => (item.id === target.id ? target : item))
  }

  function removeWorkFromCollections(workId: number) {
    setWorks((prev) => prev.filter((item) => item.id !== workId))
    setMyWorks((prev) => prev.filter((item) => item.id !== workId))
    setFavoriteWorks((prev) => prev.filter((item) => item.id !== workId))
    setProfileWorks((prev) => prev.filter((item) => item.id !== workId))
  }

  function resetForLock() {
    setWorks([])
    setMyWorks([])
    setFavoriteWorks([])
    setWorkOffset(0)
    setWorkTotal(0)
    setActiveCommentWork(null)
    setWorkComments([])
    setWorkCommentsTotal(0)
    setProfileUserId(null)
    setProfileData(null)
    setProfileWorks([])
  }

  function resetForNoUser() {
    setMyWorks([])
    setFavoriteWorks([])
  }

  function closeComments() {
    setActiveCommentWork(null)
  }

  function closeProfile() {
    setProfileUserId(null)
    setProfileData(null)
    setProfileWorks([])
  }

  async function refreshWorks(showError = false) {
    const password = getAccessPassword()
    if (!password) {
      setWorks([])
      setWorkTotal(0)
      return
    }
    setWorksLoading(true)
    try {
      const data = await listWorksSquare(password, { limit: WORK_LIST_PAGE_SIZE, offset: workOffset, sort: workSort })
      setWorks(data.works)
      setWorkTotal(data.total)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取作品广场失败', 'error')
    } finally {
      setWorksLoading(false)
    }
  }

  async function refreshMyWorks(showError = false) {
    const password = getAccessPassword()
    if (!password || !me) {
      setMyWorks([])
      return
    }
    setMyWorksLoading(true)
    try {
      const data = await listMyWorks(password, { limit: WORK_LIST_PAGE_SIZE, offset: 0, sort: workSort })
      setMyWorks(data.works)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取我的作品失败', 'error')
    } finally {
      setMyWorksLoading(false)
    }
  }

  async function refreshMyFavorites(showError = false) {
    const password = getAccessPassword()
    if (!password || !me) {
      setFavoriteWorks([])
      return
    }
    setFavoriteWorksLoading(true)
    try {
      const data = await listMyFavoriteWorks(password, { limit: WORK_LIST_PAGE_SIZE, offset: 0, sort: workSort })
      setFavoriteWorks(data.works)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取我的收藏失败', 'error')
    } finally {
      setFavoriteWorksLoading(false)
    }
  }

  async function refreshWorkComments(workId: number, showError = false) {
    const password = getAccessPassword()
    if (!password) return
    setWorkCommentsLoading(true)
    try {
      const data = await listWorkComments(password, workId, { limit: 50, offset: 0 })
      setWorkComments(data.comments)
      setWorkCommentsTotal(data.total)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '获取评论失败', 'error')
    } finally {
      setWorkCommentsLoading(false)
    }
  }

  async function refreshProfile(userId: number, showError = false) {
    const password = getAccessPassword()
    if (!password) return
    setProfileLoading(true)
    try {
      const [profile, worksRes] = await Promise.all([
        getUserProfileById(password, userId),
        listUserWorksById(password, userId, { limit: 30, offset: 0, sort: workSort }),
      ])
      setProfileData(profile)
      setProfileWorks(worksRes.works)
    } catch (error) {
      if (showError) showMessage(error instanceof Error ? error.message : '加载用户主页失败', 'error')
    } finally {
      setProfileLoading(false)
    }
  }

  async function handleToggleLike(work: WorkItem) {
    if (!me) {
      showMessage('请先登录后再点赞', 'error')
      return
    }
    const accessPassword = getAccessPassword()
    const nextLiked = !work.likedByMe
    const nextLikeCount = Math.max(0, work.likeCount + (nextLiked ? 1 : -1))
    mapWorkCollections((item) => item.id === work.id ? { ...item, likedByMe: nextLiked, likeCount: nextLikeCount } : item)

    try {
      if (nextLiked) await likeWork(accessPassword, work.id)
      else await unlikeWork(accessPassword, work.id)
    } catch (error) {
      replaceWorkInCollections(work)
      showMessage(error instanceof Error ? error.message : '点赞操作失败', 'error')
    }
  }

  async function handleToggleFavorite(work: WorkItem) {
    if (!me) {
      showMessage('请先登录后再收藏', 'error')
      return
    }
    const accessPassword = getAccessPassword()
    const nextFavorited = !work.favoritedByMe
    const nextFavoriteCount = Math.max(0, work.favoriteCount + (nextFavorited ? 1 : -1))
    const patchItem = (item: WorkItem) => (item.id === work.id ? { ...item, favoritedByMe: nextFavorited, favoriteCount: nextFavoriteCount } : item)

    mapWorkCollections(patchItem)
    setFavoriteWorks((prev) => {
      if (nextFavorited) {
        return prev.some((item) => item.id === work.id)
          ? prev.map(patchItem)
          : [{ ...work, favoritedByMe: true, favoriteCount: nextFavoriteCount }, ...prev]
      }
      return prev.filter((item) => item.id !== work.id).map(patchItem)
    })

    try {
      if (nextFavorited) await favoriteWork(accessPassword, work.id)
      else await unfavoriteWork(accessPassword, work.id)
    } catch (error) {
      replaceWorkInCollections(work)
      await Promise.all([refreshWorks(), refreshMyFavorites()])
      showMessage(error instanceof Error ? error.message : '收藏操作失败', 'error')
    }
  }

  async function handleOpenComments(work: WorkItem) {
    setActiveCommentWork(work)
    setWorkComments([])
    setWorkCommentsTotal(0)
    await refreshWorkComments(work.id, true)
  }

  async function handleCreateComment(content: string) {
    if (!activeCommentWork) return
    if (!me) {
      showMessage('请先登录后再评论', 'error')
      return
    }
    const accessPassword = getAccessPassword()
    try {
      const comment = await createWorkComment(accessPassword, activeCommentWork.id, content)
      setWorkComments((prev) => [comment, ...prev])
      setWorkCommentsTotal((prev) => prev + 1)
      const updateCommentCount = (item: WorkItem) => item.id === activeCommentWork.id ? { ...item, commentCount: item.commentCount + 1 } : item
      mapWorkCollections(updateCommentCount)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '发表评论失败', 'error')
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!activeCommentWork) return
    const accessPassword = getAccessPassword()
    try {
      await deleteWorkComment(accessPassword, commentId)
      setWorkComments((prev) => prev.filter((item) => item.id !== commentId))
      setWorkCommentsTotal((prev) => Math.max(0, prev - 1))
      const updateCommentCount = (item: WorkItem) => item.id === activeCommentWork.id ? { ...item, commentCount: Math.max(0, item.commentCount - 1) } : item
      mapWorkCollections(updateCommentCount)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '删除评论失败', 'error')
    }
  }

  function handleOpenUserProfile(userId: number) {
    setProfileUserId(userId)
  }

  async function handleDeleteMyWork(work: WorkItem) {
    if (!me) {
      showMessage('请先登录', 'error')
      return
    }
    if (work.userId !== me.id) {
      showMessage('只能删除自己的作品', 'error')
      return
    }
    if (!confirm(`确认删除作品「${work.title}」？`)) return

    const accessPassword = getAccessPassword()
    try {
      await deleteWork(accessPassword, work.id)
      removeWorkFromCollections(work.id)
      showMessage('作品已删除', 'ok')
      await Promise.all([refreshWorks(), refreshMyWorks(), refreshMyFavorites()])
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '删除作品失败', 'error')
    }
  }

  function handleChangeWorkSort(nextSort: WorkSort) {
    setWorkSort(nextSort)
    setWorkOffset(0)
  }

  function handleChangeWorkPage(nextOffset: number) {
    setWorkOffset(Math.max(0, nextOffset))
  }

  async function handleRefreshSquare() {
    const jobs: Array<Promise<unknown>> = [
      refreshWorks(true),
      refreshMyWorks(true),
      refreshMyFavorites(true),
    ]
    if (profileUserId) jobs.push(refreshProfile(profileUserId, true))
    if (activeCommentWork) jobs.push(refreshWorkComments(activeCommentWork.id, true))
    await Promise.all(jobs)
  }

  return {
    works,
    worksLoading,
    workSort,
    workOffset,
    workTotal,
    myWorks,
    myWorksLoading,
    favoriteWorks,
    favoriteWorksLoading,
    activeCommentWork,
    workComments,
    workCommentsLoading,
    workCommentsTotal,
    profileUserId,
    profileData,
    profileWorks,
    profileLoading,
    resetForLock,
    resetForNoUser,
    closeComments,
    closeProfile,
    refreshWorks,
    refreshMyWorks,
    refreshMyFavorites,
    refreshWorkComments,
    refreshProfile,
    handleToggleLike,
    handleToggleFavorite,
    handleOpenComments,
    handleCreateComment,
    handleDeleteComment,
    handleOpenUserProfile,
    handleDeleteMyWork,
    handleChangeWorkSort,
    handleChangeWorkPage,
    handleRefreshSquare,
  }
}
