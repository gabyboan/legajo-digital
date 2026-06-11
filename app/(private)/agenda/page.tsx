import { createClient } from '@/utils/supabase/server'
import { canCurrentUserManageFeriados } from '../personas/permissions'
import { AgendaCalendar, type Feriado } from './agenda-calendar'

type AgendaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const supabase = await createClient()
  const [feriadosRes, canManage] = await Promise.all([
    supabase
      .from('feriados')
      .select('id, fecha, nombre, observacion')
      .order('fecha', { ascending: true }),
    canCurrentUserManageFeriados(supabase),
  ])

  const params = (await searchParams) ?? {}
  const rawError = params.error
  const error = Array.isArray(rawError) ? rawError[0] : rawError
  const feriados = (feriadosRes.data ?? []) as Feriado[]

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agenda de feriados</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Selecciona una fecha del calendario para consultar o cargar un
          feriado. Sábados y domingos se consideran no laborables.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {feriadosRes.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Error al cargar feriados: {feriadosRes.error.message}
        </div>
      ) : null}

      <AgendaCalendar feriados={feriados} canManage={canManage} />
    </section>
  )
}
