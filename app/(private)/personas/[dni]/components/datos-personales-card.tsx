import { formatDate, formatDateTime } from '../../format'
import type { DomicilioValores } from '../../components/datos-ficha-adicionales'

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
  fecha_inicio_tarea_especifica: string | null
  observacion: string | null
}

type Props = {
  persona: Persona
  sexo: string
  domicilio: Partial<DomicilioValores> | null
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{value ?? '-'}</dd>
    </div>
  )
}

export function DatosPersonalesCard({ persona, sexo, domicilio }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
      <h2 className="text-lg font-semibold">Ficha personal</h2>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="DNI" value={persona.dni} />
        <Field label="CUIL" value={persona.cuil} />
        <Field label="Apellido" value={persona.apellido} />
        <Field label="Nombre" value={persona.nombre} />
        <Field label="Número de reloj" value={persona.reloj} />
        <Field label="Índice" value={persona.indice} />
        <Field label="Sexo" value={sexo} />
        <Field label="Estado civil" value={persona.estado_civil} />
        <Field label="Email" value={persona.email} />
        <Field label="Teléfono" value={persona.telefono} />
        <Field label="Número de contacto" value={persona.numero_contacto} />
        <Field label="Fecha de nacimiento" value={formatDate(persona.fecha_nacimiento)} />
      </dl>

      <h3 className="mt-7 text-base font-semibold">Formación y antecedentes</h3>
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Fecha de ingreso" value={formatDate(persona.fecha_ingreso)} />
        <Field label="Inicio de tarea específica" value={formatDate(persona.fecha_inicio_tarea_especifica)} />
        <Field label="Formación / estudio" value={persona.formacion_estudio} />
        <Field label="Matrícula" value={persona.matricula} />
        <Field label="Nivel de escolaridad" value={persona.nivel_escolaridad} />
        <Field label="Observaciones" value={persona.observacion} />
      </dl>

      <h3 className="mt-7 text-base font-semibold">Domicilio vigente</h3>
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Provincia" value={domicilio?.provincia_nombre} />
        <Field label="Ciudad / localidad" value={domicilio?.localidad_nombre} />
        <Field label="Calle" value={domicilio?.calle} />
        <Field label="Número" value={domicilio?.numero} />
        <Field label="Barrio" value={domicilio?.barrio} />
        <Field label="Manzana" value={domicilio?.manzana} />
        <Field label="Lote" value={domicilio?.lote} />
        <Field label="Monoblock" value={domicilio?.monoblock} />
        <Field label="Piso" value={domicilio?.piso} />
        <Field label="Departamento" value={domicilio?.departamento} />
        <Field label="Puntos de referencia" value={domicilio?.referencias} />
        <Field label="Otros datos" value={domicilio?.otros_datos} />
      </dl>

      <dl className="mt-7 grid gap-4 md:grid-cols-2">
        <Field label="Creado" value={formatDateTime(persona.created_at)} />
        <Field label="Actualizado" value={formatDateTime(persona.updated_at)} />
      </dl>
    </div>
  )
}