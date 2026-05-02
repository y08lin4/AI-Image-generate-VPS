import type { AuthUser, WorkItem } from '../types'
import { getImageProxyUrl } from '../lib/api'

interface Props {
  works: WorkItem[]
  me: AuthUser | null
  loading?: boolean
  onRefresh: () => void
  onToggleLike: (work: WorkItem) => void
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function WorksSquare({ works, me, loading = false, onRefresh, onToggleLike }: Props) {
  return (
    <section className="works-square">
      <div className="works-square-head">
        <div>
          <h3>作品广场</h3>
          <small>{works.length} 条作品</small>
        </div>
        <button type="button" className="ghost-btn small" onClick={onRefresh} disabled={loading}>
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {!works.length ? (
        <div className="works-square-empty">暂无作品，先生成一张并发布吧。</div>
      ) : (
        <div className="works-square-list">
          {works.map((work) => (
            <article key={work.id} className="work-card">
              <img src={getImageProxyUrl(work.thumbUrl || work.imageUrl)} alt={work.title} />
              <div className="work-card-body">
                <strong>{work.title}</strong>
                <p>{work.prompt}</p>
                <div className="work-card-meta">
                  <span>@{work.username}</span>
                  <span>{formatDate(work.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className={`work-like-btn ${work.likedByMe ? 'active' : ''}`}
                  onClick={() => onToggleLike(work)}
                  disabled={loading || !me}
                  title={me ? '' : '登录后可点赞'}
                >
                  {work.likedByMe ? '❤️' : '🤍'} {work.likeCount}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
