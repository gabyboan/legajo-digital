import { formatDate, formatDateTime } from '../../format'

type Persona = {
  dni: number
  legajo: number | null
  apellido: string
  nombre: string
  email: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  created_at: string | null
  updated_at: string | null
}

type DatosPersonalesCardProps = {
  persona: Persona
  inactivo: boolean
  carrera: string
  situacion: string
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-200">{value}</dd>
    </div>
  )
}

export function DatosPersonalesCard({
  persona,
  inactivo,
  carrera,
  situacion,
}: DatosPersonalesCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
      <h2 className="text-lg font-semibold">Datos personales</h2>

      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="DNI" value={persona.dni} />
        <Field label="Legajo" value={persona.legajo ?? '-'} />

        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Estado
          </dt>
          <dd className="mt-1 text-sm">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                inactivo
                  ? 'bg-red-500/15 text-red-300'
                  : 'bg-emerald-500/15 text-emerald-300'
              }`}
            >
              {inactivo ? 'Inactivo' : 'Activo'}
            </span>
          </dd>
        </div>

        <Field label="Carrera" value={carrera} />
        <Field label="Apellido" value={persona.apellido} />
        <Field label="Nombre" value={persona.nombre} />
        <Field label="Email" value={persona.email ?? '-'} />
        <Field label="Telefono" value={persona.telefono ?? '-'} />
        <Field
          label="Fecha de nacimiento"
          value={formatDate(persona.fecha_nacimiento)}
        />
        <Field label="Situacion de Revista" value={situacion} />
        <Field label="Creado" value={formatDateTime(persona.created_at)} />
        <Field
          label="Actualizado"
          value={formatDateTime(persona.updated_at)}
        />
      </dl>
    </div>
  )
}
