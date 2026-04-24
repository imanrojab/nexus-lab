import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, TrendingUp, Users, Search, Lock, UserPlus, UserCheck, Clock } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Author {
  id: number; username: string; full_name: string; avatar_url: string; is_private: boolean
}

interface ExplorePost {
  id: number; content: string; image_url: string; visibility: string
  likes_count: number; comments_count: number; has_liked: boolean
  author: Author; created_at: string
}

interface UserResult {
  id: number; username: string; full_name: string; email: string; role: string; department: string
}

export default function ExplorePage() {
  const [tab, setTab] = useState<'trending' | 'people'>('trending')
  const [posts, setPosts] = useState<ExplorePost[]>([])
  const [users, setUsers] = useState<UserResult[]>([])
  const [search, setSearch] = useState('')
  const [followStatus, setFollowStatus] = useState<Record<number, string>>({})

  useEffect(() => {
    apiFetch<any>('/api/explore').then(d => setPosts(d.items)).catch(() => {})
    apiFetch<any>('/api/users').then(d => setUsers(d.items)).catch(() => {})
  }, [])

  const handleSearch = async () => {
    if (!search.trim()) return
    try {
      const d = await apiFetch<any>(`/api/users/search/query?q=${encodeURIComponent(search)}`)
      setUsers(d.results || [])
    } catch { }
  }

  const checkFollowStatus = async (userId: number) => {
    if (followStatus[userId] !== undefined) return
    try {
      const d = await apiFetch<any>(`/api/users/${userId}/follow-status`)
      setFollowStatus(prev => ({ ...prev, [userId]: d.status }))
    } catch { }
  }

  const handleFollow = async (userId: number) => {
    try {
      const d = await apiFetch<any>(`/api/users/${userId}/follow`, { method: 'POST' })
      setFollowStatus(prev => ({ ...prev, [userId]: d.status }))
    } catch { }
  }

  const handleLike = async (postId: number, hasLiked: boolean) => {
    if (hasLiked) {
      await apiFetch(`/api/posts/${postId}/like`, { method: 'DELETE' })
    } else {
      await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' })
    }
    apiFetch<any>('/api/explore').then(d => setPosts(d.items)).catch(() => {})
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Explore</h1>

      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab('trending')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'trending' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
          }`}>
          <TrendingUp className="h-3.5 w-3.5" /> Trending
        </button>
        <button onClick={() => setTab('people')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'people' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
          }`}>
          <Users className="h-3.5 w-3.5" /> People
        </button>
      </div>

      {tab === 'trending' && (
        <div className="space-y-4">
          {posts.map(p => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <Link to={`/profile/${p.author.id}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  {p.author.full_name.charAt(0)}
                </Link>
                <div>
                  <Link to={`/profile/${p.author.id}`} className="text-sm font-semibold text-foreground hover:underline">
                    {p.author.full_name}
                  </Link>
                  <p className="text-[10px] text-muted">@{p.author.username}</p>
                </div>
              </div>
              <Link to={`/post/${p.id}`}>
                <p className="text-sm text-foreground leading-relaxed mb-3">{p.content}</p>
              </Link>
              {p.image_url && (
                <div className="mb-3 rounded-lg overflow-hidden border border-border">
                  <img src={p.image_url} alt="" className="w-full max-h-64 object-cover" />
                </div>
              )}
              <div className="flex items-center gap-6 pt-2 border-t border-border">
                <button onClick={() => handleLike(p.id, p.has_liked)}
                  className={`flex items-center gap-1.5 text-xs ${p.has_liked ? 'text-danger' : 'text-muted hover:text-danger'}`}>
                  <Heart className={`h-4 w-4 ${p.has_liked ? 'fill-current' : ''}`} /> {p.likes_count}
                </button>
                <Link to={`/post/${p.id}`} className="flex items-center gap-1.5 text-xs text-muted hover:text-primary">
                  <MessageCircle className="h-4 w-4" /> {p.comments_count}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'people' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-lg border border-border bg-card pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }} />
            </div>
            <button onClick={handleSearch}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Search
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3"
                onMouseEnter={() => checkFollowStatus(u.id)}>
                <Link to={`/profile/${u.id}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  {(u.full_name || u.username).charAt(0)}
                </Link>
                <div className="flex-1">
                  <Link to={`/profile/${u.id}`} className="text-sm font-medium text-foreground hover:underline">
                    {u.full_name || u.username}
                  </Link>
                  <p className="text-xs text-muted">@{u.username} · {u.role} {u.department && `· ${u.department}`}</p>
                </div>
                {followStatus[u.id] === 'accepted' ? (
                  <span className="flex items-center gap-1 text-[10px] text-success"><UserCheck className="h-3 w-3" /> Following</span>
                ) : followStatus[u.id] === 'pending' ? (
                  <span className="flex items-center gap-1 text-[10px] text-warning"><Clock className="h-3 w-3" /> Requested</span>
                ) : (
                  <button onClick={() => handleFollow(u.id)}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground hover:opacity-90">
                    <UserPlus className="h-3 w-3" /> Follow
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
