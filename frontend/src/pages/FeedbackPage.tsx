import { useState, useEffect } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [form, setForm] = useState({ subject: '', message: '', category: 'general' })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    apiFetch<any>('/api/feedback').then(d => setFeedbacks(d.items)).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.message.trim()) return
    await apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify(form) })
    setForm({ subject: '', message: '', category: 'general' })
    setSubmitted(true)
    const d = await apiFetch<any>('/api/feedback')
    setFeedbacks(d.items)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Feedback</h1>

      {/* Submit form — VULN: Blind XSS target (admin views these) */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Submit Feedback</h2>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
          <option value="general">General</option>
          <option value="bug">Bug Report</option>
          <option value="feature">Feature Request</option>
          <option value="complaint">Complaint</option>
        </select>
        <input type="text" placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary" />
        <textarea placeholder="Describe your feedback in detail..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none" rows={4} />
        <button onClick={handleSubmit}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
          <Send className="h-3.5 w-3.5" /> Submit
        </button>
        {submitted && <p className="text-xs text-success">Thank you! Your feedback has been submitted.</p>}
      </div>

      {/* Previous feedback — admin views with innerHTML (Blind XSS renders here) */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Recent Feedback</h2>
        </div>
        <div className="divide-y divide-border">
          {feedbacks.map((f: any) => (
            <div key={f.id} className="px-5 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted" />
                {/* VULN: Blind XSS — subject rendered as HTML */}
                <span className="text-sm font-medium text-foreground" dangerouslySetInnerHTML={{ __html: f.subject }} />
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                  f.status === 'unread' ? 'bg-warning/10 text-warning' :
                  f.status === 'resolved' ? 'bg-success/10 text-success' : 'bg-muted/20 text-muted'
                }`}>{f.status}</span>
              </div>
              {/* VULN: Blind XSS — message rendered as HTML */}
              <div className="mt-1 text-xs text-muted" dangerouslySetInnerHTML={{ __html: f.message }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
