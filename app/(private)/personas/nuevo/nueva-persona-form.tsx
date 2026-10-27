'use client'

import Link from 'next/link'
import { useState } from 'react'
import { guardarIdentidadPersona } from '../actions'

type Resultado = { nombre: string; numero: string }
type Intento = { fuente: string; estado: string; detalle: string | null; resultados: Resultado[] }
type Consulta = { dni: string; comprobadoEn: string; requiereRevision: boolean; intentos: Intento[] }

const nombresFuentes: Record<string, string> = {
  cuitonline: 'CuitOnline',
  nosis: 'Nosis',
  dateas: 'Dateas',
}

const nombresEstados: Record<string, string> = {
  con_datos: 'Con datos',
  sin_resultados: 'Sin coincidencias',
  bloqueado: 'Acceso restringido',
  error: 'No disponible',
}

function texto(payload: unknown, campo: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''
  const value = (payload as Record<string, unknown>)[campo]
  return typeof value === 'string' ? value : ''
}

function dividirNombre(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/)
  return { apellido: partes.shift() ?? '', nombre: partes.join(' ') }
}

function formatoCuit(value: string) {
  const digits = value.replace(/\D/g, '')
  return /^\d{11}$/.test(digits)
    ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
    : value
}

function fechaHora(value: string) {
  const fecha = new Date(value)
  return Number.isNaN(fecha.getTime())
    ? '-'
    : new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(fecha)
}

export function NuevaPersonaForm() {
  const [dni, setDni] = useState('')
  const [consulta, setConsulta] = useState<Consulta | null>(null)
  const [seleccion, setSeleccion] = useState<Resultado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState(false)

  async function consultar() {
    const limpio = dni.replace(/\D/g, '')
    if (!/^\d{7,8}$/.test(limpio) || cargando) return
    setDni(limpio)
    setConsulta(null)
    setSeleccion(null)
    setError('')
    setCargando(true)
    try {
      const response = await fetch('/api/personas/consulta-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: limpio }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(texto(payload, 'error') || 'No se pudo consultar el DNI.')
      if (!payload || typeof payload !== 'object' || !Array.isArray((payload as Consulta).intentos)) {
        throw new Error('La respuesta de las fuentes no es válida.')
      }
      const resultado = payload as Consulta
      setConsulta(resultado)
      setSeleccion(resultado.intentos.flatMap((intento) => intento.resultados)[0] ?? null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo consultar el DNI.')
    } finally {
      setCargando(false)
    }
  }

  const candidatos = consulta
    ? consulta.intentos.flatMap((intento) => intento.resultados).filter((resultado, index, todos) =>
        todos.findIndex((otro) => otro.numero === resultado.numero) === index)
    : []
  const nombre = seleccion ? dividirNombre(seleccion.nombre) : { apellido: '', nombre: '' }

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-lg font-semibold">Identificación</h2>
        <p className="mt-1 text-sm text-zinc-400">El servidor consulta CuitOnline, Nosis y Dateas. Revisá la coincidencia antes de guardarla.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={dni} onChange={(event) => setDni(event.currentTarget.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" placeholder="DNI" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm" />
        <button type="button" onClick={consultar} disabled={!/^\d{7,8}$/.test(dni) || cargando} className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">{cargando ? 'Consultando…' : 'Consultar DNI'}</button>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-zinc-400">Si la consulta no inicia o no encontrás datos, también podés cargar la persona manualmente.</p>
        <button
          type="button"
          aria-expanded={manual}
          onClick={() => setManual((actual) => !actual)}
          className="rounded-lg border border-amber-500/50 px-3 py-2 text-sm text-amber-200"
        >
          {manual ? 'Ocultar carga manual' : 'Cargar datos manualmente'}
        </button>
      </div>
      {error ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}
      {consulta ? (
        <div className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <p className="text-sm text-zinc-400">Comprobado el {fechaHora(consulta.comprobadoEn)}</p>
          {consulta.requiereRevision ? <p className="text-sm text-amber-200">Hay más de un CUIT/CUIL para este DNI. Elegí cuál guardar.</p> : null}
          {candidatos.length === 0 ? <p className="text-sm text-amber-200">Las fuentes no devolvieron una coincidencia utilizable.</p> : null}
          <div className="space-y-2">
            {candidatos.map((candidato) => <button type="button" key={candidato.numero} onClick={() => setSeleccion(candidato)} className={`block w-full rounded-lg border p-3 text-left text-sm ${seleccion?.numero === candidato.numero ? 'border-emerald-400 bg-emerald-400/10' : 'border-zinc-700 hover:bg-zinc-900'}`}><span className="block font-medium">{candidato.nombre}</span><span className="text-zinc-400">CUIT/CUIL {formatoCuit(candidato.numero)}</span></button>)}
          </div>
          {seleccion ? <form key={seleccion.numero} action={guardarIdentidadPersona} className="grid gap-4 border-t border-zinc-800 pt-4 md:grid-cols-2">
            <input type="hidden" name="dni" value={dni} />
            <input type="hidden" name="modo" value="fuentes" />
            <input type="hidden" name="cuit" value={seleccion.numero} />
            <label className="text-sm text-zinc-300">Apellido<input name="apellido" defaultValue={nombre.apellido} required className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3" /></label>
            <label className="text-sm text-zinc-300">Nombre<input name="nombre" defaultValue={nombre.nombre} required className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3" /></label>
            <label className="text-sm text-zinc-300">Fecha de nacimiento (opcional)<input name="fecha_nacimiento" type="date" max={new Date().toISOString().slice(0, 10)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3" /></label>
            <p className="self-end text-sm text-zinc-400">DNI {dni} · CUIT/CUIL {formatoCuit(seleccion.numero)}</p>
            <button type="submit" className="rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-black md:col-span-2">Guardar identidad y completar legajo</button>
          </form> : null}
          <div className="space-y-2 border-t border-zinc-800 pt-3 text-xs text-zinc-400">{consulta.intentos.map((intento) => <div key={intento.fuente} className="flex items-center justify-between gap-3"><span>{nombresFuentes[intento.fuente] ?? intento.fuente}</span><span>{nombresEstados[intento.estado] ?? intento.estado}{intento.detalle ? `: ${intento.detalle}` : ''}</span></div>)}</div>
        </div>
      ) : null}
      {manual ? <form action={guardarIdentidadPersona} className="grid gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 md:grid-cols-2">
        <input type="hidden" name="modo" value="manual" />
        <label className="text-sm text-zinc-300">DNI<input name="dni" value={dni} onChange={(event) => setDni(event.currentTarget.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" required className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3" /></label>
        <label className="text-sm text-zinc-300">CUIT/CUIL (opcional)<input name="cuit" inputMode="numeric" pattern="\d{11}" placeholder="20123456789" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3" /></label>
        <label className="text-sm text-zinc-300">Apellido<input name="apellido" required className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3" /></label>
        <label className="text-sm text-zinc-300">Nombre<input name="nombre" required className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3" /></label>
        <label className="text-sm text-zinc-300">Fecha de nacimiento (opcional)<input name="fecha_nacimiento" type="date" max={new Date().toISOString().slice(0, 10)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3" /></label>
        <p className="self-end text-xs text-amber-200">Solo DNI, apellido y nombre son obligatorios. La carga manual queda identificada como no comprobada por fuentes externas.</p>
        <button type="submit" className="rounded-lg bg-amber-300 px-4 py-3 text-sm font-semibold text-black md:col-span-2">Guardar identidad manual y completar legajo</button>
      </form> : null}
      <Link href="/personas" className="inline-flex rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800">Cancelar</Link>
    </div>
  )
}