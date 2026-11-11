import Link from 'next/link'
import { personaParaSelector, primerParametro } from '@/lib/licencias/domain'
import { permisosLicencias, personasLicencias, sesionLicencias } from '@/lib/licencias/server'
import { ModuleMessage } from '../components/module-message'
import { PersonasSelector } from '../components/personas-selector'

export default async function FichasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = (primerParametro(params.q) ?? '').trim().slice(0, 150)
  const supabase = await sesionLicencias(`/licencias/fichas?${new URLSearchParams({ q })}`)
  const permisos = await permisosLicencias(supabase)
  if (permisos.error) return <ModuleMessage error>No se pudieron comprobar los permisos de fichas. Volvé a intentarlo.</ModuleMessage>
  if (!permisos.ficha) return <ModuleMessage>No tenés permiso para consultar fichas. Consultá al administrador.</ModuleMessage>
  const { personas, error } = await personasLicencias(supabase, q, true)
  if (error) return <ModuleMessage error>No se pudieron consultar las fichas. Volvé a intentarlo.</ModuleMessage>
  return (
    <section className="space-y-6">
      <div><Link href="/licencias" className="text-sm text-zinc-400 underline underline-offset-4">← Licencias</Link><h1 className="mt-4 text-2xl font-bold">Ver fichas</h1><p className="mt-1 text-sm text-zinc-400">Consultá los datos del agente y su historial de licencias por año.</p></div>
      <PersonasSelector personas={personas.map(personaParaSelector)} q={q} ficha />
    </section>
  )
}
