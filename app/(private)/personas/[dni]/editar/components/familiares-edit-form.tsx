'use client'

import { useState } from 'react'
import { createFamiliar, deleteFamiliar, updateFamiliar } from '../../../actions'

export type Familiar = {
  id: number
  apellido: string
  nombre: string
  fecha_nacimiento: string | null
  dni: number | null
  parentesco: string
}

type Props = { personaDni: number; familiares: Familiar[] }

function FamiliarFields({ familiar }: { familiar?: Familiar }) {
  const suffix = familiar ? `_${familiar.id}` : '_nuevo'
  const fields: Array<{
    key: keyof Omit<Familiar, 'id'>
    label: string
    type?: 'text' | 'date' | 'number'
    required?: boolean
  }> = [
    { key: 'apellido', label: 'Apellido *', required: true },
    { key: 'nombre', label: 'Nombre *', required: true },
    { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date' },
    { key: 'dni', label: 'DNI', type: 'number' },
    { key: 'parentesco', label: 'Parentesco *', required: true },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      {fields.map((field) => (
        <div key={field.key}>
          <label htmlFor={`familiar_${field.key}${suffix}`} className="mb-2 block text-sm text-zinc-300">{field.label}</label>
          <input
            id={`familiar_${field.key}${suffix}`}
            name={`familiar_${field.key}`}
            type={field.type ?? 'text'}
            required={field.required}
            min={field.type === 'number' ? 1 : undefined}
            max={field.type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
            defaultValue={familiar?.[field.key] ?? ''}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      ))}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function FamiliarRow({
  personaDni,
  familiar,
}: {
  personaDni: number
  familiar: Familiar
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <form action={updateFamiliar} className="space-y-3 rounded-xl border border-zinc-800 p-4">
        <input type="hidden" name="dni" value={personaDni} />
        <input type="hidden" name="familiar_id" value={familiar.id} />
        <FamiliarFields familiar={familiar} />
        <div className="flex gap-2">
          <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black">Guardar cambios</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm">Cancelar</button>
        </div>
      </form>
    )
  }

  return (
    <article className="rounded-xl border border-zinc-800 p-4">
      <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
        <div><span className="block text-xs uppercase text-zinc-500">Apellido y nombre</span>{familiar.apellido}, {familiar.nombre}</div>
        <div><span className="block text-xs uppercase text-zinc-500">Nacimiento</span>{formatDate(familiar.fecha_nacimiento)}</div>
        <div><span className="block text-xs uppercase text-zinc-500">DNI</span>{familiar.dni ?? '-'}</div>
        <div><span className="block text-xs uppercase text-zinc-500">Parentesco</span>{familiar.parentesco}</div>
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg bg-white px-3 py-2 font-semibold text-black">Editar</button>
          <form action={deleteFamiliar} onSubmit={(event) => { if (!window.confirm('¿Eliminar este familiar?')) event.preventDefault() }}>
            <input type="hidden" name="dni" value={personaDni} />
            <input type="hidden" name="familiar_id" value={familiar.id} />
            <button className="rounded-lg border border-red-500/40 px-3 py-2 text-red-300">Eliminar</button>
          </form>
        </div>
      </div>
    </article>
  )
}

export function FamiliaresEditForm({ personaDni, familiares }: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div><h2 className="text-lg font-semibold">Datos de familiares</h2><p className="mt-1 text-sm text-zinc-400">Informacion compartida con la gestion de partes medicos.</p></div>
      {familiares.map((familiar) => (
        <FamiliarRow
          key={familiar.id}
          personaDni={personaDni}
          familiar={familiar}
        />
      ))}
      <form action={createFamiliar} className="space-y-3 rounded-xl border border-dashed border-zinc-700 p-4">
        <input type="hidden" name="dni" value={personaDni} />
        <h3 className="text-sm font-semibold">Agregar familiar</h3>
        <FamiliarFields />
        <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black">Agregar familiar</button>
      </form>
    </section>
  )
}
