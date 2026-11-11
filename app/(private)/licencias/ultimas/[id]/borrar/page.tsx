import Link from 'next/link'
import { permisosLicencias, sesionLicencias, ultimasLicencias } from '@/lib/licencias/server'
import { ModuleMessage } from '../../../components/module-message'
import { DatosCarga } from '../../listado'
import { BorrarLicenciaForm } from './borrar-form'

export default async function BorrarLicenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await sesionLicencias(`/licencias/ultimas/${id}/borrar`)
  const permisos = await permisosLicencias(supabase)
  if (permisos.error || !permisos.leer || !permisos.administrar) return <ModuleMessage>No se pudo autorizar el borrado. Revisá tu sesión y el permiso de administración de licencias.</ModuleMessage>
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return <ModuleMessage>La licencia indicada es inválida.</ModuleMessage>
  const result = await ultimasLicencias(supabase, { id: Number(id), estado: 'todas' })
  if (result.error) return <ModuleMessage error>No se pudo consultar la licencia. Volvé a intentarlo.</ModuleMessage>
  const registro = result.registros[0]
  if (!registro) return <ModuleMessage>No se encontró la licencia.</ModuleMessage>
  return <section className="space-y-6">
    <div><Link href="/licencias/ultimas" className="text-sm text-zinc-400 underline underline-offset-4">← Últimas cargas</Link><h1 className="mt-4 text-2xl font-bold">Borrar licencia #{registro.id}</h1><p className="mt-2 text-sm text-zinc-400">Revisá el agente y el período antes de confirmar.</p></div>
    <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-5"><DatosCarga registro={registro} /></div>
    <BorrarLicenciaForm registro={registro} />
  </section>
}
