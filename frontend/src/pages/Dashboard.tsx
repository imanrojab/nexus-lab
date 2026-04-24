import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Users, CheckSquare, Clock, ArrowRight } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'

export default function DashboardPage() {
  const user = getUser()
  const [projects, setProjects] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [org, setOrg] = useState<any>(null)

  useEffect(() => {
    apiFetch<any>('/api/projects?limit=5').then(d => setProjects(d.items)).catch(() => {})
    if (user?.role === 'admin') {
      apiFetch<any>('/api/admin/stats').then(setStats).catch(() => {})
    }
    if (user?.default_org_id) {
      apiFetch<any>(`/api/orgs/${user.default_org_id}`).then(setOrg).catch(() => {})
    }
  }, [])

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total_users, icon: <Users className="h-5 w-5" />, color: 'text-primary' },
    { label: 'Projects', value: stats.total_projects, icon: <FolderKanban className="h-5 w-5" />, color: 'text-success' },
    { label: 'Tasks', value: stats.total_tasks, icon: <CheckSquare className="h-5 w-5" />, color: 'text-warning' },
    { label: 'Open Feedback', value: stats.open_feedback, icon: <Clock className="h-5 w-5" />, color: 'text-danger' },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.full_name || user?.username}</h1>
        <p className="text-sm text-muted">
          {org ? `${org.name} · ${org.plan} plan · ${org.member_count} members` : "Here's what's happening in your workspace."}
        </p>
      </div>

      {statCards.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {statCards.map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{s.label}</span>
                <span className={s.color}>{s.icon}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
          <Link to="/projects" className="flex items-center gap-1 text-xs text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {projects.map((p: any) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-accent/50 transition-colors">
              <div>
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted">{p.category} · {p.task_count} tasks</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  p.status === 'active' ? 'bg-success/10 text-success' :
                  p.status === 'draft' ? 'bg-muted/20 text-muted' : 'bg-warning/10 text-warning'
                }`}>{p.status}</span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
