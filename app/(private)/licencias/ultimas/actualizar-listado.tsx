'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export function ActualizarListado() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="min-h-11 text-sky-300 underline underline-offset-4 disabled:opacity-50">{pending ? 'Actualizando…' : 'Actualizar listado'}</button>
}
