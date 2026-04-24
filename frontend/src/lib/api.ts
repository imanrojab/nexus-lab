export function getToken(): string | null {
  return localStorage.getItem('nc_token')
}

export function setToken(token: string) {
  localStorage.setItem('nc_token', token)
}

export function clearToken() {
  localStorage.removeItem('nc_token')
  localStorage.removeItem('nc_user')
}

export function getUser(): { id: number; username: string; role: string; full_name: string; avatar_url: string; default_org_id?: number; is_private?: boolean } | null {
  const raw = localStorage.getItem('nc_user')
  return raw ? JSON.parse(raw) : null
}

export function setUser(user: Record<string, unknown>) {
  localStorage.setItem('nc_user', JSON.stringify(user))
}

export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (opts.body && typeof opts.body === 'string') headers['Content-Type'] = 'application/json'

  const res = await fetch(path, { ...opts, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}
