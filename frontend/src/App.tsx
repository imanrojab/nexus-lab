import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '@/components/layout/MainLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import Projects from '@/pages/Projects'
import ProjectDetail from '@/pages/ProjectDetail'
import Team from '@/pages/Team'
import Profile from '@/pages/Profile'
import SearchPage from '@/pages/SearchPage'
import Files from '@/pages/Files'
import FeedbackPage from '@/pages/FeedbackPage'
import Notifications from '@/pages/Notifications'
import Settings from '@/pages/Settings'
import Admin from '@/pages/Admin'
import Feed from '@/pages/Feed'
import PostDetail from '@/pages/PostDetail'
import Explore from '@/pages/Explore'
import VulnList from '@/pages/VulnList'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/blog/vuln-list" element={<VulnList />} />

        {/* Authenticated */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/team" element={<Team />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/files" element={<Files />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
