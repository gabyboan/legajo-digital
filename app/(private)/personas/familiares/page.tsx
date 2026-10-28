import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from '../permissions'
import {
  FamiliaresEditForm,
  type Familiar,
} from '../[dni]/editar/components/familiares-edit-form'
import { limpiarBusqueda, ordenarPersonasPorCoincidencia } from '@/lib/buscar-personas'

type FamiliaresPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type PersonaRow = {
  dni: number
  apellido: string
  nombre: string
}

const PAGE_SIZE = 100

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function positiveInt(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function pageHref(q: string, page: number, dni?: number) {
  const params = new URLSearchParams({ page: String(page) })

  if (q) {
    params.set('q', q)
  }

  if (dni) {
    params.set('dni', String(dni))
  }

  return `/personas/familiares?${params.toString()}`
}

export default async function FamiliaresPage({
  searchParams,
}: FamiliaresPageProps) {
  const supabase = await createClient()
  const params = (await searchParams) ?? {}
  const q = (firstParam(params.q) ?? '').trim()
  const page = positiveInt(firstParam(params.page))
  const selectedDni = Number(firstParam(params.dni))
  const selectedDniIsValid =
    Number.isInteger(selectedDni) && selectedDni > 0
  const pageError = firstParam(params.error)
  const dniSearch = /^\d+$/.test(q) ? Number(q) : null
  const searchTerms = limpiarBusqueda(q)

  let personasQuery = supabase
    .from('personas')
    .select('dni, apellido, nombre')
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true })
    .limit(2000)

  if (dniSearch !== null) {
    personasQuery = personasQuery.eq('dni', dniSearch)
  }

  const [canEdit, personasRes, selectedPersonaRes, familiaresRes] =
    await Promise.all([
      canCurrentUserEditLegajo(supabase),
      personasQuery,
      selectedDniIsValid
        ? supabase
            .from('personas')
            .select('dni, apellido, nombre')
            .eq('dni', selectedDni)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      selectedDniIsValid
        ? supabase
            .from('persona_familiares')
            .select('id, apellido, nombre, fecha_nacimiento, dni, parentesco, fallecido')
            .eq('persona_dni', selectedDni)
            .order('apellido')
            .order('nombre')
        : Promise.resolve({ data: [], error: null }),
    ])

  if (personasRes.error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        Error al cargar personas: {personasRes.error.message}
      </div>
    )
  }

  const personas = (personasRes.data ?? []) as PersonaRow[]
  const personasOrdenadas = (searchTerms.length
    ? ordenarPersonasPorCoincidencia(personas, searchTerms)
    : personas
  ).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedPersona = selectedPersonaRes.data as PersonaRow | null
  const returnTo = pageHref(q, page, selectedDniIsValid ? selectedDni : undefined)

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Datos de Familiares</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Carga y actualizacion de familiares por persona.
          </p>
        </div>

        <Link
          href="/personas"
          className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
        >
          Volver a personas
        </Link>
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

      {pageError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {pageError}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No tenes permisos para cargar datos de familiares.
        </div>
      ) : null}

      {selectedPersonaRes.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error al cargar la persona: {selectedPersonaRes.error.message}
        </div>
      ) : null}

      {familiaresRes.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error al cargar familiares: {familiaresRes.error.message}
        </div>
      ) : null}

      {selectedPersona && !familiaresRes.error ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedPersona.apellido}, {selectedPersona.nombre}
              </h2>
              <p className="text-sm text-zinc-400">DNI {selectedPersona.dni}</p>
            </div>
            <Link
              href={pageHref(q, page)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
            >
              Cambiar persona
            </Link>
          </div>

          {canEdit ? (
            <FamiliaresEditForm
              personaDni={selectedPersona.dni}
              familiares={(familiaresRes.data ?? []) as Familiar[]}
              returnTo={returnTo}
            />
          ) : null}
        </div>
      ) : null}

      {!selectedPersona ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
            <table className="min-w-[620px] divide-y divide-zinc-800 text-sm">
              <thead className="bg-zinc-950/60 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">DNI</th>
                  <th className="px-4 py-3 text-left font-medium">Apellido</th>
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-right font-medium">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {personasOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                      No se encontraron personas.
                    </td>
                  </tr>
                ) : (
                  personasOrdenadas.map((persona) => (
                    <tr key={persona.dni} className="hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-medium">{persona.dni}</td>
                      <td className="px-4 py-3">{persona.apellido}</td>
                      <td className="px-4 py-3">{persona.nombre}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={pageHref(q, page, persona.dni)}
                          className="inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800"
                        >
                          Cargar familiares
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Paginacion">
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
            <span className="text-zinc-400">Pagina {page}</span>
            {personasOrdenadas.length === PAGE_SIZE ? (
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
        </>
      ) : null}
    </section>
  )
}
