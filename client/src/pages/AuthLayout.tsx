import type { ReactNode } from 'react'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <span className="text-xl font-bold tracking-tight text-brand-700">YouthVerse AI</span>
            <h1 className="mt-6 text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>

      <aside className="hidden bg-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <blockquote className="max-w-md">
          <p className="text-2xl leading-snug font-semibold">
            One intelligent platform for learning, career development, collaboration, and community.
          </p>
          <footer className="mt-6 text-sm text-brand-100">
            Study smarter with AI, find mentors, discover opportunities, and build projects — without
            juggling seven different apps.
          </footer>
        </blockquote>
      </aside>
    </div>
  )
}
