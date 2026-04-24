import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Trash2, Download } from 'lucide-react'
import { apiFetch, getToken } from '@/lib/api'

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = () => apiFetch<any>('/api/files').then(d => setFiles(d.items)).catch(() => {})
  useEffect(() => { refresh() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      await fetch('/api/files/upload?project_id=0', {
        method: 'POST', body: form,
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
      await refresh()
    } catch {}
    setUploading(false)
  }

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/files/${id}`, { method: 'DELETE' })
    await refresh()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Files</h1>
          <p className="text-sm text-muted">{files.length} files uploaded</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload File'}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {files.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">No files uploaded yet</div>
        ) : files.map((f: any) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3">
            <FileText className="h-5 w-5 text-muted" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{f.original_name || f.filename}</p>
              <p className="text-xs text-muted">{f.content_type} · {formatSize(f.size)} · {new Date(f.created_at).toLocaleDateString()}</p>
            </div>
            <a href={`/api/files/${f.id}/download`}
              className="rounded-md p-2 text-muted hover:bg-accent hover:text-foreground">
              <Download className="h-4 w-4" />
            </a>
            <button onClick={() => handleDelete(f.id)} className="rounded-md p-2 text-muted hover:bg-accent hover:text-danger">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
