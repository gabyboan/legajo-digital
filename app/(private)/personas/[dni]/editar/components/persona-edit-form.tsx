import Link from 'next/link'
import { updatePersona } from '../../../actions'

type Option = {
  id: number
  nombre: string
}

type Persona = {
  dni: number
  legajo: number | null
  apellido: string
  nombre: string
  email: string | null
  telefono: string | null
  fecha_nacimiento: string | null
}

type PersonaEditFormProps = {
  persona: Persona
  situaciones: Option[]
  carreras: Option[]
  situacionActualId: string
  carreraActualId: string
}

export function PersonaEditForm({
  persona,
  situaciones,
  carreras,
  situacionActualId,
  carreraActualId,
}: PersonaEditFormProps) {
  return (
    <form
      action={updatePersona}
      className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <input type="hidden" name="dni" value={persona.dni} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">DNI</label>
          <input
            value={persona.dni}
            disabled
            className="w-full rounded-lg border border-zinc-800 bg-zinc-800 px-4 py-3 text-sm text-zinc-400"
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
            defaultValue={persona.legajo ?? ''}
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
            defaultValue={persona.fecha_nacimiento ?? ''}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="apellido" className="mb-2 block text-sm text-zinc-300">
            Apellido *
          </label>
          <input
            id="apellido"
            name="apellido"
            type="text"
            defaultValue={persona.apellido}
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
            defaultValue={persona.nombre}
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
            defaultValue={persona.email ?? ''}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="telefono" className="mb-2 block text-sm text-zinc-300">
            Telefono
          </label>
          <input
            id="telefono"
            name="telefono"
            type="text"
            defaultValue={persona.telefono ?? ''}
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
            defaultValue={carreraActualId}
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
            Situacion de Revista
          </label>
          <select
            id="situacion_id"
            name="situacion_id"
            defaultValue={situacionActualId}
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
          type="submit"
          className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
        >
          Guardar cambios
        </button>

        <Link
          href={`/personas/${persona.dni}`}
          className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
