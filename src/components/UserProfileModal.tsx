import type { AuthUser, UserProfile, WorkItem } from '../types'
import { getImageProxyUrl } from '../lib/api'

interface Props {
  open: boolean
  profile: UserProfile | null
  works: WorkItem[]
  loading?: boolean
  me: AuthUser | null
  onClose: () => void
  onOpenComments: (work: WorkItem) => void
  onToggleLike: (work: WorkItem) => void
  onToggleFavorite: (work: WorkItem) => void
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function UserProfileModal({
  open,
  profile,
  works,
  loading = false,
  me,
  onClose,
  onOpenComments,
  onToggleLike,
  onToggleFavorite,
}: Props) {
  if (!open) return null

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="settings-modal profile-modal" role="dialog" aria-modal="true" aria-label="用户主页">
        <header className="modal-header">
          <div>
            <h2>用户主页</h2>
            {profile ? (
              <p>
                @{profile.username} · 作品 {profile.worksCount} · 获赞 {profile.likesReceived} · 被收藏 {profile.favoritesReceived}
              </p>
            ) : (
              <p>加载中...</p>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </header>

        <div className="profile-modal-body">
          {loading ? (
            <div className="works-square-empty">正在加载用户信息...</div>
          ) : !works.length ? (
            <div className="works-square-empty">该用户暂无公开作品。</div>
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
                    <div className="work-card-actions">
                      <button
                        type="button"
                        className={`work-like-btn ${work.likedByMe ? 'active' : ''}`}
                        onClick={() => onToggleLike(work)}
                        disabled={!me || work.status !== 'active'}
                      >
                        {work.likedByMe ? '❤️' : '🤍'} {work.likeCount}
                      </button>
                      <button
                        type="button"
                        className={`work-fav-btn ${work.favoritedByMe ? 'active' : ''}`}
                        onClick={() => onToggleFavorite(work)}
                        disabled={!me || work.status !== 'active'}
                      >
                        {work.favoritedByMe ? '⭐' : '☆'} {work.favoriteCount}
                      </button>
                      <button type="button" className="work-comment-btn" onClick={() => onOpenComments(work)}>
                        评论 {work.commentCount}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
