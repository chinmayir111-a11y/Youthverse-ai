import { useEffect, useState, type ReactNode } from 'react'
import { api, unwrapError } from '../../lib/api'
import { Alert, Button, Card, Field, Input, Textarea } from '../../components/ui'
import { AtsPanel } from './AtsPanel'
import type { Resume, ResumeEducation, ResumeExperience, ResumeProject } from '../../types'

const TABS = [
  { key: 'editor', label: 'Editor' },
  { key: 'preview', label: 'Preview' },
  { key: 'ats', label: 'ATS check' },
] as const

type TabKey = (typeof TABS)[number]['key']

/** Multi-line text ↔ string[]: the way people actually type bullet lists. */
const linesToArray = (value: string) =>
  value
    .split('\n')
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)

const commasToArray = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

function Repeatable<T>({
  title,
  items,
  onChange,
  blank,
  render,
}: {
  title: string
  items: T[]
  onChange: (next: T[]) => void
  blank: () => T
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode
}) {
  const replace = (index: number, patch: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <Button variant="secondary" type="button" onClick={() => onChange([...items, blank()])}>
          Add
        </Button>
      </div>

      {items.length === 0 && <p className="text-sm text-slate-500">Nothing added yet.</p>}

      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-slate-200 p-3">
          {render(item, (patch) => replace(index, patch))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}

function Preview({ resume }: { resume: Resume }) {
  const line = (parts: (string | number | null)[]) => parts.filter(Boolean).join(' · ')

  return (
    <article className="space-y-5 text-sm text-slate-700">
      <header className="border-b border-slate-200 pb-3">
        <h2 className="text-xl font-bold text-slate-900">{resume.fullName || 'Your name'}</h2>
        {resume.headline && <p className="text-slate-600">{resume.headline}</p>}
        <p className="mt-1 text-xs text-slate-500">
          {line([resume.email, resume.phone, resume.location])}
        </p>
        {resume.links.length > 0 && (
          <p className="text-xs break-all text-slate-500">{resume.links.join(' · ')}</p>
        )}
      </header>

      {resume.summary && <p>{resume.summary}</p>}

      {resume.experience.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Experience
          </h3>
          {resume.experience.map((x, i) => (
            <div key={i} className="mb-3">
              <p className="font-medium text-slate-900">{line([x.title, x.organisation])}</p>
              <p className="text-xs text-slate-500">{line([x.startDate, x.endDate])}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {x.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.projects.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Projects
          </h3>
          {resume.projects.map((p, i) => (
            <div key={i} className="mb-3">
              <p className="font-medium text-slate-900">{line([p.name, p.tech.join(', ')])}</p>
              {p.link && <p className="text-xs break-all text-slate-500">{p.link}</p>}
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {p.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.education.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Education
          </h3>
          {resume.education.map((e, i) => (
            <div key={i} className="mb-2">
              <p className="font-medium text-slate-900">{line([e.qualification, e.institution])}</p>
              <p className="text-xs text-slate-500">
                {line([[e.startYear, e.endYear].filter(Boolean).join('–'), e.grade])}
              </p>
            </div>
          ))}
        </section>
      )}

      {resume.skills.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Skills
          </h3>
          <p>{resume.skills.join(' · ')}</p>
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Certifications
          </h3>
          <p>{resume.certifications.join(' · ')}</p>
        </section>
      )}

      {resume.achievements.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Achievements
          </h3>
          <ul className="list-disc space-y-0.5 pl-5">
            {resume.achievements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

export function ResumePage() {
  const [resume, setResume] = useState<Resume | null>(null)
  const [tab, setTab] = useState<TabKey>(
    // Deep link from the Career Hub tile: /career/resume#ats opens the check.
    window.location.hash === '#ats' ? 'ats' : 'editor',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    api
      .get('/career/resume')
      .then(({ data }) => setResume(data.data.resume))
      .catch((err) => setError(unwrapError(err).message))
  }, [])

  const patch = (updates: Partial<Resume>) => {
    setSaved('')
    setResume((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  const save = async () => {
    if (!resume) return
    setError('')
    setSaved('')
    setSaving(true)
    try {
      const { data } = await api.put('/career/resume', {
        fullName: resume.fullName,
        headline: resume.headline,
        email: resume.email,
        phone: resume.phone,
        location: resume.location,
        links: resume.links,
        summary: resume.summary,
        education: resume.education,
        experience: resume.experience,
        projects: resume.projects,
        skills: resume.skills,
        certifications: resume.certifications,
        achievements: resume.achievements,
      })
      // Take the server's copy back: it trims, de-duplicates, and drops blanks,
      // so keeping local state would quietly diverge from what was stored.
      setResume(data.data.resume)
      setSaved('Resume saved.')
    } catch (err) {
      setError(unwrapError(err).message)
    } finally {
      setSaving(false)
    }
  }

  if (error && !resume) return <Alert>{error}</Alert>
  if (!resume) return <p className="text-sm text-slate-500">Loading resume…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resume</h1>
          <p className="mt-1 text-sm text-slate-600">
            Started from your profile. Edit it here, then check it against a job description.
          </p>
        </div>
        {tab === 'editor' && (
          <Button onClick={() => void save()} loading={saving}>
            Save resume
          </Button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}
      {saved && <Alert kind="success">{saved}</Alert>}

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1" role="tablist" aria-label="Resume tools">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'editor' && (
        <div className="space-y-5">
          <Card title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={resume.fullName}
                  onChange={(e) => patch({ fullName: e.target.value })}
                />
              </Field>
              <Field label="Headline" hint="One line: what you are and what you want.">
                <Input
                  value={resume.headline}
                  onChange={(e) => patch({ headline: e.target.value })}
                  placeholder="Final-year CS student · backend"
                />
              </Field>
              <Field label="Email">
                <Input value={resume.email} onChange={(e) => patch({ email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input value={resume.phone} onChange={(e) => patch({ phone: e.target.value })} />
              </Field>
              <Field label="Location">
                <Input
                  value={resume.location}
                  onChange={(e) => patch({ location: e.target.value })}
                />
              </Field>
              <Field label="Links" hint="Comma separated.">
                <Input
                  defaultValue={resume.links.join(', ')}
                  onBlur={(e) => patch({ links: commasToArray(e.target.value) })}
                />
              </Field>
            </div>
          </Card>

          <Card title="Summary" description="Two or three lines. Skip it rather than pad it.">
            <Textarea
              rows={3}
              value={resume.summary}
              onChange={(e) => patch({ summary: e.target.value })}
            />
          </Card>

          <Card>
            <Repeatable<ResumeExperience>
              title="Experience"
              items={resume.experience}
              onChange={(experience) => patch({ experience })}
              blank={() => ({
                organisation: '',
                title: '',
                startDate: '',
                endDate: '',
                bullets: [],
              })}
              render={(item, update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Title">
                      <Input value={item.title} onChange={(e) => update({ title: e.target.value })} />
                    </Field>
                    <Field label="Organisation">
                      <Input
                        value={item.organisation}
                        onChange={(e) => update({ organisation: e.target.value })}
                      />
                    </Field>
                    <Field label="From">
                      <Input
                        value={item.startDate}
                        onChange={(e) => update({ startDate: e.target.value })}
                        placeholder="Jun 2025"
                      />
                    </Field>
                    <Field label="To">
                      <Input
                        value={item.endDate}
                        onChange={(e) => update({ endDate: e.target.value })}
                        placeholder="Aug 2025"
                      />
                    </Field>
                  </div>
                  <Field label="Bullets" hint="One per line. Lead with the outcome.">
                    <Textarea
                      rows={3}
                      defaultValue={item.bullets.join('\n')}
                      onBlur={(e) => update({ bullets: linesToArray(e.target.value) })}
                    />
                  </Field>
                </>
              )}
            />
          </Card>

          <Card>
            <Repeatable<ResumeProject>
              title="Projects"
              items={resume.projects}
              onChange={(projects) => patch({ projects })}
              blank={() => ({ name: '', link: '', tech: [], bullets: [] })}
              render={(item, update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name">
                      <Input value={item.name} onChange={(e) => update({ name: e.target.value })} />
                    </Field>
                    <Field label="Link">
                      <Input value={item.link} onChange={(e) => update({ link: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Tech" hint="Comma separated.">
                    <Input
                      defaultValue={item.tech.join(', ')}
                      onBlur={(e) => update({ tech: commasToArray(e.target.value) })}
                    />
                  </Field>
                  <Field label="Bullets" hint="One per line.">
                    <Textarea
                      rows={3}
                      defaultValue={item.bullets.join('\n')}
                      onBlur={(e) => update({ bullets: linesToArray(e.target.value) })}
                    />
                  </Field>
                </>
              )}
            />
          </Card>

          <Card>
            <Repeatable<ResumeEducation>
              title="Education"
              items={resume.education}
              onChange={(education) => patch({ education })}
              blank={() => ({
                institution: '',
                qualification: '',
                startYear: null,
                endYear: null,
                grade: '',
              })}
              render={(item, update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Qualification">
                    <Input
                      value={item.qualification}
                      onChange={(e) => update({ qualification: e.target.value })}
                      placeholder="B.Tech Computer Science"
                    />
                  </Field>
                  <Field label="Institution">
                    <Input
                      value={item.institution}
                      onChange={(e) => update({ institution: e.target.value })}
                    />
                  </Field>
                  <Field label="Start year">
                    <Input
                      type="number"
                      value={item.startYear ?? ''}
                      onChange={(e) =>
                        update({ startYear: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </Field>
                  <Field label="End year">
                    <Input
                      type="number"
                      value={item.endYear ?? ''}
                      onChange={(e) =>
                        update({ endYear: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </Field>
                  <Field label="Grade">
                    <Input value={item.grade} onChange={(e) => update({ grade: e.target.value })} />
                  </Field>
                </div>
              )}
            />
          </Card>

          <Card title="Skills, certifications, achievements">
            <div className="space-y-4">
              <Field label="Skills" hint="Comma separated. Duplicates are removed on save.">
                <Input
                  defaultValue={resume.skills.join(', ')}
                  onBlur={(e) => patch({ skills: commasToArray(e.target.value) })}
                />
              </Field>
              <Field label="Certifications" hint="Comma separated.">
                <Input
                  defaultValue={resume.certifications.join(', ')}
                  onBlur={(e) => patch({ certifications: commasToArray(e.target.value) })}
                />
              </Field>
              <Field label="Achievements" hint="One per line.">
                <Textarea
                  rows={3}
                  defaultValue={resume.achievements.join('\n')}
                  onBlur={(e) => patch({ achievements: linesToArray(e.target.value) })}
                />
              </Field>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={saving}>
              Save resume
            </Button>
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <Card
          title="Preview"
          description="Roughly what a reader sees. Unsaved edits appear here too."
        >
          <Preview resume={resume} />
        </Card>
      )}

      {tab === 'ats' && <AtsPanel />}
    </div>
  )
}
