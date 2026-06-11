'use client'

import Link from 'next/link'
import { useState } from 'react'
import { updateAsistenciaPersona } from '../../../actions'

const DIAS_SEMANA = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miercoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sabado' },
  { id: 7, label: 'Domingo' },
]

type HorarioPersona = {
  dia_semana: number
  hora_desde: string
  hora_hasta: string
}

type AsistenciaEditFormProps = {
  dni: number
  carreraActualId: string
  canEditAsistencia: boolean
  horariosPorDia: Map<number, HorarioPersona>
  horarioRotativo: boolean
}

export function AsistenciaEditForm({
  dni,
  carreraActualId,
  canEditAsistencia,
  horariosPorDia,
  horarioRotativo,
}: AsistenciaEditFormProps) {
  const [esRotativo, setEsRotativo] = useState(horarioRotativo)
  const inputsDisabled = !carreraActualId || !canEditAsistencia
  const horariosFijosDisabled = inputsDisabled || esRotativo

  return (
    <form
      action={updateAsistenciaPersona}
      className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <input type="hidden" name="dni" value={dni} />
      <input type="hidden" name="carrera_id" value={carreraActualId} />

      <div>
        <h2 className="text-lg font-semibold">Asistencia</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Carga solo los dias y horarios confirmados. Los datos dudosos pueden
          quedar sin cargar hasta validarlos.
        </p>
      </div>

      {!carreraActualId && canEditAsistencia ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Selecciona y guarda una carrera antes de cargar asistencia.
        </div>
      ) : null}

      <label className="block rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
        <span className="flex items-center gap-3 text-sm font-semibold text-cyan-100">
          <input
            type="checkbox"
            name="horario_rotativo"
            checked={esRotativo}
            onChange={(event) => setEsRotativo(event.target.checked)}
            disabled={inputsDisabled}
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
          />
          Horario rotativo
        </span>
        <span className="mt-2 block text-sm text-cyan-100/75">
          30 horas semanales en turnos de 6 horas: mañana 06:00 a 12:00,
          vespertino 12:00 a 18:00, tarde 18:00 a 00:00 y noche 00:00 a 06:00.
          Al guardar esta modalidad se eliminan los horarios fijos.
        </span>
      </label>

      <div className="space-y-3">
        {DIAS_SEMANA.map((dia) => {
          const horario = horariosPorDia.get(dia.id)

          return (
            <div
              key={dia.id}
              className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[160px_1fr_1fr]"
            >
              <label className="flex items-center gap-3 text-sm font-medium text-zinc-200">
                <input
                  type="checkbox"
                  name={`asiste_${dia.id}`}
                  defaultChecked={Boolean(horario)}
                  disabled={horariosFijosDisabled}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
                />
                {dia.label}
              </label>

              <div>
                <label
                  htmlFor={`hora_desde_${dia.id}`}
                  className="mb-2 block text-xs uppercase tracking-wide text-zinc-500"
                >
                  Desde
                </label>
                <input
                  id={`hora_desde_${dia.id}`}
                  name={`hora_desde_${dia.id}`}
                  type="time"
                  step="60"
                  defaultValue={horario?.hora_desde ?? ''}
                  disabled={horariosFijosDisabled}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
                />
              </div>

              <div>
                <label
                  htmlFor={`hora_hasta_${dia.id}`}
                  className="mb-2 block text-xs uppercase tracking-wide text-zinc-500"
                >
                  Hasta
                </label>
                <input
                  id={`hora_hasta_${dia.id}`}
                  name={`hora_hasta_${dia.id}`}
                  type="time"
                  step="60"
                  defaultValue={horario?.hora_hasta ?? ''}
                  disabled={horariosFijosDisabled}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-600"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        {canEditAsistencia ? (
          <button
            type="submit"
            disabled={!carreraActualId}
            className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar asistencia
          </button>
        ) : null}

        <Link
          href={`/personas/${dni}`}
          className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
