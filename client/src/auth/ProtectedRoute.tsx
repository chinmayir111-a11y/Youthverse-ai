import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { FullPageSpinner } from '../components/FullPageSpinner'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Wait for the session check; redirecting early would bounce a logged-in
  // user to /login on every hard refresh.
  if (loading) return <FullPageSpinner label="Checking your session…" />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
