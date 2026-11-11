'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { fechaVisible, hastaLicencia, type LicenciaCarga, type LicenciaFormState, type LicenciaPersona, type LicenciaTipo } from '@/lib/licencias/domain'
import { calcularFechaEstudio, guardarLicencia } from './actions'
import { editarLicencia } from '../ultimas/actions'

const input = 'min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none'
const initialState: LicenciaFormState = { status: 'idle' }

export function LicenciaForm({ persona, tipos, hoy, puedeVerFicha, registro, onCancelar, onNuevaLicencia }: { persona: LicenciaPersona; tipos: LicenciaTipo[]; hoy: string; puedeVerFicha: boolean; registro?: LicenciaCarga; onCancelar?: () => void; onNuevaLicencia?: () => void }) {
  const [state, action, pending] = useActionState(registro ? editarLicencia : guardarLicencia, initialState)
  const [tipoId, setTipoId] = useState(registro ? String(registro.tipo_id) : '')
  const [desde, setDesde] = useState(registro?.desde ?? hoy)
  const [dias, setDias] = useState(String(registro?.dias ?? 1))
  const [adicionales, setAdicionales] = useState({ dni_familiar: registro?.dni_familiar?.toString() ?? '', numero_orden: registro?.numero_orden?.toString() ?? '', observacion: registro?.observacion ?? '', cantidad_ficha: registro?.cantidad_ficha ?? '' })
  const [calculo, setCalculo] = useState<{ key: string; hasta?: string; error?: string } | null>(null)
  const [intentoCalculo, setIntentoCalculo] = useState(0)
  const tipo = tipos.find((item) => String(item.id) === tipoId)
  const estudio = tipo?.codigo === '29'
  const key = `${tipoId}:${desde}:${dias}:${intentoCalculo}`
  useEffect(() => {
    if (!estudio || !desde || !/^\d+$/.test(dias) || Number(dias) < 1 || Number(dias) > 5) return
    let cancelled = false
    calcularFechaEstudio(desde, Number(dias)).then((result) => {
      if (!cancelled) setCalculo({ key, ...result })
    }).catch(() => { if (!cancelled) setCalculo({ key, error: 'No se pudo calcular la fecha. Volvé a intentarlo.' }) })
    return () => { cancelled = true }
  }, [estudio, desde, dias, key])
  const hasta = estudio ? (calculo?.key === key ? calculo.hasta : null) : hastaLicencia(desde, Number(dias))
  if (state.status === 'success') return (
    <div role="status" className="space-y-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-6">
      <p className="font-semibold text-emerald-200">{state.message}</p>
      <p className="text-sm text-zinc-300">{persona.apellido_nombre} · {tipo?.nombre} · {fechaVisible(desde)} al {fechaVisible(hasta)}</p>
      <div className="flex flex-wrap gap-4">
        {registro ? <Link href="/licencias/ultimas" className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black">Volver a últimas cargas</Link> : onNuevaLicencia ? <button type="button" onClick={onNuevaLicencia} className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black">Cargar otra licencia</button> : <Link href="/licencias/cargar" className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black">Cargar otra licencia</Link>}
        {!registro ? <Link href="/licencias/ultimas" className="inline-flex min-h-11 items-center text-sm text-emerald-200 underline underline-offset-4">Ver últimas cargas</Link> : null}
        {puedeVerFicha ? <Link href={`/licencias/fichas/${persona.dni}?anio=${desde.slice(0, 4)}`} className="inline-flex min-h-11 items-center text-sm text-emerald-200 underline underline-offset-4">Ver ficha del agente</Link> : null}
      </div>
    </div>
  )
  return (
    <form action={action} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <input type="hidden" name="dni" value={persona.dni} />
      {registro ? <><input type="hidden" name="id" value={registro.id} /><input type="hidden" name="version" value={registro.version} /></> : null}
      <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
        <legend className="mb-4 text-lg font-semibold">{registro ? 'Corregir datos de la licencia' : 'Datos de la licencia'}</legend>
        <div>
          <label htmlFor="tipo_id" className="mb-2 block text-sm">Tipo de licencia</label>
          <select id="tipo_id" name="tipo_id" required value={tipoId} onChange={(event) => setTipoId(event.target.value)} className={input}>
            <option value="">Seleccioná un tipo</option>
            {tipos.map((item) => <option key={item.id} value={item.id}>{item.codigo ? `${item.codigo} · ` : ''}{item.nombre}</option>)}
          </select>
          {tipo?.descripcion ? <p className="mt-2 text-xs text-zinc-400">{tipo.descripcion}</p> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label htmlFor="desde" className="mb-2 block text-sm">Desde</label><input id="desde" name="desde" type="date" min="2026-01-01" max="2200-12-31" required value={desde} onChange={(event) => setDesde(event.target.value)} className={input} /></div>
          <div><label htmlFor="dias" className="mb-2 block text-sm">{estudio ? 'Días hábiles (máx. 5)' : 'Cantidad de días'}</label><input id="dias" name="dias" type="number" min={1} max={estudio ? 5 : 36500} required value={dias} onChange={(event) => setDias(event.target.value)} className={input} /></div>
          <div><p id="hasta-label" className="mb-2 text-sm">Hasta</p><output aria-labelledby="hasta-label" aria-live="polite" className="flex min-h-11 items-center rounded-lg border border-zinc-800 px-3 text-sm text-zinc-300">{hasta ? fechaVisible(hasta) : estudio && Number(dias) >= 1 && Number(dias) <= 5 && !(calculo?.key === key && calculo.error) ? 'Calculando…' : '—'}</output></div>
        </div>
        <p className="text-sm text-zinc-400">{estudio ? 'Estudio: hasta 5 días hábiles por solicitud y 20 por año. Se excluyen sábados, domingos y los feriados de la agenda.' : 'La cantidad incluye el día de inicio y el de finalización.'}</p>
        {estudio && calculo?.key === key && calculo.error ? <div role="alert" className="text-sm text-red-300"><p>{calculo.error}</p><button type="button" onClick={() => setIntentoCalculo((value) => value + 1)} className="mt-2 min-h-11 underline underline-offset-4">Reintentar cálculo</button></div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="dni_familiar" className="mb-2 block text-sm">DNI del familiar (opcional)</label><input id="dni_familiar" name="dni_familiar" type="number" min={1} max={99999999} value={adicionales.dni_familiar} onChange={(event) => setAdicionales({ ...adicionales, dni_familiar: event.target.value })} className={input} /></div>
          <div><label htmlFor="numero_orden" className="mb-2 block text-sm">Número de orden (opcional)</label><input id="numero_orden" name="numero_orden" type="number" min={1} max={2147483647} value={adicionales.numero_orden} onChange={(event) => setAdicionales({ ...adicionales, numero_orden: event.target.value })} className={input} /></div>
        </div>
        <div><label htmlFor="observacion" className="mb-2 block text-sm">Observación (opcional)</label><textarea id="observacion" name="observacion" rows={3} maxLength={2000} value={adicionales.observacion} onChange={(event) => setAdicionales({ ...adicionales, observacion: event.target.value })} className={input} /></div>
        <div><label htmlFor="cantidad_ficha" className="mb-2 block text-sm">Cantidad en ficha (opcional)</label><input id="cantidad_ficha" name="cantidad_ficha" maxLength={12} placeholder="Ej.: 20/23" aria-describedby="cantidad-ayuda" value={adicionales.cantidad_ficha} onChange={(event) => setAdicionales({ ...adicionales, cantidad_ficha: event.target.value })} className={input} /><p id="cantidad-ayuda" className="mt-2 text-xs text-zinc-400">Anotación literal de la ficha. Los días del período se conservan aparte.</p></div>
        {state.status === 'error' ? <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{state.message}</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending || !tipoId || !hasta} className="min-h-11 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Guardando…' : registro ? 'Guardar cambios' : 'Guardar licencia'}</button>
          {onCancelar ? <button type="button" onClick={onCancelar} className="min-h-11 text-sm text-zinc-300 underline underline-offset-4">Cancelar</button> : <Link href={registro ? '/licencias/ultimas' : '/licencias/cargar'} className="inline-flex min-h-11 items-center text-sm text-zinc-300 underline underline-offset-4">Cancelar</Link>}
        </div>
      </fieldset>
    </form>
  )
}
