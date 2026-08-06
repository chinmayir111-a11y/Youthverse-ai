import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, unwrapError } from '../../lib/api'
import { Alert, Card } from '../../components/ui'
import { ScoreBar } from './shared'
import type { CareerOverview } from '../../types'

/** The eight Career Hub tools, in the order the SRS lists them. */
const TOOLS = [
  {
    to: '/career/resume',
    title: 'Resume Builder',
    blurb: 'Build a structured resume, seeded from your profile.',
    icon: '▤',
  },
  {
    to: '/career/resume#ats',
    title: 'ATS Resume Analysis',
    blurb: 'Score your resume against a real job description.',
    icon: '◎',
  },
  {
    to: '/career/guidance',
    title: 'AI Career Guidance',
    blurb: 'Ask a coach that knows your profile.',
    icon: '✦',
  },
  {
    to: '/career/interviews',
    title: 'Mock Interviews',
    blurb: 'Answer real questions, get graded on what you said.',
    icon: '◈',
  },
  {
    to: '/career/skill-gap',
    title: 'Skill Gap Analysis',
    blurb: 'What a target role wants that you do not have yet.',
    icon: '△',
  },
  {
    to: '/career/roadmap',
    title: 'Roadmap Generator',
    blurb: 'A week-by-week plan you can tick off.',
    icon: '➔',
  },
  {
    to: '/career/companies',
    title: 'Company Preparation',
    blurb: 'How a specific company hires for a specific role.',
    icon: '▣',
  },
  {
    to: '/career/applications',
    title: 'Placement Tracker',
    blurb: 'Every application, and what happens next.',
    icon: '★',
  },
]

export function CareerHome() {
  const [overview, setOverview] = useState<CareerOverview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/career/overview')
      .then(({ data }) => setOverview(data.data))
      .catch((err) => setError(unwrapError(err).message))
  }, [])

  const stages = overview?.applications.byStage
  const active = stages
    ? stages.applied + stages.assessment + stages.interview
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Career Hub</h1>
        <p className="mt-1 text-sm text-slate-600">
          Build the resume, find the gaps, practise the interview, and track where you applied.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Resume strength">
          <ScoreBar value={overview?.resume.completion ?? 0} />
          <p className="mt-2 text-xs text-slate-500">
            {overview?.resume.completion === 100
              ? 'Every section has content.'
              : 'Sections still empty pull this down.'}
          </p>
        </Card>
        <Card title="Mock interviews">
          <p className="text-2xl font-bold text-slate-900">{overview?.interviews.graded ?? 0}</p>
          <p className="text-xs text-slate-500">
            graded of {overview?.interviews.total ?? 0} started
          </p>
        </Card>
        <Card title="Applications">
          <p className="text-2xl font-bold text-slate-900">{overview?.applications.total ?? 0}</p>
          <p className="text-xs text-slate-500">
            {active} still live · {stages?.offer ?? 0} offer{stages?.offer === 1 ? '' : 's'}
          </p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.to}
            to={tool.to}
            className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm text-brand-700"
            >
              {tool.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{tool.title}</span>
              <span className="block text-sm text-slate-600">{tool.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
