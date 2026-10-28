import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import {
  canCurrentUserEditLegajo,
  canCurrentUserWriteFrancos,
} from '../permissions'
import { updateBancoInicialHorasDesdeListado } from '../actions'
import { formatDate, formatMinutes } from '../format'

type BancoHorasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type BancoListadoRow = {
  dni: number
  apellido: string
  nombre: string
  carrera_id: number | null
  banco_id: number | null
  banco_fecha: string | null
  banco_minutos: number | null
  banco_observacion: string | null
}

const PAGE_SIZE = 100

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function positiveInt(value: string | undefined) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
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

function pageHref(q: string, page: number) {
  const params = new URLSearchParams({ page: String(page) })

  if (q) {
    params.set('q', q)
  }

  return `/personas/banco-horas?${params.toString()}`
}

export default async function BancoHorasPage({
  searchParams,
}: BancoHorasPageProps) {
  const supabase = await createClient()
  const params = (await searchParams) ?? {}
  const q = (firstParam(params.q) ?? '').trim()
  const page = positiveInt(firstParam(params.page))
  const pageError = firstParam(params.error)
  const updated = firstParam(params.updated)
  const dniSearch = /^\d+$/.test(q) ? Number(q) : null

  const [canEdit, canWriteFrancos, bancoRes] = await Promise.all([
    canCurrentUserEditLegajo(supabase),
    canCurrentUserWriteFrancos(supabase),
    supabase.rpc('rpc_francos_banco_inicial_listar', {
      p_search: dniSearch === null ? q || null : null,
      p_dni: dniSearch,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
  ])
  const canEditBanco = canEdit && canWriteFrancos

  if (bancoRes.error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        Error al cargar el banco de horas: {bancoRes.error.message}
      </div>
    )
  }

  const rows = (bancoRes.data ?? []) as BancoListadoRow[]
  const hasNextPage = rows.length === PAGE_SIZE

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
                const saldo = splitMinutes(row.banco_minutos)
                const disabled = !canEditBanco || !row.carrera_id

                return (
                  <tr key={row.dni} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-medium">{row.dni}</td>
                    <td className="px-4 py-3">{row.apellido}</td>
                    <td className="px-4 py-3">{row.nombre}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {row.banco_id ? (
                        <span>
                          {formatMinutes(row.banco_minutos ?? 0)} desde{' '}
                          {formatDate(row.banco_fecha ?? '')}
                        </span>
                      ) : row.carrera_id ? (
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
                          value={row.carrera_id ?? ''}
                        />
                        <input type="hidden" name="q" value={q} />
                        <input type="hidden" name="page" value={page} />
                        <input
                          type="date"
                          name="saldo_inicial_fecha"
                          defaultValue={row.banco_fecha ?? todayInputValue()}
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
                          defaultValue={row.banco_id ? saldo.horas : ''}
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
                          defaultValue={row.banco_id ? saldo.minutos : ''}
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
        {hasNextPage ? (
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