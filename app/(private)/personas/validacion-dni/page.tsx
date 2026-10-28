import Link from 'next/link'

import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from '../permissions'
import { ValidacionDniListado } from './validacion-dni-listado'

type ValidacionDniPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type PersonaRow = {
  dni: number
  apellido: string
  nombre: string
  cuil: number | null
}

type ValidacionRow = {
  persona_dni: number
  validado_at: string
}

const PAGE_SIZE = 100

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function positiveInt(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function searchTerm(value: string) {
  return value.replace(/[,%()]/g, '').trim()
}

function pageHref(q: string, page: number) {
  const params = new URLSearchParams({ page: String(page) })

  if (q) {
    params.set('q', q)
  }

  return `/personas/validacion-dni?${params.toString()}`
}

function Encabezado() {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Validación de DNI</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Compará manualmente el nombre del legajo con el nombre obtenido por el scraper.
        </p>
      </div>

      <Link
        href="/personas"
        className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
      >
        Volver a personas
      </Link>
    </div>
  )
}

export default async function ValidacionDniPage({
  searchParams,
}: ValidacionDniPageProps) {
  const supabase = await createClient()
  const canValidate = await canCurrentUserEditLegajo(supabase)

  if (!canValidate) {
    return (
      <section className="space-y-6">
        <Encabezado />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No tenés permisos para comprobar o validar DNIs.
        </div>
      </section>
    )
  }

  const params = (await searchParams) ?? {}
  const q = (firstParam(params.q) ?? '').trim()
  const page = positiveInt(firstParam(params.page))
  const dniSearch = /^\d+$/.test(q) ? Number(q) : null
  const cleanedSearch = searchTerm(q)

  let personasQuery = supabase
    .from('personas')
    .select('dni, apellido, nombre, cuil')
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true })
    .order('dni', { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (dniSearch !== null) {
    personasQuery = personasQuery.eq('dni', dniSearch)
  } else if (cleanedSearch) {
    personasQuery = personasQuery.or(
      `apellido.ilike.%${cleanedSearch}%,nombre.ilike.%${cleanedSearch}%`
    )
  }

  const personasRes = await personasQuery

  if (personasRes.error) {
    return (
      <section className="space-y-6">
        <Encabezado />
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          Error al cargar personas: {personasRes.error.message}
        </div>
      </section>
    )
  }

  const personas = (personasRes.data ?? []) as PersonaRow[]
  const dnis = personas.map((persona) => persona.dni)
  const validacionesRes =
    dnis.length > 0
      ? await supabase
          .from('persona_dni_validaciones')
          .select('persona_dni, validado_at')
          .in('persona_dni', dnis)
      : { data: [], error: null }
  const validaciones = (validacionesRes.data ?? []) as ValidacionRow[]

  return (
    <section className="space-y-6">
      <Encabezado />

      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
        <p>
          <strong>Comprobar</strong> ejecuta el scraper local solo para esta pantalla. Después de
          revisar el resultado, <strong>✓ Validar</strong> guarda la confirmación para no volver a
          consultar ese DNI.
        </p>
      </div>

      <form className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por apellido, nombre o DNI"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
          >
            Buscar
          </button>
        </div>
      </form>

      {validacionesRes.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error al cargar validaciones: {validacionesRes.error.message}
        </div>
      ) : null}

      <ValidacionDniListado
        key={`${q}:${page}`}
        personas={personas}
        validaciones={validaciones}
        canValidate={canValidate}
      />

      <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Paginación">
        {page > 1 ? (
          <Link
            href={pageHref(q, page - 1)}
            className="rounded-lg border border-zinc-700 px-4 py-2 transition hover:bg-zinc-800"
          >
            Anterior
          </Link>
        ) : (
          <span />
        )}
        <span className="text-zinc-400">Página {page}</span>
        {personas.length === PAGE_SIZE ? (
          <Link
            href={pageHref(q, page + 1)}
            className="rounded-lg border border-zinc-700 px-4 py-2 transition hover:bg-zinc-800"
          >
            Siguiente
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  )
}
