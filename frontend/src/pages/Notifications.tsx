import { useState, useEffect } from 'react'
import { Bell, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([])
  const [unread, setUnread] = useState(0)

  const refresh = () => {
    apiFetch<any>('/api/notifications').then(d => {
      setNotifs(d.items)
      setUnread(d.unread_count)
    }).catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  const handleMarkRead = async (id: number) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    refresh()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted">{unread} unread</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {notifs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No notifications</div>
        ) : notifs.map((n: any) => (
          <div key={n.id} className={`flex items-start gap-3 px-5 py-3 ${!n.is_read ? 'bg-primary/5' : ''}`}>
            <Bell className={`mt-0.5 h-4 w-4 ${!n.is_read ? 'text-primary' : 'text-muted'}`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{n.title}</p>
              {/* VULN: DOM XSS — notification message rendered as HTML */}
              <div className="text-xs text-muted mt-0.5" dangerouslySetInnerHTML={{ __html: n.message }} />
              <p className="text-[10px] text-muted/50 mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            {!n.is_read && (
              <button onClick={() => handleMarkRead(n.id)} className="text-muted hover:text-success" title="Mark read">
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
