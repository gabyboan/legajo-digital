import Link from 'next/link'
import { updatePersona } from '../../../actions'
import { DatosFichaAdicionales, type DomicilioValores } from '../../../components/datos-ficha-adicionales'

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
  cuil: number | null
  reloj: number | null
  indice: string | null
  sexo_id: number | null
  numero_contacto: number | null
  estado_civil: string | null
  fecha_ingreso: string | null
  formacion_estudio: string | null
  matricula: string | null
  nivel_escolaridad: string | null
  estado_escolaridad: string | null
  fecha_inicio_tarea_especifica: string | null
  observacion: string | null
}


type PersonaEditFormProps = {
  persona: Persona
  situaciones: Option[]
  carreras: Option[]
  sexos: Option[]
  domicilio: Partial<DomicilioValores> | null
  situacionActualId: string
  carreraActualId: string
}

export function PersonaEditForm({
  persona,
  situaciones,
  carreras,
  sexos,
  domicilio,
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
        <div className="order-[1] md:col-span-2">
          <h2 className="text-lg font-semibold">Datos personales</h2>
          <p className="mt-1 text-sm text-zinc-400">Identificacion y contacto.</p>
        </div>
        <div className="order-[2]">
          <label className="mb-2 block text-sm text-zinc-300">DNI</label>
          <input
            value={persona.dni}
            disabled
            className="w-full rounded-lg border border-zinc-800 bg-zinc-800 px-4 py-3 text-sm text-zinc-400"
          />
        </div>

        <div className="order-[9]">
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

        <DatosFichaAdicionales
            sexos={sexos}
            ficha={persona}
            domicilio={domicilio}
          />

        <div className="order-[8] md:col-span-2 border-t border-zinc-800 pt-5">
          <h2 className="text-lg font-semibold">Datos laborales</h2>
          <p className="mt-1 text-sm text-zinc-400">Vinculo administrativo, carrera y situacion de revista.</p>
        </div>

        <div className="order-[3]">
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

        <div className="order-[4]">
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

        <div className="order-[5]">
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

        <div className="order-[6]">
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

        <div className="order-[7]">
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

        <div className="order-[10]">
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

        <div className="order-[11] md:col-span-2">
  <label htmlFor="situacion_id" className="mb-2 block text-sm text-zinc-300">
    Situación de revista *
  </label>
  <select
    id="situacion_id"
    name="situacion_id"
    defaultValue={situacionActualId}
    required
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
