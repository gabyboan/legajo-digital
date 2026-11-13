'use client'

import { useActionState, useState } from 'react'
import type { Novedad } from '@/lib/novedades/domain'
import { guardarControl } from './actions'

export function ControlForm({ novedad: n, operacion }: { novedad: Novedad; operacion: string }) {
  const [state, action, pending] = useActionState(guardarControl, { status: 'idle' })
  const [estado, setEstado] = useState('confirmada')
  const blocked = pending || state.status === 'success'
  const licenses = n.coincidencias?.filter((c) => c.origen === 'licencia') ?? []
  return <form action={action} className="space-y-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5">
    <h2 className="text-lg font-semibold">Registrar control</h2>
    {Object.entries({ origen: n.origen, id: n.id, version: n.version, control_id: n.control_id, calendario_version: n.calendario_version, operacion }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <label className="block space-y-2"><span>Resultado</span><select name="estado" value={estado} onChange={(e) => setEstado(e.target.value)} disabled={blocked} className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2">
      <option value="confirmada" disabled={!n.puede_confirmar}>Confirmada</option><option value="observada">Observada</option>
    </select></label>
    {n.origen === 'medico' ? <label className="block space-y-2"><span>Licencia existente que corresponde al parte</span><select name="licencia" defaultValue="" disabled={blocked} className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2">
      <option value="">Sin vincular licencia — no se creará una automáticamente</option>
      {licenses.map((c) => <option key={c.id} value={`${c.id}:${c.version}`}>Licencia #{c.id} · {c.tipo} · {c.desde} a {c.hasta}</option>)}
    </select><span className="block text-xs text-zinc-400">La coincidencia de fechas no prueba que correspondan. Contrastá el documento y el tipo de licencia.</span></label> : null}
    <label className="block space-y-2"><span>Observación {estado === 'observada' ? '(obligatoria)' : '(opcional)'}</span><textarea name="observacion" maxLength={500} minLength={estado === 'observada' ? 3 : undefined} required={estado === 'observada'} disabled={blocked} rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3" /><span className="block text-xs text-zinc-400">Solo observaciones administrativas, sin diagnósticos.</span></label>
    <label className="flex gap-3"><input type="checkbox" name="corroborado" value="si" required disabled={blocked} className="mt-1 size-4" /><span>{n.origen === 'franco' ? 'Corroboré si la persona tomó este franco y contrasté la carga.' : 'Contrasté la novedad y su documentación disponible.'}</span></label>
    <label className="flex gap-3"><input type="checkbox" name="advertencias" value="si" required disabled={blocked} className="mt-1 size-4" /><span>Revisé las coincidencias y los avisos del calendario que se muestran en esta página.</span></label>
    {state.message ? <p role={state.status === 'error' ? 'alert' : 'status'} className={state.status === 'error' ? 'text-amber-200' : 'text-emerald-200'}>{state.message}</p> : null}
    <button type="submit" disabled={blocked || (estado === 'confirmada' && !n.puede_confirmar)} className="min-h-11 rounded-lg bg-sky-200 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar control'}</button>
  </form>
}
