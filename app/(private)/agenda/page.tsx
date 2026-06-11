import { createClient } from '@/utils/supabase/server'
import { canCurrentUserManageFeriados } from '../personas/permissions'
import { createFeriado, deleteFeriado, updateFeriado } from './actions'

type AgendaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type Feriado = {
  id: number
  fecha: string
  nombre: string
  observacion: string | null
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

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
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agenda de feriados</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sábados, domingos y las fechas cargadas aquí se consideran no
          laborables para el cálculo de francos.
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

      {canManage ? (
        <form
          action={createFeriado}
          className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:grid-cols-[180px_1fr_1fr_auto]"
        >
          <input name="fecha" type="date" required className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input name="nombre" required placeholder="Nombre del feriado" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <input name="observacion" placeholder="Observación opcional" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">
            Agregar
          </button>
        </form>
      ) : null}

      <div className="space-y-3">
        {feriados.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-500">
            No hay feriados cargados.
          </div>
        ) : feriados.map((feriado) => (
          <div key={feriado.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            {canManage ? (
              <form action={updateFeriado} className="grid gap-3 md:grid-cols-[180px_1fr_1fr_auto]">
                <input type="hidden" name="id" value={feriado.id} />
                <input name="fecha" type="date" required defaultValue={feriado.fecha} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                <input name="nombre" required defaultValue={feriado.nombre} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                <input name="observacion" defaultValue={feriado.observacion ?? ''} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
                <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">Guardar</button>
              </form>
            ) : (
              <>
                <p className="font-semibold">{feriado.nombre}</p>
                <p className="mt-1 text-sm capitalize text-zinc-400">
                  {dateFormatter.format(new Date(`${feriado.fecha}T00:00:00Z`))}
                </p>
                {feriado.observacion ? <p className="mt-2 text-sm text-zinc-500">{feriado.observacion}</p> : null}
              </>
            )}

            {canManage ? (
              <form action={deleteFeriado} className="mt-3">
                <input type="hidden" name="id" value={feriado.id} />
                <button className="text-xs text-red-300 underline underline-offset-4">Eliminar</button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
