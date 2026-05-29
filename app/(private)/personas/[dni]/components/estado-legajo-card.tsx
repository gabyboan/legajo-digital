import { inactivarPersona, reactivarPersona } from '../../actions'
import { formatDate } from '../../format'

type Inactivo = {
  causa: string
  fecha: string | null
  observaciones: string | null
}

type EstadoLegajoCardProps = {
  dni: number
  inactivo: Inactivo | null
  canEdit: boolean
}

export function EstadoLegajoCard({
  dni,
  inactivo,
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
            </select>
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

          <form action={reactivarPersona}>
            <input type="hidden" name="dni" value={dni} />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Reactivar persona
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
