import type { AuthUser, WorkItem, WorkSort } from '../types'
import { getImageProxyUrl } from '../lib/api'

interface Props {
  works: WorkItem[]
  myWorks: WorkItem[]
  favoriteWorks: WorkItem[]
  me: AuthUser | null
  loading?: boolean
  myWorksLoading?: boolean
  favoriteWorksLoading?: boolean
  sort: WorkSort
  offset: number
  total: number
  pageSize: number
  onRefresh: () => void
  onSortChange: (sort: WorkSort) => void
  onPageChange: (offset: number) => void
  onToggleLike: (work: WorkItem) => void
  onToggleFavorite: (work: WorkItem) => void
  onOpenComments: (work: WorkItem) => void
  onOpenUserProfile: (userId: number) => void
  onDeleteMyWork: (work: WorkItem) => void
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function WorkCard({
  work,
  me,
  loading,
  onToggleLike,
  onToggleFavorite,
  onOpenComments,
  onOpenUserProfile,
  onDelete,
}: {
  work: WorkItem
  me: AuthUser | null
  loading: boolean
  onToggleLike: (work: WorkItem) => void
  onToggleFavorite: (work: WorkItem) => void
  onOpenComments: (work: WorkItem) => void
  onOpenUserProfile: (userId: number) => void
  onDelete?: (work: WorkItem) => void
}) {
  const isMine = Boolean(me && work.userId === me.id)
  return (
    <article key={work.id} className="work-card">
      <img src={getImageProxyUrl(work.thumbUrl || work.imageUrl)} alt={work.title} />
      <div className="work-card-body">
        <strong>{work.title}</strong>
        <p>{work.prompt}</p>
        <div className="work-card-meta">
          <button type="button" className="work-link-btn" onClick={() => onOpenUserProfile(work.userId)}>
            @{work.username}
          </button>
          <span>{formatDate(work.createdAt)}</span>
        </div>
        {work.status === 'hidden' ? <small className="work-status-tag">已下架</small> : null}
        <div className="work-card-actions">
          <button
            type="button"
            className={`work-like-btn ${work.likedByMe ? 'active' : ''}`}
            onClick={() => onToggleLike(work)}
            disabled={loading || !me || work.status !== 'active'}
            title={me ? (work.status === 'active' ? '' : '下架作品不可点赞') : '登录后可点赞'}
          >
            {work.likedByMe ? '❤️' : '🤍'} {work.likeCount}
          </button>
          <button
            type="button"
            className={`work-fav-btn ${work.favoritedByMe ? 'active' : ''}`}
            onClick={() => onToggleFavorite(work)}
            disabled={loading || !me || work.status !== 'active'}
            title={me ? (work.status === 'active' ? '' : '下架作品不可收藏') : '登录后可收藏'}
          >
            {work.favoritedByMe ? '⭐' : '☆'} {work.favoriteCount}
          </button>
          <button type="button" className="work-comment-btn" onClick={() => onOpenComments(work)} disabled={loading}>
            评论 {work.commentCount}
          </button>
          {isMine && onDelete ? (
            <button type="button" className="work-delete-btn" onClick={() => onDelete(work)} disabled={loading}>
              删除
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function WorksSquare({
  works,
  myWorks,
  favoriteWorks,
  me,
  loading = false,
  myWorksLoading = false,
  favoriteWorksLoading = false,
  sort,
  offset,
  total,
  pageSize,
  onRefresh,
  onSortChange,
  onPageChange,
  onToggleLike,
  onToggleFavorite,
  onOpenComments,
  onOpenUserProfile,
  onDeleteMyWork,
}: Props) {
  const page = Math.floor(offset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize))

  const renderList = (items: WorkItem[], listLoading: boolean, emptyText: string, withDelete = false) => (
    !items.length ? (
      <div className="works-square-empty">{emptyText}</div>
    ) : (
      <div className="works-square-list">
        {items.map((work) => (
          <WorkCard
            key={`${withDelete ? 'my' : 'list'}-${work.id}`}
            work={work}
            me={me}
            loading={listLoading}
            onToggleLike={onToggleLike}
            onToggleFavorite={onToggleFavorite}
            onOpenComments={onOpenComments}
            onOpenUserProfile={onOpenUserProfile}
            onDelete={withDelete ? onDeleteMyWork : undefined}
          />
        ))}
      </div>
    )
  )

  return (
    <section className="works-square">
      <div className="works-square-head">
        <div>
          <h3>作品广场</h3>
          <small>共 {total} 条 · 当前第 {page}/{totalPages} 页</small>
        </div>
        <div className="works-square-head-actions">
          <div className="works-sort-tabs">
            <button type="button" className={sort === 'latest' ? 'active' : ''} onClick={() => onSortChange('latest')} disabled={loading}>
              最新
            </button>
            <button type="button" className={sort === 'hot' ? 'active' : ''} onClick={() => onSortChange('hot')} disabled={loading}>
              最热
            </button>
          </div>
          <button type="button" className="ghost-btn small" onClick={onRefresh} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {renderList(works, loading, '暂无作品，先生成一张并发布吧。')}

      <div className="works-page-bar">
        <button
          type="button"
          className="ghost-btn small"
          disabled={loading || offset <= 0}
          onClick={() => onPageChange(Math.max(0, offset - pageSize))}
        >
          上一页
        </button>
        <button
          type="button"
          className="ghost-btn small"
          disabled={loading || offset + pageSize >= total}
          onClick={() => onPageChange(offset + pageSize)}
        >
          下一页
        </button>
      </div>

      {me ? (
        <div className="my-works-section">
          <div className="my-works-head">
            <h4>我的作品（含下架）</h4>
            <button type="button" className="ghost-btn small" onClick={onRefresh} disabled={myWorksLoading}>
              {myWorksLoading ? '加载中...' : '同步'}
            </button>
          </div>
          {renderList(myWorks, myWorksLoading, '你还没有发布作品。', true)}

          <div className="my-works-head">
            <h4>我的收藏</h4>
            <button type="button" className="ghost-btn small" onClick={onRefresh} disabled={favoriteWorksLoading}>
              {favoriteWorksLoading ? '加载中...' : '同步'}
            </button>
          </div>
          {renderList(favoriteWorks, favoriteWorksLoading, '你还没有收藏作品。')}
        </div>
      ) : null}
    </section>
  )
}
