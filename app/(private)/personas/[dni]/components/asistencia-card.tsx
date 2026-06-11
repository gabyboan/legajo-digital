import Link from 'next/link'
import { formatHourMinute, formatMinutes } from '../../format'

const DIAS_SEMANA = new Map([
  [1, 'Lunes'],
  [2, 'Martes'],
  [3, 'Miercoles'],
  [4, 'Jueves'],
  [5, 'Viernes'],
  [6, 'Sabado'],
  [7, 'Domingo'],
])

export type HorarioPersona = {
  id: number
  dia_semana: number
  hora_desde: string
  hora_hasta: string
  minutos: number
}

type AsistenciaCardProps = {
  dni: number
  horarios: HorarioPersona[]
  horarioRotativo: boolean
  canEdit: boolean
}

export function AsistenciaCard({
  dni,
  horarios,
  horarioRotativo,
  canEdit,
}: AsistenciaCardProps) {
  const cargaSemanalMinutos = horarios.reduce(
    (total, horario) => total + horario.minutos,
    0
  )

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Asistencia</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Planilla semanal de dias y horarios.
          </p>
        </div>

        {canEdit ? (
          <Link
            href={`/personas/${dni}/editar`}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs transition hover:bg-zinc-800"
          >
            Editar
          </Link>
        ) : null}
      </div>

      {horarioRotativo ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            Horario rotativo: 30 horas semanales en turnos de 6 horas.
          </div>
          <p className="text-sm text-zinc-400">
            Turnos posibles: mañana 06:00 a 12:00, vespertino 12:00 a 18:00,
            tarde 18:00 a 00:00 y noche 00:00 a 06:00.
          </p>
        </div>
      ) : horarios.length === 0 ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
          Sin asistencia cargada.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            Carga semanal: {formatMinutes(cargaSemanalMinutos)}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Dia</th>
                  <th className="px-4 py-3">Horario</th>
                  <th className="px-4 py-3">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {horarios.map((horario) => (
                  <tr key={horario.id}>
                    <td className="px-4 py-3 text-zinc-200">
                      {DIAS_SEMANA.get(horario.dia_semana) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {formatHourMinute(horario.hora_desde)} a{' '}
                      {formatHourMinute(horario.hora_hasta)}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {formatMinutes(horario.minutos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
