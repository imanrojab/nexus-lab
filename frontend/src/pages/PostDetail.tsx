import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, Globe, Lock, Users, ArrowLeft, Send, Trash2 } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'

interface Author {
  id: number; username: string; full_name: string; avatar_url: string; is_private: boolean
}

interface Comment {
  id: number; content: string; author: Author; created_at: string
}

interface PostData {
  id: number; content: string; image_url: string; visibility: string
  likes_count: number; comments_count: number; has_liked: boolean; is_pinned: boolean
  author: Author; comments: Comment[]; created_at: string
}

export default function PostDetailPage() {
  const { id } = useParams()
  const user = getUser()
  const [post, setPost] = useState<PostData | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  const refresh = () => {
    apiFetch<PostData>(`/api/posts/${id}`).then(setPost).catch(() => {})
  }

  useEffect(() => { refresh() }, [id])

  const handleLike = async () => {
    if (!post) return
    if (post.has_liked) {
      await apiFetch(`/api/posts/${post.id}/like`, { method: 'DELETE' })
    } else {
      await apiFetch(`/api/posts/${post.id}/like`, { method: 'POST' })
    }
    refresh()
  }

  const handleComment = async () => {
    if (!comment.trim() || !post) return
    setSending(true)
    await apiFetch(`/api/posts/${post.id}/comments`, {
      method: 'POST', body: JSON.stringify({ content: comment }),
    })
    setComment('')
    setSending(false)
    refresh()
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!post) return
    await apiFetch(`/api/posts/${post.id}/comments/${commentId}`, { method: 'DELETE' })
    refresh()
  }

  if (!post) return <div className="py-12 text-center text-sm text-muted">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/feed" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Feed
      </Link>

      {/* Post */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Link to={`/profile/${post.author.id}`}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
            {post.author.full_name.charAt(0)}
          </Link>
          <div>
            <Link to={`/profile/${post.author.id}`} className="text-sm font-semibold text-foreground hover:underline">
              {post.author.full_name}
            </Link>
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <span>@{post.author.username}</span>
              <span>·</span>
              <span>{new Date(post.created_at).toLocaleString()}</span>
              <span>·</span>
              {post.visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> :
               post.visibility === 'followers' ? <Users className="h-2.5 w-2.5" /> :
               <Lock className="h-2.5 w-2.5" />}
              <span>{post.visibility}</span>
            </div>
          </div>
        </div>

        {/* VULN: XSS via dangerouslySetInnerHTML */}
        <div className="text-sm text-foreground leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.image_url && (
          <div className="mb-4 rounded-lg overflow-hidden border border-border">
            <img src={post.image_url} alt="" className="w-full max-h-[500px] object-cover" />
          </div>
        )}

        <div className="flex items-center gap-6 pt-3 border-t border-border">
          <button onClick={handleLike}
            className={`flex items-center gap-1.5 text-sm transition-colors ${post.has_liked ? 'text-danger' : 'text-muted hover:text-danger'}`}>
            <Heart className={`h-4 w-4 ${post.has_liked ? 'fill-current' : ''}`} />
            {post.likes_count} {post.likes_count === 1 ? 'like' : 'likes'}
          </button>
          <span className="text-sm text-muted">{post.comments_count} comments</span>
        </div>
      </div>

      {/* Comment input */}
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
          {(user?.full_name || '?').charAt(0)}
        </div>
        <div className="flex-1 flex gap-2">
          <input type="text" value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={e => { if (e.key === 'Enter') handleComment() }} />
          <button onClick={handleComment} disabled={sending || !comment.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {post.comments.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">No comments yet</div>
        ) : post.comments.map(c => (
          <div key={c.id} className="flex items-start gap-3 px-5 py-3">
            <Link to={`/profile/${c.author.id}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-foreground">
              {c.author.full_name.charAt(0)}
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Link to={`/profile/${c.author.id}`} className="text-xs font-semibold text-foreground hover:underline">
                  {c.author.full_name}
                </Link>
                <span className="text-[10px] text-muted">{new Date(c.created_at).toLocaleString()}</span>
              </div>
              {/* VULN: XSS via dangerouslySetInnerHTML */}
              <div className="text-xs text-foreground/80 mt-0.5" dangerouslySetInnerHTML={{ __html: c.content }} />
            </div>
            {c.author.id === user?.id && (
              <button onClick={() => handleDeleteComment(c.id)}
                className="shrink-0 rounded-md p-1 text-muted hover:text-danger">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
