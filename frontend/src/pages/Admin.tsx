import { useState, useEffect } from 'react'
import { Users, Activity, Download, Send, Bug, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface AdminUser {
  id: number; username: string; email: string; full_name: string
  role: string; department: string; is_active: boolean; created_at: string
}

interface AuditEntry {
  id: number; user_id: number; action: string; resource: string
  resource_id: string; ip_address: string; details: string; created_at: string
}

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'audit' | 'webhooks' | 'export' | 'debug'>('users')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-sm text-muted">System administration and management tools</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['users', 'audit', 'webhooks', 'export', 'debug'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
            }`}>
            {t === 'users' ? 'User Management' : t === 'audit' ? 'Audit Logs' : t === 'webhooks' ? 'Webhook Tester' : t === 'export' ? 'Data Export' : 'Debug Info'}
          </button>
        ))}
      </div>

      {tab === 'users' && <UserManagement />}
      {tab === 'audit' && <AuditLogs />}
      {tab === 'webhooks' && <WebhookTester />}
      {tab === 'export' && <DataExport />}
      {tab === 'debug' && <DebugInfo />}
    </div>
  )
}

/* ── User Management ─────────────────────────────────────────── */

function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editActive, setEditActive] = useState(true)

  useEffect(() => {
    apiFetch<any>('/api/admin/users').then(d => setUsers(d.items)).catch(() => {})
  }, [])

  const handleEdit = (u: AdminUser) => {
    setEditingId(u.id)
    setEditRole(u.role)
    setEditActive(u.is_active)
  }

  const handleSave = async (id: number) => {
    await apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: editRole, is_active: editActive }),
    })
    setEditingId(null)
    const d = await apiFetch<any>('/api/admin/users')
    setUsers(d.items)
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">User Management</h2>
        </div>
        <span className="text-xs text-muted">{users.length} users</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-5 py-2">ID</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Full Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                <td className="px-5 py-2.5 text-muted">{u.id}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{u.username}</td>
                <td className="px-3 py-2.5 text-muted">{u.email}</td>
                <td className="px-3 py-2.5 text-foreground">{u.full_name}</td>
                <td className="px-3 py-2.5">
                  {editingId === u.id ? (
                    <select value={editRole} onChange={e => setEditRole(e.target.value)}
                      className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground">
                      <option value="admin">admin</option>
                      <option value="manager">manager</option>
                      <option value="user">user</option>
                      <option value="guest">guest</option>
                    </select>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.role === 'admin' ? 'bg-danger/10 text-danger' :
                      u.role === 'manager' ? 'bg-warning/10 text-warning' :
                      'bg-primary/10 text-primary'
                    }`}>{u.role}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted">{u.department}</td>
                <td className="px-3 py-2.5">
                  {editingId === u.id ? (
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)}
                        className="rounded" />
                      Active
                    </label>
                  ) : (
                    <span className={`text-xs font-medium ${u.is_active ? 'text-success' : 'text-danger'}`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {editingId === u.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleSave(u.id)}
                        className="rounded bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:opacity-90">Save</button>
                      <button onClick={() => setEditingId(null)}
                        className="rounded bg-surface px-2 py-1 text-[10px] text-muted hover:text-foreground">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => handleEdit(u)}
                      className="text-xs text-primary hover:underline">Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Audit Logs ──────────────────────────────────────────────── */

function AuditLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch<any>('/api/admin/audit-logs').then(d => { setLogs(d.items); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Activity className="h-4 w-4 text-muted" />
        <h2 className="text-sm font-semibold text-foreground">Audit Logs</h2>
      </div>
      {loading ? (
        <div className="py-12 text-center text-sm text-muted">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted">No audit entries found</div>
      ) : (
        <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
          {logs.map(l => (
            <div key={l.id} className="flex items-start gap-3 px-5 py-3 text-xs">
              <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] text-muted">{l.id}</span>
              <div className="flex-1">
                <p className="text-foreground">
                  <span className="font-semibold">{l.action}</span> on <span className="text-primary">{l.resource}</span>
                  {l.resource_id && <span className="text-muted"> #{l.resource_id}</span>}
                </p>
                {l.details && <p className="mt-0.5 text-muted">{l.details}</p>}
              </div>
              <div className="shrink-0 text-right text-muted">
                <p>User #{l.user_id}</p>
                <p>{l.ip_address}</p>
                <p>{new Date(l.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Webhook Tester ──────────────────────────────────────────── */

function WebhookTester() {
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState('GET')
  const [headers, setHeaders] = useState('{}')
  const [body, setBody] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleTest = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      let parsedHeaders = {}
      try { parsedHeaders = JSON.parse(headers) } catch {}
      const data = await apiFetch<any>('/api/admin/webhook-test', {
        method: 'POST',
        body: JSON.stringify({ url, method, headers: parsedHeaders, body }),
      })
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Send className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Webhook Tester</h2>
        </div>
        <p className="text-xs text-muted">Test webhook endpoints and integrations. The server will make an HTTP request to the specified URL.</p>

        <div className="flex gap-2">
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://webhook.example.com/callback"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">Custom Headers (JSON)</label>
          <input type="text" value={headers} onChange={e => setHeaders(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        {method === 'POST' && (
          <div>
            <label className="mb-1 block text-xs text-muted">Request Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        )}

        <button onClick={handleTest} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {loading ? 'Sending...' : 'Send Request'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 text-xs text-danger font-mono whitespace-pre-wrap">{error}</div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Response</h3>
          <div className="flex gap-4 text-xs">
            <span className="text-muted">Status:</span>
            <span className={`font-semibold ${result.status_code < 400 ? 'text-success' : 'text-danger'}`}>{result.status_code}</span>
            <span className="text-muted">Final URL:</span>
            <span className="text-foreground font-mono">{result.url}</span>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Response Headers</p>
            <pre className="rounded-lg bg-background p-3 text-xs font-mono text-muted overflow-x-auto max-h-32">
              {JSON.stringify(result.headers, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Response Body</p>
            <pre className="rounded-lg bg-background p-3 text-xs font-mono text-foreground overflow-x-auto max-h-64 whitespace-pre-wrap">
              {result.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Data Export ──────────────────────────────────────────────── */

function DataExport() {
  const [resource, setResource] = useState('users')
  const [format, setFormat] = useState('json')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    setResult(null)
    try {
      const data = await apiFetch<any>(`/api/admin/export?resource=${resource}&format=${format}`)
      setResult(data)
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Export failed' })
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Download className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Data Export</h2>
        </div>
        <p className="text-xs text-muted">Export system data in various formats for backup or analysis.</p>

        <div className="flex gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Resource</label>
            <select value={resource} onChange={e => setResource(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
              <option value="users">Users</option>
              <option value="projects">Projects</option>
              <option value="task">Tasks</option>
              <option value="feedback">Feedback</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Format</label>
            <select value={format} onChange={e => setFormat(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="html">HTML</option>
              <option value="tabs">TSV</option>
            </select>
          </div>
        </div>

        <button onClick={handleExport} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {loading ? 'Exporting...' : 'Export Data'}
        </button>
      </div>

      {result && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Export Result</h3>
          <pre className="rounded-lg bg-background p-3 text-xs font-mono text-foreground overflow-x-auto max-h-96 whitespace-pre-wrap">
            {result.error ? result.error : result.output ? result.output : JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

/* ── Debug Info ───────────────────────────────────────────────── */

function DebugInfo() {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const handleLoad = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<any>('/api/admin/debug')
      setInfo(data)
    } catch {}
    setLoading(false)
  }

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">System Debug Information</h2>
        </div>
        <p className="text-xs text-muted">View system configuration and environment details for debugging purposes.</p>

        <button onClick={handleLoad} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Bug className="h-3.5 w-3.5" />}
          {loading ? 'Loading...' : 'Load Debug Info'}
        </button>
      </div>

      {info && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {Object.entries(info).map(([key, value]) => (
            <div key={key} className="px-5 py-3">
              <button onClick={() => toggle(key)} className="flex items-center gap-2 w-full text-left">
                {expanded[key] ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                <span className="text-sm font-medium text-foreground">{key}</span>
                {typeof value === 'string' && (
                  <span className="ml-2 text-xs text-muted font-mono truncate max-w-md">{value}</span>
                )}
              </button>
              {expanded[key] && (
                <pre className="mt-2 ml-6 rounded-lg bg-background p-3 text-xs font-mono text-foreground overflow-x-auto max-h-64 whitespace-pre-wrap">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
