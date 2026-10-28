import { formatDate, formatDateTime } from '../../format'
import type { DomicilioValores, PersonaEditable } from '@/lib/personas/types'
import { contactoDesdeRegistro } from '@/lib/personas/contacto'

type Persona = PersonaEditable & { created_at: string | null; updated_at: string | null }

type Props = {
  persona: Persona
  sexo: string
  domicilio: Partial<DomicilioValores> | null
  domicilioError?: string | null
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-zinc-200">{value ?? '-'}</dd>
    </div>
  )
}

export function DatosPersonalesCard({ persona, sexo, domicilio, domicilioError }: Props) {
  const contacto = contactoDesdeRegistro(persona)
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
      <h2 className="text-lg font-semibold">Ficha personal</h2>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="DNI" value={persona.dni} />
        <Field label="CUIL" value={persona.cuil} />
        <Field label="Apellido" value={persona.apellido} />
        <Field label="Nombre" value={persona.nombre} />
        <Field label="Sexo" value={sexo} />
        <Field label="Estado civil" value={persona.estado_civil} />
        <Field label="Fecha de nacimiento" value={formatDate(persona.fecha_nacimiento)} />
      </dl>

      <h3 className="mt-7 text-base font-semibold">Contacto</h3>
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Email" value={persona.email} />
        <Field label="Teléfono / celular" value={contacto.telefono || null} />
      </dl>
      {contacto.pendiente ? <div role="status" className="mt-4 space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p className="font-semibold">Contacto pendiente de revisión</p>
        <p>También figura el número {contacto.otroNumero}. Se conservan ambos hasta confirmar cuál debe quedar desde Editar persona.</p>
      </div> : null}

      <h3 className="mt-7 text-base font-semibold">Formación y antecedentes</h3>
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Formación / estudio" value={persona.formacion_estudio} />
        <Field label="Matrícula" value={persona.matricula} />
        <Field label="Nivel de escolaridad" value={persona.nivel_escolaridad} />
        <Field label="Estado de escolaridad" value={persona.estado_escolaridad} />
      </dl>

      <h3 className="mt-7 text-base font-semibold">Domicilio vigente</h3>
      {domicilioError ? <p role="alert" className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{domicilioError}</p> : !domicilio ? <p className="mt-4 text-sm text-zinc-400">No hay un domicilio vigente visible para esta cuenta. Revisá el historial y los permisos antes de volver a cargarlo.</p> : null}
      {!domicilioError && domicilio ? (
      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Provincia" value={domicilio?.provincia_nombre} />
        <Field label="Ciudad / localidad" value={domicilio?.localidad_nombre} />
        <Field label="Calle" value={domicilio?.calle} />
        <Field label="Número" value={domicilio?.numero} />
        <Field label="Barrio" value={domicilio?.barrio} />
        <Field label="Manzana" value={domicilio?.manzana} />
        <Field label="Lote" value={domicilio?.lote} />
        <Field label="Casa" value={domicilio?.casa} />
        <Field label="Torre" value={domicilio?.torre} />
        <Field label="Monoblock" value={domicilio?.monoblock} />
        <Field label="Piso" value={domicilio?.piso} />
        <Field label="Departamento" value={domicilio?.departamento} />
        <Field label="Puntos de referencia" value={domicilio?.referencias} />
        <Field label="Otros datos" value={domicilio?.otros_datos} />
      </dl>
      ) : null}

      <h3 className="mt-7 text-base font-semibold">Observaciones</h3>
      <dl className="mt-4"><Field label="Observaciones del legajo" value={persona.observacion} /></dl>

      <dl className="mt-7 grid gap-4 md:grid-cols-2">
        <Field label="Creado" value={formatDateTime(persona.created_at)} />
        <Field label="Actualizado" value={formatDateTime(persona.updated_at)} />
      </dl>
    </div>
  )
}
