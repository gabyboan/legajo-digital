import { formatDate } from '../../format'

type Props = {
  legajo: number | null; carrera: string; situacion: string; inactivo: boolean
  reloj: number | null; indice: string | null
  fechaIngreso: string | null; inicioTareaEspecifica: string | null
}

function Field({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt><dd className="mt-1 text-sm text-zinc-200">{value}</dd></div>
}

export function DatosLaboralesCard({ legajo, carrera, situacion, inactivo, reloj, indice, fechaIngreso, inicioTareaEspecifica }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Datos laborales</h2>
      <dl className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Legajo" value={legajo ?? '-'} />
        <Field label="Número de reloj" value={reloj ?? '-'} />
        <Field label="Índice" value={indice ?? '-'} />
        <Field label="Carrera" value={carrera} />
        <Field label="Situación de revista" value={situacion} />
        <Field label="Estado" value={inactivo ? 'Inactivo' : 'Activo'} />
        <Field label="Fecha de ingreso" value={formatDate(fechaIngreso)} />
        <Field label="Inicio de tarea específica" value={formatDate(inicioTareaEspecifica)} />
      </dl>
    </div>
  )
}
