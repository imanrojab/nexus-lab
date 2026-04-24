import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, getUser } from '@/lib/api'

export default function TeamPage() {
  const user = getUser()
  const [members, setMembers] = useState<any[]>([])
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    const orgId = user?.default_org_id
    if (orgId) {
      apiFetch<any>(`/api/orgs/${orgId}/members`).then(d => setMembers(d.items)).catch(() => {})
      apiFetch<any>(`/api/orgs/${orgId}`).then(d => setOrgName(d.name)).catch(() => {})
    }
  }, [])

  const roleColors: Record<string, string> = {
    owner: 'bg-danger/10 text-danger', admin: 'bg-warning/10 text-warning',
    member: 'bg-primary/10 text-primary',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Team</h1>
        <p className="text-sm text-muted">{members.length} members in {orgName || 'your organization'}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {members.map((u: any) => (
          <Link key={u.id} to={`/profile/${u.id}`}
            className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                {u.full_name?.charAt(0) || u.username?.charAt(0) || '?'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{u.full_name || u.username}</p>
                <p className="text-xs text-muted">{u.email}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${roleColors[u.role] || 'bg-muted/20 text-muted'}`}>{u.role}</span>
            </div>
            {u.department && <p className="mt-2 text-xs text-muted">{u.department}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}
