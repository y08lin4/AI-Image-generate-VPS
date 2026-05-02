import { useState } from 'react'
import type { AuthUser, WorkComment, WorkItem } from '../types'
import { getImageProxyUrl } from '../lib/api'

interface Props {
  open: boolean
  work: WorkItem | null
  comments: WorkComment[]
  total: number
  loading?: boolean
  me: AuthUser | null
  onClose: () => void
  onRefresh: (workId: number) => void
  onCreate: (content: string) => void
  onDelete: (commentId: number) => void
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function WorkCommentsModal({
  open,
  work,
  comments,
  total,
  loading = false,
  me,
  onClose,
  onRefresh,
  onCreate,
  onDelete,
}: Props) {
  const [content, setContent] = useState('')
  if (!open || !work) return null

  function submitComment() {
    const text = content.trim()
    if (!text) return
    onCreate(text)
    setContent('')
  }

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="settings-modal comments-modal" role="dialog" aria-modal="true" aria-label="作品评论">
        <header className="modal-header">
          <div>
            <h2>作品评论</h2>
            <p>{work.title} · 共 {total} 条评论</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </header>

        <div className="comments-modal-body">
          <div className="comments-work-preview">
            <img src={getImageProxyUrl(work.thumbUrl || work.imageUrl)} alt={work.title} />
            <div>
              <strong>{work.title}</strong>
              <p>{work.prompt}</p>
            </div>
          </div>

          <div className="comments-list-wrap">
            <div className="comments-list-head">
              <button type="button" className="ghost-btn small" onClick={() => onRefresh(work.id)} disabled={loading}>
                {loading ? '刷新中...' : '刷新评论'}
              </button>
            </div>
            {!comments.length ? (
              <div className="works-square-empty">暂无评论，来抢沙发吧。</div>
            ) : (
              <div className="comments-list">
                {comments.map((item) => {
                  const canDelete = Boolean(me && (item.userId === me.id || work.userId === me.id))
                  return (
                    <article key={item.id} className="comment-item">
                      <div className="comment-item-head">
                        <strong>@{item.username}</strong>
                        <small>{formatTime(item.createdAt)}</small>
                      </div>
                      <p>{item.content}</p>
                      {canDelete ? (
                        <button type="button" className="ghost-btn small danger" onClick={() => onDelete(item.id)}>
                          删除
                        </button>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="modal-actions comments-modal-actions">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={me ? '输入评论内容（最多 1000 字）' : '登录后可评论'}
            disabled={!me}
          />
          <button type="button" className="primary-btn" onClick={submitComment} disabled={!me || !content.trim()}>
            发表评论
          </button>
        </footer>
      </section>
    </div>
  )
}
