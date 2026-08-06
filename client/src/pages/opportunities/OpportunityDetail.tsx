import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card } from '../../components/ui'
import { Deadline, TYPE_ONE, TypeBadge } from './shared'
import type { Opportunity } from '../../types'

export function OpportunityDetail() {
  const { opportunityId = '' } = useParams()
  const navigate = useNavigate()

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get(`/opportunities/${opportunityId}`)
      .then(({ data }) => setOpportunity(data.data.opportunity))
      .catch((err) => setError(unwrapError(err).message))
  }, [opportunityId])

  const toggleSave = async () => {
    if (!opportunity) return
    const next = !opportunity.saved
    setOpportunity({ ...opportunity, saved: next })
    try {
      if (next) await api.post(`/opportunities/${opportunity.id}/save`)
      else await api.delete(`/opportunities/${opportunity.id}/save`)
    } catch (err) {
      setError(unwrapError(err).message)
      setOpportunity({ ...opportunity, saved: !next })
    }
  }

  const track = async () => {
    if (!opportunity) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await api.post(`/opportunities/${opportunity.id}/track`)
      setOpportunity({ ...opportunity, tracked: true })
      setNotice('Added to your placement tracker in the Career Hub.')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!opportunity) return
    if (!window.confirm(`Delete "${opportunity.title}"?`)) return
    try {
      await api.delete(`/opportunities/${opportunity.id}`)
      navigate('/opportunities')
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  if (error && !opportunity) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Link to="/opportunities" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to opportunities
        </Link>
      </div>
    )
  }

  if (!opportunity) return <p className="text-sm text-slate-500">Loading…</p>

  const poster = typeof opportunity.postedBy === 'string' ? null : opportunity.postedBy

  return (
    <div className="space-y-5">
      <Link to="/opportunities" className="text-sm font-medium text-brand-600 hover:underline">
        ← All opportunities
      </Link>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {opportunity.expired && (
        <Alert>This listing has closed. It stays readable, but you can no longer apply in time.</Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-start gap-2">
          <TypeBadge type={opportunity.type} />
          {opportunity.isRemote && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Remote
            </span>
          )}
          <span className="ml-auto">
            <Deadline opportunity={opportunity} />
          </span>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">{opportunity.title}</h1>
        <p className="text-slate-600">
          {opportunity.organisation}
          {opportunity.location && !opportunity.isRemote ? ` · ${opportunity.location}` : ''}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {opportunity.reward && (
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {opportunity.type === 'scholarship' ? 'Award' : 'Reward'}
              </dt>
              <dd className="text-sm text-slate-800">{opportunity.reward}</dd>
            </div>
          )}
          {opportunity.startsAt && (
            <div>
              <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Starts</dt>
              <dd className="text-sm text-slate-800">
                {new Date(opportunity.startsAt).toLocaleString([], {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Posted by</dt>
            <dd className="text-sm text-slate-800">
              {poster?.name ?? 'A member'} · {new Date(opportunity.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          {opportunity.link && (
            <a
              href={opportunity.link}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {opportunity.type === 'webinar' || opportunity.type === 'event'
                ? 'Register →'
                : 'Apply →'}
            </a>
          )}
          <Button variant="secondary" onClick={() => void toggleSave()}>
            {opportunity.saved ? 'Saved' : 'Save'}
          </Button>
          <Button
            variant="secondary"
            loading={busy}
            disabled={opportunity.tracked}
            onClick={() => void track()}
          >
            {opportunity.tracked ? 'In your tracker' : 'Track in Career Hub'}
          </Button>
          {opportunity.canManage && (
            <>
              <Link
                to={`/opportunities/${opportunity.id}/edit`}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </Link>
              <Button variant="danger" onClick={() => void remove()}>
                Delete
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card title={`About this ${TYPE_ONE[opportunity.type].toLowerCase()}`}>
        <p className="text-sm whitespace-pre-wrap text-slate-700">{opportunity.description}</p>

        {opportunity.eligibility && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Eligibility
            </h3>
            <p className="mt-1 text-sm text-slate-700">{opportunity.eligibility}</p>
          </div>
        )}

        {opportunity.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {opportunity.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
