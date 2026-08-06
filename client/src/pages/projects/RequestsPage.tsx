import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card } from '../../components/ui'
import { RequestBadge, userOf } from './shared'
import type { CollaborationRequest } from '../../types'

type View = 'received' | 'sent'

export function RequestsPage() {
  const [received, setReceived] = useState<CollaborationRequest[]>([])
  const [sent, setSent] = useState<CollaborationRequest[]>([])
  const [view, setView] = useState<View>('received')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await api.get('/projects/me/requests')
      setReceived(data.data.received)
      setSent(data.data.sent)
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (requestId: string, status: 'accepted' | 'declined' | 'withdrawn') => {
    setError('')
    try {
      await api.patch(`/projects/requests/${requestId}`, { status })
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const rows = view === 'received' ? received : sent
  const pendingReceived = received.filter((r) => r.status === 'pending').length

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projects" className="text-sm font-medium text-brand-600 hover:underline">
          ← All projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Collaboration requests</h1>
        <p className="mt-1 text-sm text-slate-600">
          Who has asked to join your projects, and what happened to the asks you sent.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1" role="tablist" aria-label="Request views">
          {(['received', 'sent'] as View[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                view === key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {key === 'received' ? 'Received' : 'Sent'}
              {key === 'received' && pendingReceived > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-xs text-white">
                  {pendingReceived}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {view === 'received'
            ? 'Nobody has asked to join your projects yet. Turn on "looking for teammates" to invite asks.'
            : "You haven't asked to join anything yet."}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((request) => {
            const requester = userOf(request.requester)
            const project = typeof request.project === 'string' ? null : request.project

            return (
              <Card key={request.id}>
                <div className="flex flex-wrap items-center gap-2">
                  {project ? (
                    <Link
                      to={`/projects/${project.id}`}
                      className="font-semibold text-slate-900 hover:text-brand-700"
                    >
                      {project.title}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-500">A deleted project</span>
                  )}
                  <RequestBadge status={request.status} />
                  <span className="ml-auto text-xs text-slate-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-600">
                  {view === 'received' ? (
                    <>
                      <span className="font-medium">{requester?.name ?? 'A member'}</span> asked to
                      join{request.role ? ` as ${request.role}` : ''}.
                    </>
                  ) : (
                    <>You asked to join{request.role ? ` as ${request.role}` : ''}.</>
                  )}
                </p>

                <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{request.message}</p>

                {request.statusReason && (
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium">Reason: </span>
                    {request.statusReason}
                  </p>
                )}

                {request.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    {view === 'received' ? (
                      <>
                        <Button onClick={() => void act(request.id, 'accepted')}>Accept</Button>
                        <Button variant="secondary" onClick={() => void act(request.id, 'declined')}>
                          Decline
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={() => void act(request.id, 'withdrawn')}>
                        Withdraw
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
