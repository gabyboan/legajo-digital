import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  canCurrentUserEditLegajo,
  canCurrentUserWriteFrancos,
} from '../permissions'
import { NuevaPersonaForm } from './nueva-persona-form'

type NuevaPersonaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function NuevaPersonaPage({
  searchParams,
}: NuevaPersonaPageProps) {
  const params = (await searchParams) ?? {}
  const rawError = params.error
  const error = Array.isArray(rawError) ? rawError[0] : rawError

  const supabase = await createClient()
  const canEdit = await canCurrentUserEditLegajo(supabase)

  if (!canEdit) {
    redirect(
      `/personas?error=${encodeURIComponent(
        'No tenés permisos para editar personas'
      )}`
    )
  }

  const [situacionesRes, carrerasRes, canWriteFrancos] = await Promise.all([
    supabase
      .from('situacion_revista')
      .select('id, nombre')
      .order('nombre', { ascending: true }),

    supabase
      .from('carreras')
      .select('id, nombre')
      .order('id', { ascending: true }),

    canCurrentUserWriteFrancos(supabase),
  ])

  const situaciones = situacionesRes.data ?? []
  const carreras = carrerasRes.data ?? []

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/personas"
          className="text-sm text-zinc-400 underline underline-offset-4"
        >
          ← Volver a personas
        </Link>

        <h1 className="mt-3 text-2xl font-bold">Nueva persona</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Cargá la ficha base del agente y, si corresponde, su asistencia.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {situacionesRes.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error al cargar Situación de Revista: {situacionesRes.error.message}
        </div>
      ) : null}

      {carrerasRes.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error al cargar Carreras: {carrerasRes.error.message}
        </div>
      ) : null}

      <NuevaPersonaForm
        situaciones={situaciones}
        carreras={carreras}
        canEditAsistencia={canWriteFrancos}
      />
    </section>
  )
}
