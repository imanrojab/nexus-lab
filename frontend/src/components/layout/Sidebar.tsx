import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, Users, FileUp, MessageSquare,
  Settings, Shield, ChevronRight, Bell, Compass, Rss, Search,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getUser } from '@/lib/api'

interface NavItem {
  label: string
  icon: React.ReactNode
  to: string
}

export default function Sidebar() {
  const user = getUser()
  const isAdmin = user?.role === 'admin'

  const socialItems: NavItem[] = [
    { label: 'Feed', icon: <Rss className="h-4 w-4" />, to: '/feed' },
    { label: 'Explore', icon: <Compass className="h-4 w-4" />, to: '/explore' },
  ]

  const workspaceItems: NavItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, to: '/' },
    { label: 'Projects', icon: <FolderKanban className="h-4 w-4" />, to: '/projects' },
    { label: 'Team', icon: <Users className="h-4 w-4" />, to: '/team' },
    { label: 'Files', icon: <FileUp className="h-4 w-4" />, to: '/files' },
  ]

  const otherItems: NavItem[] = [
    { label: 'Search', icon: <Search className="h-4 w-4" />, to: '/search' },
    { label: 'Feedback', icon: <MessageSquare className="h-4 w-4" />, to: '/feedback' },
    { label: 'Notifications', icon: <Bell className="h-4 w-4" />, to: '/notifications' },
  ]

  const adminItems: NavItem[] = isAdmin ? [
    { label: 'Admin Panel', icon: <Shield className="h-4 w-4" />, to: '/admin' },
  ] : []

  const renderSection = (title: string, items: NavItem[]) => (
    <>
      <p className="mt-4 first:mt-0 mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
        {title}
      </p>
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            clsx(
              'group flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:bg-accent hover:text-foreground',
            )
          }
        >
          <div className="flex items-center gap-2">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </NavLink>
      ))}
    </>
  )

  return (
    <aside className="fixed left-0 top-14 bottom-0 z-40 w-52 border-r border-border bg-surface overflow-y-auto">
      <div className="flex flex-col gap-0.5 p-3">
        {renderSection('Social', socialItems)}
        {renderSection('Workspace', workspaceItems)}
        {renderSection('Other', otherItems)}
        {adminItems.length > 0 && renderSection('Administration', adminItems)}
      </div>

      <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-surface p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'group flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-accent hover:text-foreground',
            )
          }
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </div>
        </NavLink>
        <p className="mt-2 text-center text-[10px] text-muted">NexusCloud v2.4.1</p>
      </div>
    </aside>
  )
}
