import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, MessageSquare, Send } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const user = getUser()
  const [project, setProject] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [commentText, setCommentText] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium' })

  useEffect(() => {
    if (id) apiFetch<any>(`/api/projects/${id}`).then(setProject).catch(() => {})
  }, [id])

  const loadTask = async (taskId: number) => {
    const data = await apiFetch<any>(`/api/projects/${id}/tasks/${taskId}`)
    setSelectedTask(data)
  }

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTask) return
    await apiFetch(`/api/projects/${id}/tasks/${selectedTask.id}/comments`, {
      method: 'POST', body: JSON.stringify({ content: commentText }),
    })
    setCommentText('')
    loadTask(selectedTask.id)
  }

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) return
    await apiFetch(`/api/projects/${id}/tasks`, {
      method: 'POST', body: JSON.stringify({ ...taskForm, assigned_to: user?.id || 0 }),
    })
    setTaskForm({ title: '', description: '', priority: 'medium' })
    setShowAddTask(false)
    const p = await apiFetch<any>(`/api/projects/${id}`)
    setProject(p)
  }

  if (!project) return <div className="text-center py-16 text-muted">Loading...</div>

  const statusColors: Record<string, string> = {
    todo: 'bg-muted/20 text-muted', in_progress: 'bg-primary/10 text-primary',
    review: 'bg-warning/10 text-warning', done: 'bg-success/10 text-success',
  }
  const priorityColors: Record<string, string> = {
    low: 'text-muted', medium: 'text-foreground', high: 'text-warning', critical: 'text-danger',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
        <p className="text-sm text-muted mt-1">{project.description}</p>
        <div className="flex gap-4 mt-2 text-xs text-muted">
          <span>Owner: {project.owner?.full_name}</span>
          <span>Budget: ${project.budget?.toLocaleString()}</span>
          <span>Deadline: {project.deadline || 'None'}</span>
          <span className={`rounded-full bg-accent px-2 py-0.5 ${project.visibility === 'private' ? '' : 'text-warning'}`}>{project.visibility}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Task list */}
        <div className="col-span-1 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Tasks ({project.tasks?.length || 0})</h2>
            <button onClick={() => setShowAddTask(!showAddTask)} className="text-muted hover:text-foreground"><Plus className="h-4 w-4" /></button>
          </div>
          {showAddTask && (
            <div className="border-b border-border p-3 space-y-2">
              <input type="text" placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="flex gap-2">
                <select value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground">
                  <option value="low">Low</option><option value="medium">Medium</option>
                  <option value="high">High</option><option value="critical">Critical</option>
                </select>
                <button onClick={handleAddTask} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Add</button>
              </div>
            </div>
          )}
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {project.tasks?.map((t: any) => (
              <button key={t.id} onClick={() => loadTask(t.id)}
                className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors ${selectedTask?.id === t.id ? 'bg-accent' : ''}`}>
                <p className="text-sm text-foreground">{t.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusColors[t.status] || ''}`}>{t.status}</span>
                  <span className={`text-[9px] font-medium ${priorityColors[t.priority] || ''}`}>{t.priority}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Task detail + comments */}
        <div className="col-span-2 rounded-xl border border-border bg-card">
          {selectedTask ? (
            <div>
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-base font-semibold text-foreground">{selectedTask.title}</h3>
                <p className="mt-2 text-sm text-muted">{selectedTask.description}</p>
                <div className="mt-3 flex gap-4 text-xs text-muted">
                  <span>Status: <span className="text-foreground">{selectedTask.status}</span></span>
                  <span>Priority: <span className={priorityColors[selectedTask.priority]}>{selectedTask.priority}</span></span>
                  <span>Assignee: <span className="text-foreground">{selectedTask.assignee?.full_name || 'Unassigned'}</span></span>
                </div>
              </div>

              {/* VULN: Comments rendered with dangerouslySetInnerHTML for stored XSS */}
              <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <MessageSquare className="h-3.5 w-3.5" /> {selectedTask.comments?.length || 0} Comments
                </div>
                {selectedTask.comments?.map((c: any) => (
                  <div key={c.id} className="rounded-lg bg-accent/50 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">{c.author?.full_name || 'Unknown'}</span>
                      <span className="text-muted">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    {/* VULN: Stored XSS — content rendered as raw HTML */}
                    <div className="mt-1 text-sm text-foreground" dangerouslySetInnerHTML={{ __html: c.content }} />
                  </div>
                ))}
              </div>

              <div className="border-t border-border px-5 py-3 flex gap-2">
                <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment() }}
                />
                <button onClick={handleAddComment} className="rounded-lg bg-primary p-2 text-primary-foreground hover:opacity-90">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16 text-sm text-muted">
              Select a task to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
