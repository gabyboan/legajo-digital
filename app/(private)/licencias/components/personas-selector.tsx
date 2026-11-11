'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { LicenciaPersona } from '@/lib/licencias/domain'

type SearchResult = { key: string; personas: LicenciaPersona[]; error?: string; href?: string }

export function PersonasSelector({ personas, q, ficha = false, puedeVerFicha = ficha, selectedDni, onSelect, inputRef }: {
  personas: LicenciaPersona[]
  q: string
  ficha?: boolean
  puedeVerFicha?: boolean
  selectedDni?: number
  onSelect?: (persona: LicenciaPersona, query: string) => void
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  const router = useRouter()
  const localInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = inputRef ?? localInputRef
  const resultsRef = useRef<HTMLTableSectionElement>(null)
  const base = ficha ? '/licencias/fichas' : '/licencias/cargar'
  const [query, setQuery] = useState(q)
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState(!selectedDni)
  const [response, setResponse] = useState<SearchResult | null>(null)
  const normalized = query.trim()
  const key = `${ficha ? 'fichas' : 'cargar'}:${attempt}:${normalized}`
  const [initial] = useState<SearchResult>(() => ({ key, personas }))
  const result = key === initial.key ? initial : response?.key === key ? response : null
  const busy = !result

  useEffect(() => {
    if (key === initial.key) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: normalized, contexto: ficha ? 'fichas' : 'cargar' })
        const request = await fetch(`/api/licencias/personas?${params}`, { signal: controller.signal, cache: 'no-store' })
        if (request.redirected) {
          const target = new URL(request.url)
          if (target.origin === window.location.origin && ['/login', '/auth/mfa'].includes(target.pathname)) {
            window.location.replace(target.href)
            return
          }
        }
        const data = await request.json()
        if (controller.signal.aborted) return
        if ((request.status === 401 || request.status === 403) && typeof data.href === 'string'
          && (data.href.startsWith('/auth/expired?') || data.href.startsWith('/auth/mfa?') || data.href.startsWith('/login?'))) {
          window.location.replace(data.href)
          return
        }
        if (!request.ok || !Array.isArray(data.personas)) {
          setResponse({ key, personas: [], error: typeof data.error === 'string' ? data.error : 'No se pudieron buscar los agentes.', href: data.href })
        } else {
          setResponse({ key, personas: data.personas })
        }
      } catch {
        if (!controller.signal.aborted) setResponse({ key, personas: [], error: 'No se pudo conectar con la búsqueda. Volvé a intentarlo.' })
      }
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, normalized, ficha, initial.key])

  const error = result?.error
  const authHref = result?.href
  const rows = result?.personas ?? []

  function ingresarAgente(persona: LicenciaPersona) {
    if (ficha) {
      if (puedeVerFicha) router.push(`/licencias/fichas/${persona.dni}`)
    } else if (onSelect) {
      onSelect(persona, query)
      setExpanded(false)
    } else {
      router.push(`${base}?${new URLSearchParams({ q: query, dni: String(persona.dni) })}`)
    }
  }

  return (
    <div className="space-y-4">
      <form role="search" action={base} onSubmit={(event) => { event.preventDefault(); setExpanded(true); setAttempt((value) => value + 1) }} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
          <label htmlFor="buscar-agente" className="mb-2 block text-sm text-zinc-300">Buscar agente</label>
          <input ref={searchInputRef} id="buscar-agente" name="q" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setExpanded(true) }} onFocus={() => setExpanded(true)} onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && rows.length && expanded) {
              event.preventDefault()
              resultsRef.current?.querySelector<HTMLTableRowElement>('tr')?.focus()
            }
          }} maxLength={150} autoComplete="off" placeholder="Apellido, nombre, DNI o legajo" aria-describedby="buscar-agente-ayuda" aria-controls="resultados-agentes" className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none" />
          </div>
          <button type="submit" className="min-h-11 rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-400">Buscar</button>
          {query ? <button type="button" onClick={() => { setQuery(''); setExpanded(true); searchInputRef.current?.focus() }} className="min-h-11 px-3 text-sm text-zinc-300 underline underline-offset-4">Limpiar</button> : null}
        </div>
        <p id="buscar-agente-ayuda" className="mt-3 text-xs text-zinc-400">Los resultados se actualizan mientras escribís, sin recargar la página. Hacé clic en la fila de un agente o elegilo con ↓ y Enter.</p>
      </form>
      <div id="resultados-agentes" hidden={!expanded} className="space-y-3">
      {error ? <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><div className="mt-2 flex flex-wrap gap-4"><button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 underline underline-offset-4">Reintentar búsqueda</button>{authHref ? <Link href={authHref} className="inline-flex min-h-11 items-center underline underline-offset-4">Verificar mi sesión</Link> : null}</div></div> : null}
      <p aria-live="polite" className="text-sm text-zinc-400">{busy ? 'Buscando agentes…' : error ? 'Búsqueda no disponible.' : `${rows.length} ${rows.length === 1 ? 'agente encontrado' : 'agentes encontrados'}.${rows.length >= 100 ? ' Se muestran los primeros 100; ajustá la búsqueda.' : ''}`}</p>
      <div role="region" aria-label="Agentes para licencias" aria-busy={busy} tabIndex={0} className="overflow-x-auto rounded-xl border border-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-400">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400"><tr>{['Agente', 'DNI', 'Legajo', 'Estado', 'Acción'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody ref={resultsRef} className="divide-y divide-zinc-800">
            {rows.map((persona) => (
              <tr key={persona.dni} tabIndex={0} aria-keyshortcuts="Enter Space" onClick={(event) => {
                if (event.target instanceof Element && event.target.closest('a, button')) return
                ingresarAgente(persona)
              }} onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  ingresarAgente(persona)
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  const sibling = event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling
                  if (sibling instanceof HTMLTableRowElement) sibling.focus()
                  else if (event.key === 'ArrowUp') searchInputRef.current?.focus()
                }
              }} className="cursor-pointer transition-colors hover:bg-sky-400/10 focus:bg-sky-400/10 focus:outline-2 focus:-outline-offset-2 focus:outline-sky-400 focus-within:bg-sky-400/10">
                <td className="px-4 py-3"><p className="font-medium">{persona.apellido_nombre}</p><p className="mt-1 text-xs text-zinc-400">{persona.carrera || 'Sin carrera'}</p></td>
                <td className="px-4 py-3">{persona.dni}</td><td className="px-4 py-3">{persona.legajo ?? '—'}</td>
                <td className="px-4 py-3"><span className={persona.activo ? 'text-emerald-300' : 'text-amber-200'}>{persona.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td className="px-4 py-3"><div className="flex items-center gap-4">
                  {!ficha ? onSelect ? <button type="button" onClick={() => ingresarAgente(persona)} aria-label={`Seleccionar a ${persona.apellido_nombre}`} className="min-h-11 text-sky-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-400">{persona.dni === selectedDni ? 'Seleccionado' : 'Seleccionar'}</button> : <Link href={`${base}?${new URLSearchParams({ q: query, dni: String(persona.dni) })}`} className="inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">Seleccionar</Link> : null}
                  {puedeVerFicha ? <Link href={`/licencias/fichas/${persona.dni}`} aria-label={`Ver ficha de ${persona.apellido_nombre}`} className="inline-flex min-h-11 items-center whitespace-nowrap text-sky-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-400">Ver ficha</Link> : null}
                </div></td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">{busy ? 'Actualizando resultados…' : error ? 'Reintentá la búsqueda para ver los agentes.' : 'No se encontraron agentes. Probá con otro nombre o DNI.'}</td></tr> : null}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}
