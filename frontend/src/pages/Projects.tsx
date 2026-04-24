import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FolderKanban, ArrowRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', visibility: 'private', category: '' })

  useEffect(() => {
    apiFetch<any>('/api/projects?limit=50').then(d => setProjects(d.items)).catch(() => {})
  }, [])

  const handleCreate = async () => {
    try {
      await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(form) })
      setShowCreate(false)
      setForm({ name: '', description: '', visibility: 'private', category: '' })
      const d = await apiFetch<any>('/api/projects?limit=50')
      setProjects(d.items)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted">{projects.length} projects in your workspace</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <input type="text" placeholder="Project name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" rows={3} />
          <div className="flex gap-2">
            <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
              <option value="private">Private</option>
              <option value="internal">Internal</option>
              <option value="public">Public</option>
            </select>
            <input type="text" placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={handleCreate} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">Create</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {projects.map((p: any) => (
          <Link key={p.id} to={`/projects/${p.id}`}
            className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FolderKanban className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted">{p.category}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-3 text-xs text-muted line-clamp-2">{p.description}</p>
            <div className="mt-3 flex items-center gap-3 text-[10px] text-muted">
              <span className={`rounded-full px-2 py-0.5 font-medium ${
                p.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted/20 text-muted'
              }`}>{p.status}</span>
              <span>{p.task_count} tasks</span>
              {p.deadline && <span>Due {p.deadline}</span>}
              <span className={p.visibility === 'public' ? 'text-warning' : ''}>{p.visibility}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
