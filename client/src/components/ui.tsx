import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import type { FieldError } from '../types'

export function Card({
  title,
  description,
  children,
  actions,
}: {
  title?: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60'
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && (
        <span className="mt-1 block text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

const controlClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClasses} ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClasses} ${className}`} {...rest} />
}

export function Select({
  className = '',
  children,
  ...rest
}: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={`${controlClasses} ${className}`} {...rest}>
      {children}
    </select>
  )
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success'; children: ReactNode }) {
  const styles =
    kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`} role="alert">
      {children}
    </div>
  )
}

/** Look up a server-side validation error for one field. */
export function fieldError(fields: FieldError[], name: string): string | undefined {
  return fields.find((f) => f.field === name)?.message
}

export function TagInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  id?: string
}) {
  return (
    <div>
      <Input
        id={id}
        defaultValue={value.join(', ')}
        placeholder={placeholder}
        onBlur={(e) =>
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
