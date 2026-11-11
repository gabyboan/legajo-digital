import Link from 'next/link'
import { primerParametro } from '@/lib/licencias/domain'
import { permisosLicencias, sesionLicencias, ultimasLicencias } from '@/lib/licencias/server'
import { ModuleMessage } from '../components/module-message'
import { UltimasLicenciasListado } from './listado'

export default async function UltimasLicenciasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = (primerParametro(params.q) ?? '').trim().slice(0, 150)
  const requested = primerParametro(params.estado) ?? 'vigentes'
  const estado = ['vigentes', 'borradas', 'todas'].includes(requested) ? requested : 'vigentes'
  const page = primerParametro(params.pagina) ?? '1'
  const pagina = /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= 4001 ? Number(page) : 1
  const supabase = await sesionLicencias('/licencias/ultimas')
  const permisos = await permisosLicencias(supabase)
  if (permisos.error) return <ModuleMessage error>No se pudieron comprobar los permisos. Volvé a intentarlo.</ModuleMessage>
  if (!permisos.leer) return <ModuleMessage>No tenés permiso para consultar las cargas de licencias.</ModuleMessage>
  const result = await ultimasLicencias(supabase, { q, estado, offset: (pagina - 1) * 25 })
  if (result.error) return <ModuleMessage error>No se pudieron consultar las últimas cargas. Volvé a intentarlo.</ModuleMessage>
  return <section className="space-y-6">
    <div><Link href="/licencias" className="text-sm text-zinc-400 underline underline-offset-4">← Licencias</Link><h1 className="mt-4 text-2xl font-bold">Últimas licencias cargadas</h1><p className="mt-2 text-sm leading-6 text-zinc-400">Revisá quién cargó cada licencia y cuándo. Desde acá podés corregir una carga o borrarla de la ficha.</p></div>
    <UltimasLicenciasListado registros={result.registros.slice(0, 25)} q={q} estado={estado} pagina={pagina} hayMas={result.registros.length > 25} puedeAdministrar={permisos.administrar} puedeVerFicha={permisos.ficha} />
    <p className="text-xs leading-5 text-zinc-500">Los registros anteriores que no tienen autor se muestran sin usuario registrado. Los imprevistos se administran desde Gestión.</p>
  </section>
}
