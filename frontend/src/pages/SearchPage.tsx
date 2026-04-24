import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setError('')
    setSearched(true)
    try {
      // VULN: SQL injection via search query
      const data = await apiFetch<any>(`/api/users/search/query?q=${encodeURIComponent(query)}`)
      setResults(data.results || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setResults([])
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Search</h1>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search users, projects..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          />
        </div>
        <button onClick={handleSearch} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Search
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-xs text-danger font-mono whitespace-pre-wrap">
          {error}
        </div>
      )}

      {searched && results.length === 0 && !error && (
        <p className="text-center text-sm text-muted py-8">No results found for "{query}"</p>
      )}

      {results.length > 0 && (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {results.map((r: any, i: number) => (
            <Link key={i} to={`/profile/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                {(r.full_name || r.username || '?').charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{r.full_name || r.username}</p>
                <p className="text-xs text-muted">{r.email} · {r.role} · {r.department}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
