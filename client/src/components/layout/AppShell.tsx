import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { api } from '../../lib/api'
import { NAV_ITEMS } from './nav'

/**
 * How often the badge re-checks.
 *
 * There is no realtime transport in this app, so this is a poll. Sixty seconds
 * is slow enough to be negligible against a count query and fast enough that a
 * reply doesn't sit unseen for a whole session — and it re-checks on every
 * navigation anyway, which is what actually catches most of it.
 */
const POLL_MS = 60_000

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count')
      setUnread(data.data.unread)
    } catch {
      // A failed badge must never take the shell down with it.
    }
  }, [])

  useEffect(() => {
    void refreshUnread()
    const id = window.setInterval(() => void refreshUnread(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshUnread])

  // Also re-check whenever the route changes — opening the notifications page
  // and marking things read should clear the badge without waiting a minute.
  useEffect(() => {
    void refreshUnread()
  }, [location.pathname, refreshUnread])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV_ITEMS.map((item) =>
        item.ready ? (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <span aria-hidden="true" className="w-4 text-center text-xs">
              {item.icon}
            </span>
            {item.label}
            {item.to === '/notifications' && unread > 0 && (
              <span className="ml-auto rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </NavLink>
        ) : (
          <span
            key={item.to}
            aria-disabled="true"
            title="Not built yet"
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400"
          >
            <span aria-hidden="true" className="w-4 text-center text-xs">
              {item.icon}
            </span>
            {item.label}
            <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
              Soon
            </span>
          </span>
        ),
      )}
    </nav>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-100 px-5 py-4">
          <span className="text-lg font-bold tracking-tight text-brand-700">YouthVerse AI</span>
          <p className="text-xs text-slate-500">Learn. Connect. Grow.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{nav}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <span className="font-semibold text-brand-700 lg:hidden">YouthVerse AI</span>

          <div className="ml-auto flex items-center gap-3">
            <NavLink
              to="/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <span aria-hidden="true" className="text-base">
                ◉
              </span>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white tabular-nums">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </NavLink>

            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            <div
              className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
              aria-hidden="true"
            >
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="border-b border-slate-200 bg-white p-3 lg:hidden">{nav}</div>
        )}

        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
