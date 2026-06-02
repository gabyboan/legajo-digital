'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { createPersona } from '../actions'

type Option = {
  id: number
  nombre: string
}

type NuevaPersonaFormProps = {
  situaciones: Option[]
  carreras: Option[]
  canEditAsistencia: boolean
}

const DIAS_SEMANA = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 7, label: 'Domingo' },
]

export function NuevaPersonaForm({
  situaciones,
  carreras,
  canEditAsistencia,
}: NuevaPersonaFormProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const formRef = useRef<HTMLFormElement>(null)

  function goNext() {
    const form = formRef.current
    if (!form) return

    if (!form.reportValidity()) {
      return
    }

    if (!canEditAsistencia) {
      form.requestSubmit()
      return
    }

    setStep(2)
  }

  return (
    <form
      ref={formRef}
      action={createPersona}
      className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div className="flex gap-2 text-xs font-medium">
        <span
          className={`rounded-full px-3 py-1 ${
            step === 1
              ? 'bg-white text-black'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          1. Datos
        </span>
        {canEditAsistencia ? (
          <span
            className={`rounded-full px-3 py-1 ${
              step === 2
                ? 'bg-white text-black'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            2. Asistencia
          </span>
        ) : null}
      </div>

      <div className={step === 1 ? 'space-y-6' : 'hidden'}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="dni" className="mb-2 block text-sm text-zinc-300">
              DNI *
            </label>
            <input
              id="dni"
              name="dni"
              type="number"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="legajo" className="mb-2 block text-sm text-zinc-300">
              Legajo
            </label>
            <input
              id="legajo"
              name="legajo"
              type="number"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="fecha_nacimiento"
              className="mb-2 block text-sm text-zinc-300"
            >
              Fecha de nacimiento
            </label>
            <input
              id="fecha_nacimiento"
              name="fecha_nacimiento"
              type="date"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="apellido"
              className="mb-2 block text-sm text-zinc-300"
            >
              Apellido *
            </label>
            <input
              id="apellido"
              name="apellido"
              type="text"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="nombre" className="mb-2 block text-sm text-zinc-300">
              Nombre *
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-zinc-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="telefono"
              className="mb-2 block text-sm text-zinc-300"
            >
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              type="text"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="carrera_id"
              className="mb-2 block text-sm text-zinc-300"
            >
              Carrera *
            </label>
            <select
              id="carrera_id"
              name="carrera_id"
              defaultValue=""
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            >
              <option value="">Seleccionar</option>
              {carreras.map((carrera) => (
                <option key={carrera.id} value={carrera.id}>
                  {carrera.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="situacion_id"
              className="mb-2 block text-sm text-zinc-300"
            >
              Situación de Revista
            </label>
            <select
              id="situacion_id"
              name="situacion_id"
              defaultValue=""
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
            >
              <option value="">Seleccionar</option>
              {situaciones.map((situacion) => (
                <option key={situacion.id} value={situacion.id}>
                  {situacion.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            {canEditAsistencia ? 'Siguiente' : 'Guardar persona'}
          </button>

          <Link
            href="/personas"
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
          >
            Cancelar
          </Link>
        </div>
      </div>

      {canEditAsistencia ? (
      <div className={step === 2 ? 'space-y-6' : 'hidden'}>
        <div>
          <h2 className="text-lg font-semibold">Asistencia</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Cargá solo los días y horarios confirmados. Podés dejarlo vacío y
            completarlo luego desde editar persona.
          </p>
        </div>

        <div className="space-y-3">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia.id}
              className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[160px_1fr_1fr]"
            >
              <label className="flex items-center gap-3 text-sm font-medium text-zinc-200">
                <input
                  type="checkbox"
                  name={`asiste_${dia.id}`}
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
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
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
          >
            Anterior
          </button>

          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Guardar persona
          </button>

          <Link
            href="/personas"
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
          >
            Cancelar
          </Link>
        </div>
      </div>
      ) : null}
    </form>
  )
}
