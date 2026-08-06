/**
 * The 12 SRS modules. `ready: false` renders a visible "Soon" badge and a
 * disabled link, so the full product shape is legible from day one without
 * pretending unbuilt features work.
 */
export interface NavItem {
  label: string
  to: string
  icon: string
  ready: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: '◈', ready: true },
  { label: 'AI Study Hub', to: '/study', icon: '◆', ready: true },
  { label: 'Community', to: '/community', icon: '◇', ready: true },
  { label: 'Career Hub', to: '/career', icon: '▲', ready: true },
  { label: 'Mentorship', to: '/mentorship', icon: '△', ready: true },
  { label: 'Opportunities', to: '/opportunities', icon: '★', ready: true },
  { label: 'Projects', to: '/projects', icon: '▣', ready: true },
  { label: 'Resources', to: '/resources', icon: '▤', ready: true },
  { label: 'AI Mentor', to: '/mentor', icon: '✦', ready: true },
  { label: 'Wellbeing', to: '/wellbeing', icon: '❋', ready: true },
  { label: 'Notifications', to: '/notifications', icon: '◉', ready: true },
  { label: 'Profile', to: '/profile', icon: '●', ready: true },
]
