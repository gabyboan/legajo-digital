import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from '../../permissions'
import { ListadoFamiliares } from './listado'

export default async function ValidacionFamiliaresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient()
  if (!(await canCurrentUserEditLegajo(supabase))) return <p>No tenés permiso para validar familiares.</p>
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim().replace(/[,%()]/g, '') : ''
  const page = Math.max(1, Number(params.page) || 1)
  let query = supabase.from('persona_familiares').select('id, persona_dni, dni, apellido, nombre, dni_validado_at').order('apellido').order('nombre').order('id').range((page - 1) * 100, page * 100 - 1)
  if (q) query = /^\d+$/.test(q) ? query.or(`dni.eq.${q},persona_dni.eq.${q}`) : query.or(`apellido.ilike.%${q}%,nombre.ilike.%${q}%`)
  const { data, error } = await query
  return <section className="space-y-5">
    <h1 className="text-2xl font-bold">Validación de DNI de familiares</h1>
    <p className="text-zinc-400">Revisá el nombre obtenido antes de validar. Se muestran únicamente familiares cargados; los que no tienen DNI quedan deshabilitados.</p>
    <form className="flex gap-3"><input name="q" defaultValue={q} placeholder="Apellido, nombre, DNI del familiar o titular" className="rounded bg-zinc-900 border border-zinc-700 p-3 w-full" /><button className="rounded border px-4">Buscar</button></form>
    {error ? <p role="alert" className="text-red-300">No se pudieron cargar las validaciones de familiares.</p> : <ListadoFamiliares key={`${q}:${page}`} familiares={data ?? []} />}
    <nav className="flex justify-between">{page > 1 && <Link href={`?${new URLSearchParams({ q, page: String(page - 1) })}`}>Anterior</Link>}{data?.length === 100 && <Link href={`?${new URLSearchParams({ q, page: String(page + 1) })}`}>Siguiente</Link>}</nav>
  </section>
}
