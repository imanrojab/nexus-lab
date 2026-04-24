import { useState } from 'react'
import { Save, ExternalLink } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api'

export default function SettingsPage() {
  const user = getUser()
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: '',
    current_password: '',
    new_password: '',
  })
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    const updates: Record<string, string> = {}
    if (form.full_name) updates.full_name = form.full_name
    if (form.email) updates.email = form.email

    if (Object.keys(updates).length) {
      await apiFetch(`/api/users/${user?.id}`, { method: 'PATCH', body: JSON.stringify(updates) })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Account Settings</h2>

        <div>
          <label className="mb-1 block text-xs text-muted">Full Name</label>
          <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">Email</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="new@email.com"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <hr className="border-border" />

        <h2 className="text-sm font-semibold text-foreground">Change Password</h2>

        <div>
          <label className="mb-1 block text-xs text-muted">Current Password</label>
          <input type="password" value={form.current_password} onChange={e => setForm({ ...form, current_password: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">New Password</label>
          <input type="password" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <button onClick={handleSave}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
          <Save className="h-3.5 w-3.5" /> Save Changes
        </button>
        {saved && <p className="text-xs text-success">Settings saved successfully.</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">About</h2>
        <p className="text-xs text-muted">NexusCloud v2.4.1 — Cloud workspace & collaboration platform.</p>
        <a
          href="/blog/vuln-list"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:bg-accent hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Security Lab Reference
        </a>
      </div>
    </div>
  )
}
