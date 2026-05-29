import Link from 'next/link'
import { DisabledNavButton } from './disabled-nav-button'

type PersonaHeaderProps = {
  dni: number
  apellido: string
  nombre: string
  legajo: number | null
  carrera: string
  canEdit: boolean
}

export function PersonaHeader({
  dni,
  apellido,
  nombre,
  legajo,
  carrera,
  canEdit,
}: PersonaHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <Link
          href="/personas"
          className="text-sm text-zinc-400 underline underline-offset-4"
        >
          ← Volver a personas
        </Link>

        <h1 className="mt-3 text-2xl font-bold">
          {apellido}, {nombre}
        </h1>

        <div className="mt-1 space-y-1 text-sm text-zinc-400">
          <p>DNI: {dni}</p>
          <p>Legajo: {legajo ?? '-'}</p>
          <p>Carrera: {carrera}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <Link
            href={`/personas/${dni}/editar`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
          >
            Editar
          </Link>
        ) : (
          <DisabledNavButton>Editar</DisabledNavButton>
        )}

        {canEdit ? (
          <Link
            href={`/personas/${dni}/servicios`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
          >
            Servicios
          </Link>
        ) : (
          <DisabledNavButton title="No tenes permisos para modificar servicios">
            Servicios
          </DisabledNavButton>
        )}

        {canEdit ? (
          <Link
            href={`/personas/${dni}/funciones`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
          >
            Funciones
          </Link>
        ) : (
          <DisabledNavButton title="No tenes permisos para modificar funciones">
            Funciones
          </DisabledNavButton>
        )}

        {canEdit ? (
          <Link
            href={`/personas/${dni}/carreras`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
          >
            Carreras
          </Link>
        ) : (
          <DisabledNavButton title="No tenes permisos para modificar carreras">
            Carreras
          </DisabledNavButton>
        )}

        {canEdit ? (
          <Link
            href={`/personas/${dni}/cargos`}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm transition hover:bg-zinc-800"
          >
            Cargos
          </Link>
        ) : (
          <DisabledNavButton title="No tenes permisos para modificar cargos">
            Cargos
          </DisabledNavButton>
        )}
      </div>
    </div>
  )
}
