'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { filtrarIndicePersonas, indexarPersonas, type PersonaListado } from '@/lib/personas/listado'
import { BusquedaAgentes } from '../components/busqueda-agentes'

export function PersonasPanel({ personas, carreras, q, carrera, estado }: {
  personas: PersonaListado[]; carreras: { id: number; nombre: string }[]; q: string; carrera: string; estado: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState(q)
  const [carreraId, setCarreraId] = useState(carrera)
  const [estadoActual, setEstadoActual] = useState(estado)
  const [limit, setLimit] = useState(100)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLTableSectionElement>(null)
  const indice = useMemo(() => indexarPersonas(personas), [personas])
  const filtradas = useMemo(() => filtrarIndicePersonas(indice, query, carreraId, estadoActual), [indice, query, carreraId, estadoActual])
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  if (carreraId) params.set('carrera', carreraId)
  if (estadoActual !== 'todos') params.set('estado', estadoActual)
  const search = params.toString()
  useEffect(() => { window.history.replaceState(null, '', `/personas${search ? `?${search}` : ''}`) }, [search])
  return <div className="space-y-4">
    <BusquedaAgentes query={query} onChange={(value) => { setQuery(value); setLimit(100) }} onSubmit={() => inputRef.current?.focus()} inputRef={inputRef} onArrowDown={() => resultsRef.current?.querySelector('tr')?.focus()}>
      <div><label htmlFor="carrera" className="mb-2 block text-sm text-zinc-300">Carrera</label><select id="carrera" name="carrera" value={carreraId} onChange={(event) => { setCarreraId(event.target.value); setLimit(100) }} className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm sm:max-w-60"><option value="">Todas las carreras</option>{carreras.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></div>
      <div><label htmlFor="estado" className="mb-2 block text-sm text-zinc-300">Estado</label><select id="estado" name="estado" value={estadoActual} onChange={(event) => { setEstadoActual(event.target.value); setLimit(100) }} className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"><option value="todos">Todos los estados</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select></div>
    </BusquedaAgentes>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400"><p aria-live="polite">{filtradas.length} personas encontradas{filtradas.length > limit ? ` · Mostrando ${limit}` : ''}</p><a href={`/api/personas/exportar?${search}`} className="inline-flex min-h-11 items-center rounded-lg border border-emerald-700/70 px-4 text-emerald-300">Exportar XLSX</a></div>
    <div role="region" aria-label="Listado de personas" tabIndex={0} className="overflow-x-auto rounded-xl border border-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-400">
      <table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-zinc-900 text-zinc-400"><tr>{['Agente', 'DNI', 'Legajo', 'Estado', 'Acción'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody ref={resultsRef} className="divide-y divide-zinc-800">{filtradas.slice(0, limit).map((persona) => <tr key={persona.dni} tabIndex={0} aria-keyshortcuts="Enter Space" onClick={(event) => { if (!(event.target instanceof Element && event.target.closest('a, button'))) router.push(`/personas/${persona.dni}`) }} onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); router.push(`/personas/${persona.dni}`) }
          else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const sibling = event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling
            if (sibling instanceof HTMLTableRowElement) sibling.focus()
            else if (event.key === 'ArrowUp') inputRef.current?.focus()
          }
        }} className="cursor-pointer transition-colors hover:bg-sky-400/10 focus:bg-sky-400/10 focus:outline-2 focus:-outline-offset-2 focus:outline-sky-400">
          <td className="px-4 py-3"><p className="font-medium">{persona.apellido} {persona.nombre}</p><p className="mt-1 text-xs text-zinc-400">{persona.carreras.map((item) => item.nombre).join(', ') || 'Sin carrera'}</p></td><td className="px-4 py-3">{persona.dni}</td><td className="px-4 py-3">{persona.legajo ?? '—'}</td><td className={`px-4 py-3 ${persona.activo ? 'text-emerald-300' : 'text-amber-200'}`}>{persona.activo ? 'Activo' : 'Inactivo'}</td><td className="px-4 py-3"><Link href={`/personas/${persona.dni}`} aria-label={`Ver ficha de ${persona.apellido} ${persona.nombre}`} className="inline-flex min-h-11 items-center whitespace-nowrap text-sky-300 underline underline-offset-4">Ver ficha</Link></td>
        </tr>)}{!filtradas.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">No se encontraron personas. Probá con otro nombre, DNI o legajo.</td></tr> : null}</tbody>
      </table>
    </div>
    {filtradas.length > limit ? <button type="button" onClick={() => setLimit((value) => value + 100)} className="min-h-11 rounded-lg border border-zinc-600 px-4 text-sm">Mostrar más personas</button> : null}
  </div>
}
