import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Mail, Phone, Building, Key, Save, Lock, UserPlus, UserCheck, Clock, Heart, MessageCircle, Globe, Users as UsersIcon } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'

export default function ProfilePage() {
  const { id } = useParams()
  const currentUser = getUser()
  const isOwn = String(currentUser?.id) === id
  const [profile, setProfile] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', bio: '', phone: '', department: '' })
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [followStatus, setFollowStatus] = useState<string>('none')
  const [posts, setPosts] = useState<any[]>([])
  const [tab, setTab] = useState<'posts' | 'info'>('posts')
  const [followRequests, setFollowRequests] = useState<any[]>([])

  useEffect(() => {
    if (!id) return
    apiFetch<any>(`/api/users/${id}`).then(d => {
      setProfile(d)
      setForm({ full_name: d.full_name, bio: d.bio, phone: d.phone, department: d.department })
    }).catch(() => {})
    apiFetch<any>(`/api/users/${id}/posts`).then(d => setPosts(d.items)).catch(() => {})
    if (!isOwn) {
      apiFetch<any>(`/api/users/${id}/follow-status`).then(d => setFollowStatus(d.status)).catch(() => {})
    } else {
      apiFetch<any>('/api/users/me/follow-requests').then(d => setFollowRequests(d.items)).catch(() => {})
    }
  }, [id])

  const handleSave = async () => {
    await apiFetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(form) })
    const d = await apiFetch<any>(`/api/users/${id}`)
    setProfile(d)
    setEditing(false)
  }

  const handleShowApiKey = async () => {
    const d = await apiFetch<any>(`/api/users/${id}/api-key`)
    setApiKey(d.api_key)
  }

  const handleFollow = async () => {
    const d = await apiFetch<any>(`/api/users/${id}/follow`, { method: 'POST' })
    setFollowStatus(d.status)
  }

  const handleUnfollow = async () => {
    await apiFetch(`/api/users/${id}/follow`, { method: 'DELETE' })
    setFollowStatus('none')
  }

  const handleFollowRequest = async (requestId: number, action: string) => {
    await apiFetch(`/api/users/me/follow-requests/${requestId}`, {
      method: 'PATCH', body: JSON.stringify({ action }),
    })
    setFollowRequests(prev => prev.filter(r => r.id !== requestId))
  }

  if (!profile) return <div className="py-16 text-center text-muted">Loading...</div>

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary">
            {profile.full_name?.charAt(0) || '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{profile.full_name || profile.username}</h1>
              {profile.is_private && <Lock className="h-4 w-4 text-muted" title="Private account" />}
            </div>
            <p className="text-sm text-muted">@{profile.username}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-foreground"><strong>{profile.posts_count || 0}</strong> <span className="text-muted">posts</span></span>
              <Link to="#" className="text-foreground hover:underline"><strong>{profile.followers_count || 0}</strong> <span className="text-muted">followers</span></Link>
              <Link to="#" className="text-foreground hover:underline"><strong>{profile.following_count || 0}</strong> <span className="text-muted">following</span></Link>
            </div>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
              profile.role === 'admin' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'
            }`}>{profile.role}</span>
          </div>
          <div className="flex gap-2">
            {isOwn ? (
              <button onClick={() => setEditing(!editing)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-accent hover:text-foreground">
                {editing ? 'Cancel' : 'Edit Profile'}
              </button>
            ) : followStatus === 'accepted' ? (
              <button onClick={handleUnfollow}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-danger hover:text-danger">
                <UserCheck className="h-3 w-3" /> Following
              </button>
            ) : followStatus === 'pending' ? (
              <button className="flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs text-warning">
                <Clock className="h-3 w-3" /> Requested
              </button>
            ) : (
              <button onClick={handleFollow}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                <UserPlus className="h-3 w-3" /> Follow
              </button>
            )}
          </div>
        </div>

        {/* Bio — VULN: stored XSS via dangerouslySetInnerHTML */}
        {profile.bio && !editing && (
          <div className="mt-4 rounded-lg bg-accent/50 p-3">
            <div className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: profile.bio }} />
          </div>
        )}

        {editing && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Full Name</label>
              <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Bio</label>
              <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted">Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Department</label>
                <input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
            <button onClick={handleSave} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
              <Save className="h-3.5 w-3.5" /> Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Follow requests (own profile only) */}
      {isOwn && followRequests.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Follow Requests ({followRequests.length})</h3>
          <div className="space-y-2">
            {followRequests.map(r => (
              <div key={r.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {r.full_name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{r.full_name}</p>
                  <p className="text-[10px] text-muted">@{r.username}</p>
                </div>
                <button onClick={() => handleFollowRequest(r.id, 'accept')}
                  className="rounded bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground hover:opacity-90">Accept</button>
                <button onClick={() => handleFollowRequest(r.id, 'reject')}
                  className="rounded bg-surface px-2.5 py-1 text-[10px] text-muted hover:text-foreground">Decline</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab('posts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}>
          Posts
        </button>
        <button onClick={() => setTab('info')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'info' ? 'border-primary text-primary' : 'border-transparent text-muted'}`}>
          Info
        </button>
      </div>

      {tab === 'posts' && (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">
              {profile.is_private && !isOwn && followStatus !== 'accepted'
                ? 'This account is private. Follow to see their posts.'
                : 'No posts yet.'}
            </div>
          ) : posts.map((p: any) => (
            <Link key={p.id} to={`/post/${p.id}`} className="block rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-1.5 text-[10px] text-muted mb-2">
                {p.visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> :
                 p.visibility === 'followers' ? <UsersIcon className="h-2.5 w-2.5" /> :
                 <Lock className="h-2.5 w-2.5" />}
                <span>{p.visibility}</span>
                <span>·</span>
                <span>{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{p.content}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {p.likes_count}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {p.comments_count}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tab === 'info' && (
        <>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Contact Info</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted"><Mail className="h-4 w-4" /> {profile.email}</div>
              {profile.phone && <div className="flex items-center gap-2 text-muted"><Phone className="h-4 w-4" /> {profile.phone}</div>}
              {profile.department && <div className="flex items-center gap-2 text-muted"><Building className="h-4 w-4" /> {profile.department}</div>}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">API Key</h2>
                <p className="text-xs text-muted">Personal access token for API requests</p>
              </div>
              <button onClick={handleShowApiKey} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-accent hover:text-foreground">
                <Key className="h-3.5 w-3.5" /> {apiKey ? 'Refresh' : 'Show Key'}
              </button>
            </div>
            {apiKey && (
              <code className="mt-3 block break-all rounded-lg bg-accent p-3 text-xs text-foreground">{apiKey}</code>
            )}
          </div>
        </>
      )}
    </div>
  )
}
