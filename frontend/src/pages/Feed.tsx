import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Send, Image, Globe, Lock, Users, MoreHorizontal } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'

interface Author {
  id: number; username: string; full_name: string; avatar_url: string; is_private: boolean
}

interface FeedPost {
  id: number; content: string; image_url: string; visibility: string
  likes_count: number; comments_count: number; has_liked: boolean
  author: Author; created_at: string
}

export default function FeedPage() {
  const user = getUser()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [imageUrl, setImageUrl] = useState('')
  const [posting, setPosting] = useState(false)

  const refresh = () => {
    apiFetch<any>('/api/feed').then(d => setPosts(d.items)).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  const handlePost = async () => {
    if (!content.trim()) return
    setPosting(true)
    await apiFetch('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content, visibility, image_url: imageUrl }),
    })
    setContent('')
    setImageUrl('')
    setPosting(false)
    refresh()
  }

  const handleLike = async (postId: number, hasLiked: boolean) => {
    if (hasLiked) {
      await apiFetch(`/api/posts/${postId}/like`, { method: 'DELETE' })
    } else {
      await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' })
    }
    refresh()
  }

  const visIcon = visibility === 'public' ? <Globe className="h-3 w-3" /> :
    visibility === 'followers' ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Feed</h1>

      {/* Compose */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {(user?.full_name || '?').charAt(0)}
          </div>
          <textarea
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
              placeholder="Image URL (optional)"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground placeholder:text-muted/50 w-48 focus:outline-none focus:ring-1 focus:ring-primary" />
            <select value={visibility} onChange={e => setVisibility(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground">
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>
          </div>
          <button onClick={handlePost} disabled={posting || !content.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Send className="h-3.5 w-3.5" /> {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map(p => (
          <PostCard key={p.id} post={p} onLike={handleLike} />
        ))}
        {posts.length === 0 && (
          <div className="py-12 text-center text-sm text-muted">No posts yet. Follow someone or create your first post!</div>
        )}
      </div>
    </div>
  )
}

function PostCard({ post, onLike }: { post: FeedPost; onLike: (id: number, liked: boolean) => void }) {
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Link to={`/profile/${post.author.id}`} className="flex items-center gap-3 hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {post.author.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">{post.author.full_name}</span>
                {post.author.is_private && <Lock className="h-3 w-3 text-muted" />}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <span>@{post.author.username}</span>
                <span>·</span>
                <span>{timeAgo(post.created_at)}</span>
                <span>·</span>
                {post.visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> :
                 post.visibility === 'followers' ? <Users className="h-2.5 w-2.5" /> :
                 <Lock className="h-2.5 w-2.5" />}
              </div>
            </div>
          </Link>
          <button className="rounded-md p-1.5 text-muted hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Content — VULN: rendered as HTML for XSS */}
        <div className="text-sm text-foreground leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: post.content }} />

        {/* Image */}
        {post.image_url && (
          <div className="mb-3 rounded-lg overflow-hidden border border-border">
            <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-6 pt-2 border-t border-border">
          <button onClick={() => onLike(post.id, post.has_liked)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${post.has_liked ? 'text-danger' : 'text-muted hover:text-danger'}`}>
            <Heart className={`h-4 w-4 ${post.has_liked ? 'fill-current' : ''}`} />
            {post.likes_count}
          </button>
          <Link to={`/post/${post.id}`} className="flex items-center gap-1.5 text-xs text-muted hover:text-primary">
            <MessageCircle className="h-4 w-4" /> {post.comments_count}
          </Link>
        </div>
      </div>
    </div>
  )
}
