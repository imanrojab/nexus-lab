import { Outlet, Navigate } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { getToken } from '@/lib/api'

export default function MainLayout() {
  if (!getToken()) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Sidebar />
      <main className="ml-52 pt-14">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
