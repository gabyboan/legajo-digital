import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from './permissions'
import { consultarPersonas } from '@/lib/personas/listado-server'
import { PersonasPanel } from './personas-panel'
import { carreraVisible } from '@/lib/carreras'
import { enlaceMfa } from '@/lib/auth/mfa'

type PersonasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseEstado(value: string | undefined) {
  return value === 'activos' || value === 'inactivos' ? value : 'todos'
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
  const supabase = await createClient()
  const params = (await searchParams) ?? {}

  const rawQ = params.q
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? '').trim().slice(0, 150)
  const carreraId = firstParam(params.carrera) ?? ''
  const estado = parseEstado(firstParam(params.estado))
  const rawError = params.error
  const pageError = Array.isArray(rawError) ? rawError[0] : rawError

  const [listado, { data: carreras, error: carrerasError }, canEdit] = await Promise.all([
    consultarPersonas(supabase),
    supabase.from('carreras').select('id, nombre').order('nombre'),
    canCurrentUserEditLegajo(supabase),
  ])
  const error = listado.error ?? carrerasError

  if (error) {
    const requiresMfa = /autenticadora|\baal2\b|\bmfa\b/i.test(error.message)
    return (
      <div role="alert" className="space-y-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        <p>{requiresMfa ? 'Verificá el código de tu aplicación autenticadora para continuar.' : 'No se pudieron cargar las personas. Volvé a intentarlo; si persiste, contactá al administrador.'}</p>
        <Link href={requiresMfa ? enlaceMfa('/personas') : '/personas'} className="inline-flex min-h-11 items-center rounded-lg border border-red-400/50 px-4 py-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300">
          {requiresMfa ? 'Verificar mi código' : 'Volver a intentar'}
        </Link>
      </div>
    )
  }

  const carrerasVisibles = (carreras ?? []).filter((carrera) => carreraVisible(carrera.nombre))

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personas</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Base del legajo digital. Buscá y abrí la ficha de cada agente.
          </p>
        </div>

        {canEdit ? (
          <Link
            href="/personas/nuevo"
            className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Nueva persona
          </Link>
        ) : (
          <span
            title="No tenés permisos para editar personas"
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-500"
          >
            Nueva persona
          </span>
        )}
      </div>

      {pageError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {pageError}
        </div>
      ) : null}

      <PersonasPanel personas={listado.personas} carreras={carrerasVisibles} q={q} carrera={carreraId} estado={estado} />
    </section>
  )
}
