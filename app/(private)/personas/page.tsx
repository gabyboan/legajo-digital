import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from './permissions'
import { limpiarBusqueda, ordenarPersonasPorCoincidencia } from '@/lib/buscar-personas'
import { carreraVisible } from '@/lib/carreras'
import { enlaceMfa } from '@/lib/auth/mfa'

type PersonasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type PersonaRow = {
  dni: number
  apellido: string
  nombre: string
  persona_carreras?: {
    carrera_id: number
    carreras?: { nombre: string } | Array<{ nombre: string }> | null
  } | Array<{
    carrera_id: number
    carreras?: { nombre: string } | Array<{ nombre: string }> | null
  }> | null
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseEstado(value: string | undefined) {
  return value === 'activos' || value === 'inactivos' ? value : 'todos'
}

function carreraNombre(persona: PersonaRow) {
  const personaCarrera = Array.isArray(persona.persona_carreras)
    ? persona.persona_carreras[0]
    : persona.persona_carreras
  const relation = personaCarrera?.carreras
  const carrera = Array.isArray(relation) ? relation[0] : relation

  return carrera?.nombre?.trim() || 'Sin carrera'
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
  const supabase = await createClient()
  const params = (await searchParams) ?? {}

  const rawQ = params.q
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? '').trim()
  const carreraId = firstParam(params.carrera) ?? ''
  const estado = parseEstado(firstParam(params.estado))
  const rawError = params.error
  const pageError = Array.isArray(rawError) ? rawError[0] : rawError

  let query = supabase
    .from('personas')
    .select(
      'dni, apellido, nombre, persona_carreras(carrera_id, carreras(nombre))'
    )
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true })
    .limit(2000)

  if (q) {
    if (/^\d+$/.test(q)) {
      query = query.eq('dni', Number(q))
    }
  }

  const [{ data: personasData, error }, { data: inactivos }, { data: carreras }, canEdit] =
    await Promise.all([
      query,
      supabase.from('persona_inactivo').select('dni'),
      supabase.from('carreras').select('id, nombre').order('nombre'),
      canCurrentUserEditLegajo(supabase),
    ])

  if (error) {
    const requiresMfa = /autenticadora|\baal2\b|\bmfa\b/i.test(error.message)
    return (
      <div role="alert" className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        <p>{requiresMfa ? 'Verificá el código de tu aplicación autenticadora para continuar.' : 'No se pudieron cargar las personas. Volvé a intentarlo; si persiste, contactá al administrador.'}</p>
        <Link href={requiresMfa ? enlaceMfa('/personas') : '/personas'} className="inline-flex min-h-11 items-center rounded-lg border border-red-400/50 px-4 py-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300">
          {requiresMfa ? 'Verificar mi código' : 'Volver a intentar'}
        </Link>
      </div>
    )
  }

  const inactivosSet = new Set((inactivos ?? []).map((x) => String(x.dni)))
  const personas = (personasData ?? []) as unknown as PersonaRow[]
  const personasFiltradas = personas.filter((persona) => {
    const personaCarrera = Array.isArray(persona.persona_carreras)
      ? persona.persona_carreras[0]
      : persona.persona_carreras
    const tieneCarrera = carreraId
      ? String(personaCarrera?.carrera_id) === carreraId
      : true
    const esActivo = !inactivosSet.has(String(persona.dni))
    const coincideEstado =
      estado === 'todos' || (estado === 'activos' ? esActivo : !esActivo)

    return tieneCarrera && coincideEstado
  })
  const personasOrdenadas = q
    ? ordenarPersonasPorCoincidencia(personasFiltradas, limpiarBusqueda(q)).slice(0, 200)
    : personasFiltradas

  const carrerasVisibles = (carreras ?? []).filter((carrera) =>
    carreraVisible(carrera.nombre)
  )
  const exportParams = new URLSearchParams()
  if (q) exportParams.set('q', q)
  if (carreraId) exportParams.set('carrera', carreraId)
  if (estado !== 'todos') exportParams.set('estado', estado)
  const exportHref = `/api/personas/exportar?${exportParams.toString()}`

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Base del legajo digital. Buscá y abrí la ficha de cada agente.
          </p>
        </div>

        {canEdit ? (
          <Link
            href="/personas/nuevo"
            className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Nueva persona
          </Link>
        ) : (
          <span
            title="No tenés permisos para editar personas"
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-500"
          >
            Nueva persona
          </span>
        )}
      </div>

      <form className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por apellido, nombre o DNI"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
          />
          <select
            name="carrera"
            defaultValue={carreraId}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
          >
            <option value="">Todas las carreras</option>
            {carrerasVisibles.map((carrera) => (
              <option key={carrera.id} value={carrera.id}>
                {carrera.nombre}
              </option>
            ))}
          </select>
          <select
            name="estado"
            defaultValue={estado}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
          >
            Buscar
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
          <span>{personasOrdenadas.length} personas encontradas</span>
          <a
            href={exportHref}
            className="rounded-lg border border-emerald-700/70 px-4 py-2 text-emerald-300 transition hover:bg-emerald-900/30"
          >
            Exportar XLSX
          </a>
        </div>
      </form>

      {pageError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {pageError}
        </div>
      ) : null}

      <div
        role="region"
        aria-label="Listado de personas"
        tabIndex={0}
        className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        <p className="border-b border-zinc-800 px-4 py-2 text-xs text-zinc-400 lg:hidden">
          Deslizá horizontalmente para ver todas las columnas.
        </p>
        <table className="w-full min-w-[640px] divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/60 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">DNI</th>
              <th className="px-4 py-3 text-left font-medium">Apellido</th>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Carrera</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {personasOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  No se encontraron personas.
                </td>
              </tr>
            ) : (
              personasOrdenadas.map((persona) => {
                const activo = !inactivosSet.has(String(persona.dni))

                return (
                  <tr key={persona.dni} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3">{persona.dni}</td>
                    <td className="px-4 py-3">{persona.apellido}</td>
                    <td className="px-4 py-3">{persona.nombre}</td>
                    <td className="px-4 py-3">
                      {carreraNombre(persona)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          activo
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/personas/${persona.dni}`}
                        className="text-zinc-200 underline underline-offset-4 hover:text-white"
                      >
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
