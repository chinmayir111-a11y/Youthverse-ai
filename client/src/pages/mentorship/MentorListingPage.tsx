import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Select, Textarea } from '../../components/ui'
import { DAY_NAMES, Stars } from './shared'
import type { AvailabilitySlot, MentorProfile } from '../../types'

const commasToArray = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export function MentorListingPage() {
  const [mentor, setMentor] = useState<MentorProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    api
      .get('/mentorship/me/mentor-profile')
      .then(({ data }) => setMentor(data.data.mentor))
      .catch((err) => setError(unwrapError(err).message))
  }, [])

  const patch = (updates: Partial<MentorProfile>) => {
    setSaved('')
    setMentor((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  const save = async (overrides: Partial<MentorProfile> = {}) => {
    if (!mentor) return
    const next = { ...mentor, ...overrides }
    setError('')
    setSaved('')
    setSaving(true)
    try {
      const { data } = await api.put('/mentorship/me/mentor-profile', {
        headline: next.headline,
        bio: next.bio,
        expertise: next.expertise,
        languages: next.languages,
        yearsExperience: next.yearsExperience,
        currentRole: next.currentRole,
        organisation: next.organisation,
        sessionLengthMinutes: next.sessionLengthMinutes,
        availability: next.availability,
        isPublished: next.isPublished,
        acceptingMentees: next.acceptingMentees,
      })
      setMentor(data.data.mentor)
      setSaved(data.data.mentor.isPublished ? 'Saved. Your listing is live.' : 'Saved as a draft.')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const setSlot = (index: number, patchSlot: Partial<AvailabilitySlot>) =>
    patch({
      availability: mentor!.availability.map((s, i) => (i === index ? { ...s, ...patchSlot } : s)),
    })

  if (error && !mentor) return <Alert>{error}</Alert>
  if (!mentor) return <p className="text-sm text-slate-500">Loading your listing…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My mentor listing</h1>
          <p className="mt-1 text-sm text-slate-600">
            This is what students see in the directory. It stays hidden until you publish it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Stars value={mentor.ratingAverage} count={mentor.ratingCount} />
          {mentor.isPublished && (
            <Link
              to={`/mentorship/mentors/${mentor.user.id}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View public page
            </Link>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {saved && <Alert kind="success">{saved}</Alert>}

      <Card
        title={mentor.isPublished ? 'Live in the directory' : 'Not published yet'}
        description={
          mentor.isPublished
            ? 'Students can find and book you.'
            : 'Add a headline, at least one area of expertise, and one availability window to publish.'
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mentor.isPublished ? 'secondary' : 'primary'}
            loading={saving}
            onClick={() => void save({ isPublished: !mentor.isPublished })}
          >
            {mentor.isPublished ? 'Unpublish' : 'Publish listing'}
          </Button>
          {mentor.isPublished && (
            <Button
              variant="secondary"
              loading={saving}
              onClick={() => void save({ acceptingMentees: !mentor.acceptingMentees })}
            >
              {mentor.acceptingMentees ? 'Pause new sessions' : 'Resume taking sessions'}
            </Button>
          )}
        </div>
        {mentor.isPublished && !mentor.acceptingMentees && (
          <p className="mt-2 text-sm text-slate-500">
            Your page is still visible, but the booking form is closed.
          </p>
        )}
      </Card>

      <Card title="About you">
        <div className="space-y-4">
          <Field label="Headline" hint="One line. What would someone come to you for?">
            <Input
              value={mentor.headline}
              onChange={(e) => patch({ headline: e.target.value })}
              placeholder="Backend engineer, 6 years, ex-fintech"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current role">
              <Input
                value={mentor.currentRole}
                onChange={(e) => patch({ currentRole: e.target.value })}
              />
            </Field>
            <Field label="Organisation">
              <Input
                value={mentor.organisation}
                onChange={(e) => patch({ organisation: e.target.value })}
              />
            </Field>
            <Field label="Years of experience">
              <Input
                type="number"
                min={0}
                max={60}
                value={mentor.yearsExperience}
                onChange={(e) => patch({ yearsExperience: Number(e.target.value) })}
              />
            </Field>
            <Field label="Session length">
              <Select
                value={String(mentor.sessionLengthMinutes)}
                onChange={(e) =>
                  patch({ sessionLengthMinutes: Number(e.target.value) as MentorProfile['sessionLengthMinutes'] })
                }
              >
                {[15, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Expertise" hint="Comma separated. These are the filter tags students browse by.">
            <Input
              defaultValue={mentor.expertise.join(', ')}
              onBlur={(e) => patch({ expertise: commasToArray(e.target.value) })}
              placeholder="Node.js, System Design, Databases"
            />
          </Field>
          <Field label="Languages" hint="Comma separated.">
            <Input
              defaultValue={mentor.languages.join(', ')}
              onBlur={(e) => patch({ languages: commasToArray(e.target.value) })}
            />
          </Field>
          <Field label="Bio">
            <Textarea
              rows={4}
              value={mentor.bio}
              onChange={(e) => patch({ bio: e.target.value })}
              placeholder="Who you help, and what you're actually good at."
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Weekly availability"
        description="Students can only book inside these windows. Times are in your local timezone."
      >
        <div className="space-y-3">
          {mentor.availability.length === 0 && (
            <p className="text-sm text-slate-500">
              No hours set. Students cannot book you until you add at least one window.
            </p>
          )}

          {mentor.availability.map((slot, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3">
              <Field label="Day">
                <Select value={String(slot.day)} onChange={(e) => setSlot(index, { day: Number(e.target.value) })}>
                  {DAY_NAMES.map((name, day) => (
                    <option key={day} value={day}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="From">
                <Input type="time" value={slot.start} onChange={(e) => setSlot(index, { start: e.target.value })} />
              </Field>
              <Field label="To">
                <Input type="time" value={slot.end} onChange={(e) => setSlot(index, { end: e.target.value })} />
              </Field>
              <button
                type="button"
                onClick={() =>
                  patch({ availability: mentor.availability.filter((_, i) => i !== index) })
                }
                className="pb-2.5 text-xs font-medium text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}

          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              patch({
                availability: [...mentor.availability, { day: 2, start: '18:00', end: '20:00' }],
              })
            }
          >
            Add a window
          </Button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void save()} loading={saving}>
          Save listing
        </Button>
      </div>
    </div>
  )
}
