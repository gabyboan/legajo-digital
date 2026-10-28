import type { ReactNode } from 'react'

export const personaInputClass = 'min-w-0 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus-visible:ring-1 focus-visible:ring-emerald-400 disabled:opacity-60 [&[readonly]]:bg-zinc-900 [&[readonly]]:text-zinc-400'

export function FormField({ id, label, error, children, className = '' }: {
  id: string; label: string; error?: string; children: ReactNode; className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-2 block text-sm text-zinc-300">{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  )
}

export function FormSection({ title, description, disabled, children }: {
  title: string; description?: string; disabled?: boolean; children: ReactNode
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4 border-t border-zinc-800 pt-5 first:border-t-0 first:pt-0">
      <legend className="px-0 text-lg font-semibold">{title}</legend>
      {description ? <p className="text-sm text-zinc-400">{description}</p> : null}
      <div className="grid min-w-0 gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  )
}
