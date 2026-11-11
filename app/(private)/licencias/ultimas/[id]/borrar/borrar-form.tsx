'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { LicenciaCarga, LicenciaFormState } from '@/lib/licencias/domain'
import { borrarLicencia } from '../../actions'

export function BorrarLicenciaForm({ registro }: { registro: LicenciaCarga }) {
  const [state, action, pending] = useActionState(borrarLicencia, { status: 'idle' } as LicenciaFormState)
  if (state.status === 'success') return <div role="status" className="space-y-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-6"><p className="font-semibold text-emerald-200">{state.message}</p><Link href="/licencias/ultimas" className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black">Volver a últimas cargas</Link></div>
  if (registro.anulado_at) return <div className="space-y-4 rounded-xl border border-zinc-800 p-5"><p>Esta licencia ya fue borrada.</p><Link href="/licencias/ultimas" className="inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">Volver a últimas cargas</Link></div>
  return <form action={action} className="rounded-xl border border-red-400/30 bg-zinc-900 p-5 sm:p-6">
    <input type="hidden" name="id" value={registro.id} /><input type="hidden" name="version" value={registro.version} />
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60"><legend className="mb-4 text-lg font-semibold text-red-200">Confirmar borrado</legend>
      <p className="text-sm leading-6 text-zinc-300">La licencia dejará de aparecer como vigente y sus días no se contarán en la ficha. Se conservarán el registro original, el motivo y el usuario y horario del borrado.</p>
      <div><label htmlFor="motivo" className="mb-2 block text-sm">Motivo del borrado</label><textarea id="motivo" name="motivo" required minLength={3} maxLength={500} rows={3} placeholder="Ej.: se cargó al agente equivocado." className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-red-300 focus:outline-none" /></div>
      <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" name="confirmar" value="si" required className="mt-1 size-4 accent-red-400" /><span>Confirmo borrar únicamente la licencia #{registro.id} de {registro.apellido_nombre}.</span></label>
      {state.status === 'error' ? <p role="alert" className="rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{state.message}</p> : null}
      <div className="flex flex-wrap gap-4"><button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-red-300 px-5 text-sm font-semibold text-black hover:bg-red-200 disabled:opacity-50">{pending ? 'Borrando…' : 'Confirmar borrado'}</button><Link href="/licencias/ultimas" className="inline-flex min-h-11 items-center text-sm text-zinc-300 underline underline-offset-4">Cancelar</Link></div>
    </fieldset>
  </form>
}
