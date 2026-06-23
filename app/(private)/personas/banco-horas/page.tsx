import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import {
  canCurrentUserEditLegajo,
  canCurrentUserWriteFrancos,
} from '../permissions'
import { updateBancoInicialHorasDesdeListado } from '../actions'
import { formatDate, formatMinutes } from '../format'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type BancoHorasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type PersonaRow = {
  dni: number
  apellido: string
  nombre: string
}

type CarreraRow = {
  dni: number
  carrera_id: number
}

type BancoInicialRow = {
  id: number
  fecha: string
  minutos: number
  observacion: string | null
}

type BancoRow = PersonaRow & {
  carreraId: number | null
  bancoInicial: BancoInicialRow | null
  bancoError: string | null
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function splitMinutes(value: number | null | undefined) {
  const absolute = Math.abs(value ?? 0)

  return {
    signo: value && value < 0 ? '-1' : '1',
    horas: Math.floor(absolute / 60),
    minutos: absolute % 60,
  }
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}


async function fetchAllPersonas(supabase: SupabaseClient, q: string) {
  const pageSize = 1000
  const allPersonas: PersonaRow[] = []

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('personas')
      .select('dni, apellido, nombre')
      .order('apellido', { ascending: true })
      .order('nombre', { ascending: true })
      .range(from, from + pageSize - 1)

    if (q) {
      if (/^\d+$/.test(q)) {
        query = query.eq('dni', Number(q))
      } else {
        query = query.or(`apellido.ilike.%${q}%,nombre.ilike.%${q}%`)
      }
    }

    const { data, error } = await query

    if (error) {
      return { data: null, error }
    }

    const personas = (data ?? []) as PersonaRow[]
    allPersonas.push(...personas)

    if (personas.length < pageSize) {
      return { data: allPersonas, error: null }
    }
  }
}

async function fetchCarrerasByDni(
  supabase: SupabaseClient,
  dnis: number[]
) {
  const pageSize = 500
  const allCarreras: CarreraRow[] = []

  for (let index = 0; index < dnis.length; index += pageSize) {
    const dniChunk = dnis.slice(index, index + pageSize)
    const { data, error } = await supabase
      .from('persona_carreras')
      .select('dni, carrera_id')
      .in('dni', dniChunk)

    if (error) {
      return { data: null, error }
    }

    allCarreras.push(...((data ?? []) as CarreraRow[]))
  }

  return { data: allCarreras, error: null }
}
export default async function BancoHorasPage({
  searchParams,
}: BancoHorasPageProps) {
  const supabase = await createClient()
  const params = (await searchParams) ?? {}
  const q = (firstParam(params.q) ?? '').trim()
  const pageError = firstParam(params.error)
  const updated = firstParam(params.updated)

  const [canEdit, canWriteFrancos] = await Promise.all([
    canCurrentUserEditLegajo(supabase),
    canCurrentUserWriteFrancos(supabase),
  ])
  const canEditBanco = canEdit && canWriteFrancos

  const { data: personas, error: personasError } = await fetchAllPersonas(
    supabase,
    q
  )

  if (personasError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        Error al cargar personas: {personasError.message}
      </div>
    )
  }

  const personasList = (personas ?? []) as PersonaRow[]
  const dnis = personasList.map((persona) => persona.dni)
  const carrerasRes =
    dnis.length > 0
      ? await fetchCarrerasByDni(supabase, dnis)
      : { data: [], error: null }

  const carreraPorDni = new Map<number, number>()

  for (const carrera of (carrerasRes.data ?? []) as CarreraRow[]) {
    if (!carreraPorDni.has(carrera.dni)) {
      carreraPorDni.set(carrera.dni, carrera.carrera_id)
    }
  }

  const rows: BancoRow[] = await Promise.all(
    personasList.map(async (persona) => {
      const carreraId = carreraPorDni.get(persona.dni) ?? null

      if (!carreraId) {
        return {
          ...persona,
          carreraId,
          bancoInicial: null,
          bancoError: null,
        }
      }

      const bancoRes = await supabase.rpc('rpc_francos_saldo_inicial_actual', {
        p_dni: persona.dni,
        p_carrera_id: carreraId,
      })

      return {
        ...persona,
        carreraId,
        bancoInicial:
          ((bancoRes.data ?? [])[0] as BancoInicialRow | undefined) ?? null,
        bancoError: bancoRes.error?.message ?? null,
      }
    })
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banco inicial de horas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Carga rapida del saldo inicial por persona.
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

      {updated ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Banco inicial guardado para DNI {updated}.
        </div>
      ) : null}

      {carrerasRes.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error al cargar carreras: {carrerasRes.error.message}
        </div>
      ) : null}

      {!canEditBanco ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          No tenes permisos para cargar banco inicial de horas.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-[1080px] divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/60 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">DNI</th>
              <th className="px-4 py-3 text-left font-medium">Apellido</th>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Actual</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Horas</th>
              <th className="px-4 py-3 text-left font-medium">Min</th>
              <th className="px-4 py-3 text-left font-medium">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                  No se encontraron personas.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const saldo = splitMinutes(row.bancoInicial?.minutos)
                const disabled = !canEditBanco || !row.carreraId

                return (
                  <tr key={row.dni} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium">{row.dni}</td>
                    <td className="px-4 py-3">{row.apellido}</td>
                    <td className="px-4 py-3">{row.nombre}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {row.bancoError ? (
                        <span className="text-red-300">Error</span>
                      ) : row.bancoInicial ? (
                        <span>
                          {formatMinutes(row.bancoInicial.minutos)} desde{' '}
                          {formatDate(row.bancoInicial.fecha)}
                        </span>
                      ) : row.carreraId ? (
                        <span className="text-zinc-500">Sin cargar</span>
                      ) : (
                        <span className="text-amber-200">Sin carrera</span>
                      )}
                    </td>
                    <td colSpan={5} className="px-4 py-3">
                      <form
                        action={updateBancoInicialHorasDesdeListado}
                        className="grid grid-cols-[150px_120px_90px_80px_96px] items-center gap-2"
                      >
                        <input type="hidden" name="dni" value={row.dni} />
                        <input
                          type="hidden"
                          name="carrera_id"
                          value={row.carreraId ?? ''}
                        />
                        <input type="hidden" name="q" value={q} />
                        <input
                          type="date"
                          name="saldo_inicial_fecha"
                          defaultValue={row.bancoInicial?.fecha ?? todayInputValue()}
                          disabled={disabled}
                          required
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
                        />
                        <select
                          name="saldo_inicial_signo"
                          defaultValue={saldo.signo}
                          disabled={disabled}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
                        >
                          <option value="1">A favor</option>
                          <option value="-1">En contra</option>
                        </select>
                        <input
                          type="number"
                          name="saldo_inicial_horas"
                          min="0"
                          step="1"
                          defaultValue={row.bancoInicial ? saldo.horas : ''}
                          placeholder="0"
                          disabled={disabled}
                          required
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
                        />
                        <input
                          type="number"
                          name="saldo_inicial_minutos"
                          min="0"
                          max="59"
                          step="1"
                          defaultValue={row.bancoInicial ? saldo.minutos : ''}
                          placeholder="0"
                          disabled={disabled}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
                        />
                        <button
                          type="submit"
                          disabled={disabled}
                          className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Guardar
                        </button>
                      </form>
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
