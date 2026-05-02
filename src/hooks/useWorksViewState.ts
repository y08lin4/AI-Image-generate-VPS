import { useState } from 'react'
import type { UserProfile, WorkComment, WorkItem, WorkSort } from '../types'

type WorkItemUpdater = (item: WorkItem) => WorkItem

export function useWorksViewState() {
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

  function mapWorkCollections(updater: WorkItemUpdater) {
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

  function handleOpenUserProfile(userId: number) {
    setProfileUserId(userId)
  }

  return {
    works,
    setWorks,
    worksLoading,
    setWorksLoading,
    workSort,
    setWorkSort,
    workOffset,
    setWorkOffset,
    workTotal,
    setWorkTotal,
    myWorks,
    setMyWorks,
    myWorksLoading,
    setMyWorksLoading,
    favoriteWorks,
    setFavoriteWorks,
    favoriteWorksLoading,
    setFavoriteWorksLoading,
    activeCommentWork,
    setActiveCommentWork,
    workComments,
    setWorkComments,
    workCommentsLoading,
    setWorkCommentsLoading,
    workCommentsTotal,
    setWorkCommentsTotal,
    profileUserId,
    setProfileUserId,
    profileData,
    setProfileData,
    profileWorks,
    setProfileWorks,
    profileLoading,
    setProfileLoading,
    mapWorkCollections,
    replaceWorkInCollections,
    removeWorkFromCollections,
    resetForLock,
    resetForNoUser,
    closeComments,
    closeProfile,
    handleOpenUserProfile,
  }
}
