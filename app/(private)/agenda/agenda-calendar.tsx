'use client'

import { useMemo, useState } from 'react'
import { createFeriado, deleteFeriado, updateFeriado } from './actions'

export type Feriado = {
  id: number
  fecha: string
  nombre: string
  observacion: string | null
}

type AgendaCalendarProps = {
  feriados: Feriado[]
  canManage: boolean
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const monthFormatter = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
})
const selectedDateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function createMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    )

    return {
      date,
      key: formatDateKey(date.getFullYear(), date.getMonth(), date.getDate()),
      isCurrentMonth: date.getMonth() === month,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    }
  })
}

export function AgendaCalendar({ feriados, canManage }: AgendaCalendarProps) {
  const today = new Date()
  const todayKey = formatDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selectedDate, setSelectedDate] = useState(todayKey)

  const feriadosByDate = useMemo(
    () => new Map(feriados.map((feriado) => [feriado.fecha, feriado])),
    [feriados]
  )
  const monthDays = useMemo(
    () => createMonthDays(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth]
  )
  const selectedFeriado = feriadosByDate.get(selectedDate)

  function moveMonth(offset: number) {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1)
    )
  }

  function selectToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(todayKey)
  }

  function selectDay(day: (typeof monthDays)[number]) {
    setSelectedDate(day.key)

    if (!day.isCurrentMonth) {
      setVisibleMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1))
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="min-w-[720px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Mes anterior"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Mes siguiente"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800"
            >
              ›
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800"
            >
              Hoy
            </button>
          </div>

          <h2 className="text-lg font-semibold capitalize">
            {monthFormatter.format(visibleMonth)}
          </h2>
        </div>

        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/60">
          {DAY_NAMES.map((dayName) => (
            <div
              key={dayName}
              className="border-r border-zinc-800 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 last:border-r-0"
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {monthDays.map((day) => {
            const feriado = feriadosByDate.get(day.key)
            const selected = selectedDate === day.key
            const isToday = todayKey === day.key

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => selectDay(day)}
                className={`relative min-h-24 border-b border-r border-zinc-800 p-2 text-left transition last:border-r-0 hover:bg-zinc-800/70 sm:min-h-28 ${
                  selected ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-400/60' : ''
                } ${day.isWeekend ? 'bg-zinc-950/45' : ''} ${
                  day.isCurrentMonth ? 'text-zinc-200' : 'text-zinc-600'
                }`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full text-xs ${
                    isToday ? 'bg-white font-bold text-black' : ''
                  }`}
                >
                  {day.date.getDate()}
                </span>

                {feriado ? (
                  <span className="mt-2 block rounded-md border border-amber-400/30 bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-100">
                    {feriado.nombre}
                  </span>
                ) : day.isWeekend ? (
                  <span className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-600">
                    No laborable
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900 p-5 xl:sticky xl:top-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Fecha seleccionada
        </p>
        <h2 className="mt-2 text-lg font-semibold capitalize">
          {selectedDateFormatter.format(new Date(`${selectedDate}T00:00:00Z`))}
        </h2>

        {selectedFeriado ? (
          <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4">
            <p className="font-semibold text-amber-100">
              {selectedFeriado.nombre}
            </p>
            {selectedFeriado.observacion ? (
              <p className="mt-2 text-sm text-amber-100/70">
                {selectedFeriado.observacion}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
            No hay un feriado cargado para esta fecha.
          </p>
        )}

        {canManage ? (
          <form
            key={`${selectedDate}-${selectedFeriado?.id ?? 'new'}`}
            action={selectedFeriado ? updateFeriado : createFeriado}
            className="mt-5 space-y-4"
          >
            {selectedFeriado ? (
              <input type="hidden" name="id" value={selectedFeriado.id} />
            ) : null}
            <input type="hidden" name="fecha" value={selectedDate} />

            <div>
              <label htmlFor="agenda_nombre" className="mb-2 block text-sm text-zinc-300">
                Nombre del feriado
              </label>
              <input
                id="agenda_nombre"
                name="nombre"
                required
                autoFocus
                defaultValue={selectedFeriado?.nombre ?? ''}
                placeholder="Ej. Día del trabajador"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label htmlFor="agenda_observacion" className="mb-2 block text-sm text-zinc-300">
                Observación
              </label>
              <textarea
                id="agenda_observacion"
                name="observacion"
                rows={3}
                defaultValue={selectedFeriado?.observacion ?? ''}
                placeholder="Opcional"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </div>

            <button className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">
              {selectedFeriado ? 'Guardar cambios' : 'Agregar al calendario'}
            </button>
          </form>
        ) : null}

        {canManage && selectedFeriado ? (
          <form action={deleteFeriado} className="mt-3">
            <input type="hidden" name="id" value={selectedFeriado.id} />
            <button className="w-full rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/10">
              Eliminar feriado
            </button>
          </form>
        ) : null}
      </aside>
    </div>
  )
}
