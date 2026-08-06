import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'
import { Alert, Button, Card, Field, Input, Textarea } from '../../components/ui'
import { RequestBadge, StarPicker, Stars, StatusBadge, userOf } from './shared'
import type { CollaborationRequest, Project, ProjectReview } from '../../types'

export function ProjectDetail() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [reviews, setReviews] = useState<ProjectReview[]>([])
  const [requests, setRequests] = useState<CollaborationRequest[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  const [askRole, setAskRole] = useState('')
  const [askMessage, setAskMessage] = useState('')
  const [asking, setAsking] = useState(false)

  const owner = project ? userOf(project.owner) : null
  const isOwner = Boolean(user && owner && owner.id === user.id)

  const load = useCallback(async () => {
    try {
      const [{ data: p }, { data: r }] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/reviews`),
      ])
      setProject(p.data.project)
      setReviews(r.data.reviews)

      // Seed the form with the viewer's existing review so editing it reads as
      // a change rather than a fresh rating.
      const mine = r.data.reviews.find((rev: ProjectReview) => {
        const reviewer = userOf(rev.reviewer)
        return reviewer && user && reviewer.id === user.id
      })
      if (mine) {
        setRating(mine.rating)
        setComment(mine.comment)
      }
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }, [projectId, user])

  useEffect(() => {
    void load()
  }, [load])

  // The owner's inbox for this project. Fetched separately because it 403s for
  // everyone else, and a failed inbox shouldn't blank the page.
  useEffect(() => {
    if (!project?.canManage) return
    api
      .get(`/projects/${projectId}/requests`)
      .then(({ data }) => setRequests(data.data.requests))
      .catch(() => {
        /* the page is still usable without the inbox */
      })
  }, [projectId, project?.canManage])

  const submitReview = async (e: FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setError('Pick a rating from 1 to 5.')
      return
    }
    setError('')
    setNotice('')
    setSavingReview(true)
    try {
      await api.post(`/projects/${projectId}/reviews`, { rating, comment: comment.trim() })
      setNotice('Thanks — your feedback is on the project.')
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSavingReview(false)
    }
  }

  const removeReview = async (reviewId: string) => {
    if (!window.confirm('Delete this review?')) return
    try {
      await api.delete(`/projects/reviews/${reviewId}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const askToJoin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setAsking(true)
    try {
      await api.post(`/projects/${projectId}/requests`, {
        role: askRole.trim(),
        message: askMessage.trim(),
      })
      setNotice('Request sent. The owner will see it in their inbox.')
      setAskMessage('')
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setAsking(false)
    }
  }

  const decide = async (requestId: string, status: 'accepted' | 'declined') => {
    setError('')
    try {
      await api.patch(`/projects/requests/${requestId}`, { status })
      const [{ data: p }, { data: q }] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/requests`),
      ])
      setProject(p.data.project)
      setRequests(q.data.requests)
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const leaveOrRemove = async (userId: string) => {
    const self = user?.id === userId
    if (!window.confirm(self ? 'Leave this project?' : 'Remove this collaborator?')) return
    try {
      await api.delete(`/projects/${projectId}/collaborators/${userId}`)
      await load()
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  const remove = async () => {
    if (!project) return
    if (!window.confirm(`Delete "${project.title}"?`)) return
    try {
      await api.delete(`/projects/${project.id}`)
      navigate('/projects')
    } catch (err) {
      setError(unwrapError(err).message)
    }
  }

  if (error && !project) {
    return (
      <div className="space-y-4">
        <Alert>{error}</Alert>
        <Link to="/projects" className="text-sm font-medium text-brand-600 hover:underline">
          ← Back to projects
        </Link>
      </div>
    )
  }

  if (!project) return <p className="text-sm text-slate-500">Loading…</p>

  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <div className="space-y-5">
      <Link to="/projects" className="text-sm font-medium text-brand-600 hover:underline">
        ← All projects
      </Link>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <div className="flex flex-wrap items-start gap-2">
          <StatusBadge status={project.status} />
          {project.lookingForTeammates && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              Looking for teammates
            </span>
          )}
          <span className="ml-auto">
            <Stars average={project.ratingAverage} count={project.ratingCount} />
          </span>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">{project.title}</h1>
        {project.tagline && <p className="text-slate-600">{project.tagline}</p>}
        <p className="mt-1 text-sm text-slate-500">
          {owner?.name ?? 'A member'} · {new Date(project.createdAt).toLocaleDateString()}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              View code →
            </a>
          )}
          {project.demoUrl && (
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Live demo →
            </a>
          )}
          {project.canManage && (
            <>
              <Link
                to={`/projects/${project.id}/edit`}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Edit
              </Link>
              <Button variant="danger" onClick={() => void remove()}>
                Delete
              </Button>
            </>
          )}
          {project.isCollaborator && user && (
            <Button variant="secondary" onClick={() => void leaveOrRemove(user.id)}>
              Leave project
            </Button>
          )}
        </div>
      </Card>

      <Card title="About this project">
        <p className="text-sm whitespace-pre-wrap text-slate-700">{project.description}</p>

        {project.tech.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Built with</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {project.tech.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {project.tags.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Topics</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {project.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="Team" description={`${project.collaborators.length + 1} on this project.`}>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm text-slate-700">
            <span className="font-medium">{owner?.name ?? 'A member'}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Owner</span>
          </li>
          {project.collaborators.map((c) => {
            const person = userOf(c)
            if (!person) return null
            return (
              <li key={person.id} className="flex items-center gap-2 text-sm text-slate-700">
                <span>{person.name}</span>
                {project.canManage && (
                  <button
                    onClick={() => void leaveOrRemove(person.id)}
                    className="ml-auto text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {project.rolesNeeded.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Still needed
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {project.rolesNeeded.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {project.canManage && pending.length > 0 && (
        <Card title="Requests to join" description={`${pending.length} waiting on you.`}>
          <ul className="space-y-3">
            {pending.map((request) => {
              const requester = userOf(request.requester)
              return (
                <li key={request.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {requester?.name ?? 'A member'}
                    {request.role && <span className="text-slate-500"> · {request.role}</span>}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{request.message}</p>
                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => void decide(request.id, 'accepted')}>Accept</Button>
                    <Button variant="secondary" onClick={() => void decide(request.id, 'declined')}>
                      Decline
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {!isOwner && !project.isCollaborator && project.lookingForTeammates && (
        <Card
          title="Ask to join"
          description="Say what you'd take on and what you've built before. A specific offer gets a specific answer."
        >
          {project.myRequestStatus === 'pending' ? (
            <p className="text-sm text-slate-600">
              Your request is with the owner. You'll see the outcome under Requests.
            </p>
          ) : (
            <form onSubmit={askToJoin} className="space-y-3">
              {project.myRequestStatus === 'declined' && (
                <p className="text-sm text-slate-600">
                  A previous request was declined. You can ask again if things have changed.
                </p>
              )}
              <Field label="Role" hint="Which of the roles above you're answering.">
                <Input
                  value={askRole}
                  onChange={(e) => setAskRole(e.target.value)}
                  placeholder={project.rolesNeeded[0] ?? 'Frontend developer'}
                />
              </Field>
              <Field label="Message">
                <Textarea
                  rows={4}
                  value={askMessage}
                  onChange={(e) => setAskMessage(e.target.value)}
                  placeholder="What you'd work on, and something you've built that shows you can."
                  required
                />
              </Field>
              <Button type="submit" loading={asking}>
                Send request
              </Button>
            </form>
          )}
        </Card>
      )}

      <Card title="Feedback" description={`${reviews.length} so far.`}>
        {!isOwner && (
          <form onSubmit={submitReview} className="mb-5 space-y-3 border-b border-slate-100 pb-5">
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Your rating</span>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <Field label="What worked, and what you'd change">
              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Be specific enough to act on."
              />
            </Field>
            <Button type="submit" loading={savingReview}>
              {project.myRating ? 'Update feedback' : 'Leave feedback'}
            </Button>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">
            No feedback yet.{isOwner ? ' Share the link and ask for some.' : ' Be the first.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((review) => {
              const reviewer = userOf(review.reviewer)
              return (
                <li key={review.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {reviewer?.name ?? 'A member'}
                    </span>
                    <span aria-label={`${review.rating} out of 5`} className="text-sm text-amber-500">
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                    {review.canManage && (
                      <button
                        onClick={() => void removeReview(review.id)}
                        className="ml-auto text-xs font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{review.comment}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {project.myRequestStatus && project.myRequestStatus !== 'pending' && (
        <p className="text-sm text-slate-500">
          Your last request to join was <RequestBadge status={project.myRequestStatus} />.
        </p>
      )}
    </div>
  )
}
