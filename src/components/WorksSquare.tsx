import type { AuthUser, WorkItem, WorkSort } from '../types'
import { getImageProxyUrl } from '../lib/api'

interface Props {
  works: WorkItem[]
  myWorks: WorkItem[]
  me: AuthUser | null
  loading?: boolean
  myWorksLoading?: boolean
  sort: WorkSort
  offset: number
  total: number
  pageSize: number
  onRefresh: () => void
  onSortChange: (sort: WorkSort) => void
  onPageChange: (offset: number) => void
  onToggleLike: (work: WorkItem) => void
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
  onDelete,
}: {
  work: WorkItem
  me: AuthUser | null
  loading: boolean
  onToggleLike: (work: WorkItem) => void
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
          <span>@{work.username}</span>
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
  me,
  loading = false,
  myWorksLoading = false,
  sort,
  offset,
  total,
  pageSize,
  onRefresh,
  onSortChange,
  onPageChange,
  onToggleLike,
  onDeleteMyWork,
}: Props) {
  const page = Math.floor(offset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize))

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

      {!works.length ? (
        <div className="works-square-empty">暂无作品，先生成一张并发布吧。</div>
      ) : (
        <>
          <div className="works-square-list">
            {works.map((work) => (
              <WorkCard
                key={work.id}
                work={work}
                me={me}
                loading={loading}
                onToggleLike={onToggleLike}
              />
            ))}
          </div>
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
        </>
      )}

      {me ? (
        <div className="my-works-section">
          <div className="my-works-head">
            <h4>我的作品（含下架）</h4>
            <button type="button" className="ghost-btn small" onClick={onRefresh} disabled={myWorksLoading}>
              {myWorksLoading ? '加载中...' : '同步'}
            </button>
          </div>
          {!myWorks.length ? (
            <div className="works-square-empty">你还没有发布作品。</div>
          ) : (
            <div className="works-square-list">
              {myWorks.map((work) => (
                <WorkCard
                  key={`my-${work.id}`}
                  work={work}
                  me={me}
                  loading={myWorksLoading}
                  onToggleLike={onToggleLike}
                  onDelete={onDeleteMyWork}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
