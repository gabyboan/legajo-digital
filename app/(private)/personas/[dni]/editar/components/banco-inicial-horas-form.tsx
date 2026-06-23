import {
  deleteBancoInicialHoras,
  updateBancoInicialHoras,
} from '../../../actions'
import { formatDate, formatMinutes } from '../../../format'

export type BancoInicialHoras = {
  id: number
  fecha: string
  minutos: number
  observacion: string | null
}

type BancoInicialHorasFormProps = {
  dni: number
  carreraActualId: string
  canEditBancoInicial: boolean
  bancoInicial: BancoInicialHoras | null
}

export function BancoInicialHorasForm({
  dni,
  carreraActualId,
  canEditBancoInicial,
  bancoInicial,
}: BancoInicialHorasFormProps) {
  const minutosAbs = Math.abs(bancoInicial?.minutos ?? 0)
  const horas = Math.floor(minutosAbs / 60)
  const minutos = minutosAbs % 60
  const signo = bancoInicial && bancoInicial.minutos < 0 ? '-1' : '1'

  return (
    <div
      id="banco-horas"
      className="scroll-mt-6 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div>
        <h2 className="text-lg font-semibold">Banco inicial de horas</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Punto de partida del saldo. Puede quedar sin cargar.
        </p>
      </div>

      {bancoInicial ? (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          Cargado: {formatMinutes(bancoInicial.minutos)} desde{' '}
          {formatDate(bancoInicial.fecha)}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
          Sin banco inicial cargado.
        </div>
      )}

      {!carreraActualId && canEditBancoInicial ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Selecciona y guarda una carrera antes de cargar banco inicial.
        </div>
      ) : null}

      {canEditBancoInicial ? (
        <form action={updateBancoInicialHoras} className="space-y-4">
          <input type="hidden" name="dni" value={dni} />
          <input type="hidden" name="carrera_id" value={carreraActualId} />

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_1fr]">
            <div>
              <label
                htmlFor="saldo_inicial_fecha"
                className="mb-2 block text-sm text-zinc-300"
              >
                Fecha
              </label>
              <input
                id="saldo_inicial_fecha"
                name="saldo_inicial_fecha"
                type="date"
                defaultValue={bancoInicial?.fecha ?? ''}
                disabled={!carreraActualId}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
              />
            </div>

            <div>
              <label
                htmlFor="saldo_inicial_signo"
                className="mb-2 block text-sm text-zinc-300"
              >
                Tipo
              </label>
              <select
                id="saldo_inicial_signo"
                name="saldo_inicial_signo"
                defaultValue={signo}
                disabled={!carreraActualId}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
              >
                <option value="1">A favor</option>
                <option value="-1">En contra</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="saldo_inicial_horas"
                className="mb-2 block text-sm text-zinc-300"
              >
                Horas
              </label>
              <input
                id="saldo_inicial_horas"
                name="saldo_inicial_horas"
                type="number"
                min="0"
                step="1"
                defaultValue={bancoInicial ? horas : ''}
                disabled={!carreraActualId}
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
              />
            </div>

            <div>
              <label
                htmlFor="saldo_inicial_minutos"
                className="mb-2 block text-sm text-zinc-300"
              >
                Minutos
              </label>
              <input
                id="saldo_inicial_minutos"
                name="saldo_inicial_minutos"
                type="number"
                min="0"
                max="59"
                step="1"
                defaultValue={bancoInicial ? minutos : ''}
                disabled={!carreraActualId}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="saldo_inicial_observacion"
              className="mb-2 block text-sm text-zinc-300"
            >
              Observacion
            </label>
            <textarea
              id="saldo_inicial_observacion"
              name="saldo_inicial_observacion"
              defaultValue={bancoInicial?.observacion ?? ''}
              disabled={!carreraActualId}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!carreraActualId}
              className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Guardar banco inicial
            </button>
          </div>
        </form>
      ) : null}

      {bancoInicial && canEditBancoInicial ? (
        <form action={deleteBancoInicialHoras}>
          <input type="hidden" name="dni" value={dni} />
          <input type="hidden" name="carrera_id" value={carreraActualId} />
          <button
            type="submit"
            disabled={!carreraActualId}
            className="rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Eliminar banco inicial
          </button>
        </form>
      ) : null}
    </div>
  )
}
