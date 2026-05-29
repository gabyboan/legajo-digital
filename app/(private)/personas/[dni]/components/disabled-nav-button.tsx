import type { ReactNode } from 'react'

export function DisabledNavButton({
  children,
  title = 'No tenes permisos para editar',
}: {
  children: ReactNode
  title?: string
}) {
  return (
    <span
      title={title}
      aria-disabled="true"
      className="cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-600"
    >
      {children}
    </span>
  )
}
