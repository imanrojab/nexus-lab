import { Link, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Search, User } from 'lucide-react'
import { clearToken, getUser } from '@/lib/api'

export default function Navbar() {
  const navigate = useNavigate()
  const user = getUser()

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-surface/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="text-base font-semibold text-foreground">NexusCloud</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { to: '/', label: 'Dashboard' },
            { to: '/projects', label: 'Projects' },
            { to: '/team', label: 'Team' },
            { to: '/files', label: 'Files' },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link to="/search" className="rounded-md p-2 text-muted hover:bg-accent hover:text-foreground">
          <Search className="h-4 w-4" />
        </Link>
        <Link to="/notifications" className="rounded-md p-2 text-muted hover:bg-accent hover:text-foreground relative">
          <Bell className="h-4 w-4" />
        </Link>

        {user && (
          <div className="flex items-center gap-2">
            <Link to={`/profile/${user.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-accent hover:text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
              </div>
              <span className="hidden md:inline">{user.full_name || user.username}</span>
            </Link>
            <button onClick={handleLogout} className="rounded-md p-2 text-muted hover:bg-accent hover:text-danger" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
