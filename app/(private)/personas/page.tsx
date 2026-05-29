import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from './permissions'

type PersonasPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
  const supabase = await createClient()
  const params = (await searchParams) ?? {}

  const rawQ = params.q
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ ?? '').trim()
  const rawError = params.error
  const pageError = Array.isArray(rawError) ? rawError[0] : rawError

  let query = supabase
    .from('personas')
    .select(
      'dni, apellido, nombre, email, telefono, fecha_nacimiento, created_at'
    )
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true })
    .limit(200)

  if (q) {
    if (/^\d+$/.test(q)) {
      query = query.eq('dni', Number(q))
    } else {
      query = query.or(`apellido.ilike.%${q}%,nombre.ilike.%${q}%`)
    }
  }

  const [{ data: personas, error }, { data: inactivos }, canEdit] =
    await Promise.all([
      query,
      supabase.from('persona_inactivo').select('dni'),
      canCurrentUserEditLegajo(supabase),
    ])

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
        Error al cargar personas: {error.message}
      </div>
    )
  }

  const inactivosSet = new Set((inactivos ?? []).map((x) => String(x.dni)))

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

      <form className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por apellido, nombre o DNI"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
          />
          <button
            type="submit"
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm transition hover:bg-zinc-800"
          >
            Buscar
          </button>
        </div>
      </form>

      {pageError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {pageError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-950/60 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">DNI</th>
              <th className="px-4 py-3 text-left font-medium">Apellido</th>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
              <th className="px-4 py-3 text-left font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {(personas ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  No se encontraron personas.
                </td>
              </tr>
            ) : (
              personas!.map((persona) => {
                const activo = !inactivosSet.has(String(persona.dni))

                return (
                  <tr key={persona.dni} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3">{persona.dni}</td>
                    <td className="px-4 py-3">{persona.apellido}</td>
                    <td className="px-4 py-3">{persona.nombre}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          activo
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/personas/${persona.dni}`}
                        className="text-zinc-200 underline underline-offset-4 hover:text-white"
                      >
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
