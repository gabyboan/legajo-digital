import { inactivarPersona, reactivarPersona } from '../../actions'
import { formatDate } from '../../format'

type Inactivo = {
  causa: string
  fecha: string | null
  observaciones: string | null
}

type PeriodoInactividad = {
  id: number
  causa: string
  fecha_desde: string
  fecha_hasta: string | null
  observaciones: string | null
}

type EstadoLegajoCardProps = {
  dni: number
  inactivo: Inactivo | null
  periodos: PeriodoInactividad[]
  canEdit: boolean
}

export function EstadoLegajoCard({
  dni,
  inactivo,
  periodos,
  canEdit,
}: EstadoLegajoCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Estado del legajo</h2>

      {!canEdit ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
          No tenes permisos para modificar el estado del legajo.
        </div>
      ) : !inactivo ? (
        <form action={inactivarPersona} className="mt-5 space-y-4">
          <input type="hidden" name="dni" value={dni} />

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Causa *</label>
            <select
              name="causa"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            >
              <option value="">Seleccionar</option>
              <option value="JUBILADO">JUBILADO</option>
              <option value="CESANTEADO">CESANTEADO</option>
              <option value="FALLECIDO">FALLECIDO</option>
              <option value="RENUNCIO">RENUNCIO</option>
              <option value="PASE_FUERA">PASE FUERA DE LA INSTITUCIÓN</option>
              <option value="TRASLADO_FUERA">TRASLADO FUERA DE LA INSTITUCIÓN</option>
              <option value="CORTE_SUPLENCIA">CORTE DE SUPLENCIA</option>
              <option value="OTRO">OTRO</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Fecha de inicio *
            </label>
            <input
              name="fecha_desde"
              type="date"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Observaciones
            </label>
            <textarea
              name="observaciones"
              rows={4}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Inactivar persona
          </button>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <p>
              <strong>Causa:</strong> {inactivo.causa}
            </p>
            <p className="mt-2">
              <strong>Fecha:</strong> {formatDate(inactivo.fecha)}
            </p>
            <p className="mt-2">
              <strong>Observaciones:</strong> {inactivo.observaciones ?? '-'}
            </p>
          </div>

          <form action={reactivarPersona} className="space-y-4">
            <input type="hidden" name="dni" value={dni} />
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Fecha de reactivación *
              </label>
              <input
                name="fecha_hasta"
                type="date"
                min={inactivo.fecha ?? undefined}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Reactivar persona
            </button>
          </form>
        </div>
      )}

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <h3 className="text-sm font-semibold text-zinc-200">
          Historial de inactividad
        </h3>
        {periodos.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No hay períodos de inactividad registrados.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {periodos.map((periodo) => (
              <li
                key={periodo.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm"
              >
                <p className="font-medium text-zinc-200">{periodo.causa}</p>
                <p className="mt-1 text-zinc-400">
                  {formatDate(periodo.fecha_desde)} —{' '}
                  {periodo.fecha_hasta
                    ? formatDate(periodo.fecha_hasta)
                    : 'vigente'}
                </p>
                {periodo.observaciones ? (
                  <p className="mt-1 text-zinc-400">{periodo.observaciones}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}