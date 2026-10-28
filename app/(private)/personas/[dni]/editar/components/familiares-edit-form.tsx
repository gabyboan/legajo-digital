'use client'

import { useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { capitalizarNombre } from '@/lib/nombres'
import { dniDesdeRegistro, formatearDni } from '@/lib/dni'
import { ComprobarNombreFamiliar } from './comprobar-nombre-familiar'
import {
  createFamiliar,
  deleteFamiliar,
  updateFamiliar,
  updateFamiliarFallecido,
} from '../../../actions'

export type Familiar = {
  id: number
  apellido: string
  nombre: string
  fecha_nacimiento: string | null
  dni: number | null
  parentesco: string
  fallecido: boolean
}

type Props = {
  personaDni: number
  familiares: Familiar[]
  returnTo: string
}

const parentescos = ['Hijo/a', 'Padre', 'Madre', 'Conyuge', 'Persona a Cargo']

function DniInput({
  id,
  defaultValue,
  onValueChange,
}: {
  id: string
  defaultValue: number | null | undefined
  onValueChange: (value: string) => void
}) {
  const [value, setValue] = useState(formatearDni(dniDesdeRegistro(defaultValue)))

  return (
    <input
      id={id}
      name="familiar_dni"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(event) => {
        const nuevo = formatearDni(event.currentTarget.value)
        setValue(nuevo)
        onValueChange(nuevo.replace(/\D/g, ''))
      }}
      onCopy={(event) => {
        event.preventDefault()
        event.clipboardData.setData('text/plain', value.replace(/\D/g, ''))
      }}
      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
    />
  )
}

function GuardarFamiliar({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">{pending ? 'Guardando…' : children}</button>
}

function FamiliarFields({ familiar, personaDni }: { familiar?: Familiar; personaDni: number }) {
  const [apellido, setApellido] = useState(capitalizarNombre(familiar?.apellido ?? ''))
  const [nombre, setNombre] = useState(capitalizarNombre(familiar?.nombre ?? ''))
  const [dni, setDni] = useState(dniDesdeRegistro(familiar?.dni))
  const suffix = familiar ? `_${familiar.id}` : '_nuevo'
  const fields: Array<{
    key: Exclude<keyof Omit<Familiar, 'id'>, 'dni' | 'fallecido'> | 'dni'
    label: string
    type?: 'text' | 'date'
    required?: boolean
  }> = [
    { key: 'apellido', label: 'Apellido *', required: true },
    { key: 'nombre', label: 'Nombre *', required: true },
    { key: 'parentesco', label: 'Parentesco *', required: true },
    { key: 'fecha_nacimiento', label: 'Fecha de nacimiento', type: 'date' },
    { key: 'dni', label: 'N.º de documento' },
  ]

  return (
    <>
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      {fields.map((field) => {
        const id = `familiar_${field.key}${suffix}`

        return (
          <div key={field.key}>
            <label htmlFor={id} className="mb-2 block min-h-10 text-sm text-zinc-300">
              {field.label}
            </label>
            {field.key === 'dni' ? (
              <DniInput id={id} defaultValue={familiar?.dni} onValueChange={setDni} />
            ) : field.key === 'parentesco' ? (
              <select
                id={id}
                name={`familiar_${field.key}`}
                required={field.required}
                defaultValue={familiar?.parentesco ?? ''}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Seleccionar parentesco
                </option>
                {parentescos.map((parentesco) => (
                  <option key={parentesco} value={parentesco}>
                    {parentesco}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={`familiar_${field.key}`}
                type={field.type ?? 'text'}
                required={field.required}
                max={
                  field.type === 'date'
                    ? new Date().toISOString().slice(0, 10)
                    : undefined
                }
                defaultValue={
                  field.key === 'apellido' || field.key === 'nombre'
                    ? capitalizarNombre(String(familiar?.[field.key] ?? ''))
                    : familiar?.[field.key] ?? ''
                }
                onChange={(event) => {
                  if (field.key === 'apellido' || field.key === 'nombre') {
                    const value = capitalizarNombre(event.currentTarget.value)
                    event.currentTarget.value = value
                    if (field.key === 'apellido') setApellido(value)
                    else setNombre(value)
                  }
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            )}
          </div>
        )
      })}
    </div>
    <ComprobarNombreFamiliar key={JSON.stringify([personaDni, dni])} personaDni={personaDni} dni={dni} apellido={apellido} nombre={nombre} />
    </>
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
  returnTo,
}: {
  personaDni: number
  familiar: Familiar
  returnTo: string
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <form action={updateFamiliar} className="space-y-3 rounded-xl border border-zinc-800 p-4">
        <input type="hidden" name="dni" value={personaDni} />
        <input type="hidden" name="familiar_id" value={familiar.id} />
        <input type="hidden" name="return_to" value={returnTo} />
        <FamiliarFields familiar={familiar} personaDni={personaDni} />
        <div className="flex gap-2">
          <GuardarFamiliar>Guardar cambios</GuardarFamiliar>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <article className="rounded-xl border border-zinc-800 p-4">
      <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-7">
        <div>
          <span className="block text-xs uppercase text-zinc-500">Apellido</span>
          {familiar.apellido}
        </div>
        <div>
          <span className="block text-xs uppercase text-zinc-500">Nombre</span>
          {familiar.nombre}
        </div>
        <div>
          <span className="block text-xs uppercase text-zinc-500">Parentesco</span>
          {familiar.parentesco}
        </div>
        <div>
          <span className="block text-xs uppercase text-zinc-500">Nacimiento</span>
          {formatDate(familiar.fecha_nacimiento)}
        </div>
        <div>
          <span className="block text-xs uppercase text-zinc-500">N.º de documento</span>
          {formatearDni(dniDesdeRegistro(familiar.dni)) || '-'}
        </div>
        <div>
          <span className="block text-xs uppercase text-zinc-500">Estado</span>
          {familiar.fallecido ? (
            <span className="inline-flex rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300">
              Fallecido
            </span>
          ) : (
            '-'
          )}
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg bg-white px-3 py-2 font-semibold text-black"
          >
            Editar
          </button>
          <form
            action={updateFamiliarFallecido}
            onSubmit={(event) => {
              const message = familiar.fallecido
                ? 'Quitar la marca de fallecido de este familiar?'
                : 'Marcar a este familiar como fallecido?'
              if (!window.confirm(message)) event.preventDefault()
            }}
          >
            <input type="hidden" name="dni" value={personaDni} />
            <input type="hidden" name="familiar_id" value={familiar.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <input
              type="hidden"
              name="fallecido"
              value={String(!familiar.fallecido)}
            />
            <button
              className={
                familiar.fallecido
                  ? 'rounded-lg border border-zinc-700 px-3 py-2 text-sm'
                  : 'rounded-lg border border-amber-500/40 px-3 py-2 text-amber-200'
              }
            >
              {familiar.fallecido ? 'Quitar marca' : 'Marcar fallecido'}
            </button>
          </form>
          <form
            action={deleteFamiliar}
            onSubmit={(event) => {
              if (!window.confirm('¿Eliminar este familiar?')) event.preventDefault()
            }}
          >
            <input type="hidden" name="dni" value={personaDni} />
            <input type="hidden" name="familiar_id" value={familiar.id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button className="rounded-lg border border-red-500/40 px-3 py-2 text-red-300">
              Eliminar
            </button>
          </form>
        </div>
      </div>
    </article>
  )
}

export function FamiliaresEditForm({
  personaDni,
  familiares,
  returnTo,
}: Props) {
  const enviando = useRef(false)
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-lg font-semibold">Datos de familiares</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Informacion compartida con la gestion de partes medicos.
        </p>
      </div>
      {familiares.map((familiar) => (
        <FamiliarRow
          key={familiar.id}
          personaDni={personaDni}
          familiar={familiar}
          returnTo={returnTo}
        />
      ))}
      <form key={`${personaDni}:${familiares.map((f) => f.id).join(',')}`} action={async (formData) => {
        if (enviando.current) return
        enviando.current = true
        try { await createFamiliar(formData) } finally { enviando.current = false }
      }} className="space-y-3 rounded-xl border border-dashed border-zinc-700 p-4">
        <input type="hidden" name="dni" value={personaDni} />
        <input type="hidden" name="return_to" value={returnTo} />
        <h3 className="text-sm font-semibold">Agregar familiar</h3>
        <FamiliarFields personaDni={personaDni} />
        <GuardarFamiliar>Agregar familiar</GuardarFamiliar>
      </form>
    </section>
  )
}