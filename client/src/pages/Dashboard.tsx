import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Card } from '../components/ui'
import { NAV_ITEMS } from '../components/layout/nav'

/** Rough "is this profile filled in?" score, to nudge new users. */
function profileCompletion(profile: ReturnType<typeof useAuth>['profile']): number {
  if (!profile) return 0
  const checks = [
    Boolean(profile.bio),
    Boolean(profile.educationLevel),
    Boolean(profile.institution),
    Boolean(profile.fieldOfStudy),
    Boolean(profile.graduationYear),
    profile.skills.length > 0,
    profile.interests.length > 0,
    profile.goals.length > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function Dashboard() {
  const { user, profile } = useAuth()
  const completion = profileCompletion(profile)
  const upcoming = NAV_ITEMS.filter((i) => !i.ready)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Here's where things stand. More modules are landing soon.
        </p>
      </div>

      <Card
        title="Profile strength"
        description="A fuller profile means better AI recommendations later."
      >
        <div className="flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-700 tabular-nums">{completion}%</span>
        </div>
        {completion < 100 && (
          <Link
            to="/profile"
            className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Complete your profile →
          </Link>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Skills">
          <p className="text-2xl font-bold text-slate-900">{profile?.skills.length ?? 0}</p>
          <p className="text-xs text-slate-500">listed on your profile</p>
        </Card>
        <Card title="Interests">
          <p className="text-2xl font-bold text-slate-900">{profile?.interests.length ?? 0}</p>
          <p className="text-xs text-slate-500">topics you're following</p>
        </Card>
        <Card title="Goals">
          <p className="text-2xl font-bold text-slate-900">{profile?.goals.length ?? 0}</p>
          <p className="text-xs text-slate-500">targets you've set</p>
        </Card>
      </div>

      <Card title="Coming next" description="Modules from the spec that aren't built yet.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {upcoming.map((item) => (
            <li key={item.to} className="flex items-center gap-2 text-sm text-slate-600">
              <span aria-hidden="true" className="text-xs text-slate-400">
                {item.icon}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
