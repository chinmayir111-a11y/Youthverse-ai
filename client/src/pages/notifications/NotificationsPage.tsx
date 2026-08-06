import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card } from '../../components/ui'
import type { AppNotification, NotificationCategory, NotificationPreferences } from '../../types'

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  discussions: 'Discussions',
  opportunities: 'Opportunities',
  reminders: 'Reminders',
  suggestions: 'Suggestions',
  collaboration: 'Collaboration',
}

const CATEGORY_HINT: Record<NotificationCategory, string> = {
  discussions: 'Replies to your threads, best answers, new posts where you’re active.',
  opportunities: 'New internships and scholarships that match your profile.',
  reminders: 'Deadlines you saved, sessions coming up, goals due.',
  suggestions: 'Nudges from the AI Mentor.',
  collaboration: 'Teammate requests, session changes, messages, feedback.',
}

const CATEGORY_TONE: Record<NotificationCategory, string> = {
  discussions: 'bg-sky-50 text-sky-800 ring-sky-200',
  opportunities: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  reminders: 'bg-amber-50 text-amber-900 ring-amber-200',
  suggestions: 'bg-violet-50 text-violet-800 ring-violet-200',
  collaboration: 'bg-brand-50 text-brand-700 ring-brand-200',
}

/** "3 hours ago" beats a timestamp for something you check several times a day. */
function ago(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [category, setCategory] = useState<NotificationCategory | ''>('')
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const params: Record<string, string> = {}
      if (onlyUnread) params.unread = 'true'
      if (category) params.category = category

      const { data } = await api.get('/notifications', { params })
      setNotifications(data.data.notifications)
      setUnread(data.data.unread)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [onlyUnread, category])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    api
      .get('/notifications/preferences')
      .then(({ data }) => setPreferences(data.data.preferences))
      .catch(() => {
        /* the list still works without the preference panel */
      })
  }, [])

  // Time-based alerts are computed on demand rather than by a scheduler, so
  // opening this page is what makes them appear.
  const sync = useCallback(
    async (quiet = false) => {
      if (!quiet) setSyncing(true)
      try {
        const { data } = await api.post('/notifications/sync')
        if (!quiet && data.data.created > 0) {
          setNotice(`${data.data.created} new notification${data.data.created === 1 ? '' : 's'}.`)
        }
        await load()
      } catch (err) {
        if (!quiet) setError(unwrapError(err).message)
      } finally {
        setSyncing(false)
      }
    },
    [load],
  )

  useEffect(() => {
    void sync(true)
    // Runs once on open; the button re-runs it on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markRead = async (notification: AppNotification, read: boolean) => {
    try {
      await api.patch(`/notifications/${notification.id}/read`, { read })
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all')
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const clearRead = async () => {
    if (!window.confirm('Remove everything you have already read?')) return
    try {
      await api.delete('/notifications/read')
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const remove = async (notification: AppNotification) => {
    try {
      await api.delete(`/notifications/${notification.id}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const toggleMute = async (target: NotificationCategory) => {
    if (!preferences) return
    const muted = preferences.muted.includes(target)
      ? preferences.muted.filter((c) => c !== target)
      : [...preferences.muted, target]
    try {
      const { data } = await api.put('/notifications/preferences', { muted })
      setPreferences(data.data.preferences)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            {unread > 0 ? `${unread} unread.` : 'Nothing unread.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={syncing} onClick={() => void sync()}>
            Check for new
          </Button>
          <Button variant="secondary" onClick={() => setShowPrefs((s) => !s)}>
            {showPrefs ? 'Hide settings' : 'Settings'}
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {showPrefs && preferences && (
        <Card title="What you hear about" description="Muting stops new notifications in that category.">
          <ul className="space-y-3">
            {preferences.categories.map((cat) => (
              <li key={cat} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`mute-${cat}`}
                  checked={!preferences.muted.includes(cat)}
                  onChange={() => void toggleMute(cat)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor={`mute-${cat}`} className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">
                    {CATEGORY_LABEL[cat]}
                  </span>
                  <span className="block text-sm text-slate-600">{CATEGORY_HINT[cat]}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setCategory('')}
            aria-pressed={category === ''}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              category === ''
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {preferences?.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat === category ? '' : cat)}
              aria-pressed={category === cat}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === cat
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {CATEGORY_LABEL[cat]}
            </button>
          ))}

          <label className="ml-auto flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => setOnlyUnread(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Unread only
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <button
            onClick={() => void markAll()}
            disabled={unread === 0}
            className="font-medium text-brand-600 hover:underline disabled:text-slate-300 disabled:no-underline"
          >
            Mark all read
          </button>
          <button onClick={() => void clearRead()} className="font-medium text-slate-500 hover:underline">
            Clear read
          </button>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-slate-500">
          {onlyUnread || category
            ? 'Nothing here with those filters.'
            : "Nothing yet. Deadlines and alerts show up when you open this page — there's no background job sending them."}
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`rounded-xl border p-4 transition ${
                notification.read ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${CATEGORY_TONE[notification.category]}`}
                >
                  {CATEGORY_LABEL[notification.category]}
                </span>
                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />
                )}
                <span className="ml-auto text-xs text-slate-500">{ago(notification.createdAt)}</span>
              </div>

              <p className="mt-2 text-sm font-medium text-slate-900">{notification.title}</p>
              {notification.body && (
                <p className="mt-0.5 text-sm text-slate-600">{notification.body}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                {notification.link && (
                  <Link
                    to={notification.link}
                    onClick={() => void markRead(notification, true)}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    Open →
                  </Link>
                )}
                <button
                  onClick={() => void markRead(notification, !notification.read)}
                  className="font-medium text-slate-500 hover:underline"
                >
                  Mark {notification.read ? 'unread' : 'read'}
                </button>
                <button
                  onClick={() => void remove(notification)}
                  className="ml-auto font-medium text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
