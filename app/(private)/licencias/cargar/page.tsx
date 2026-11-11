import Link from 'next/link'
import { fechaActual, personaParaSelector, primerParametro, type LicenciaTipo } from '@/lib/licencias/domain'
import { permisosLicencias, personasLicencias, sesionLicencias } from '@/lib/licencias/server'
import { ModuleMessage } from '../components/module-message'
import { CargarLicenciasPanel } from './cargar-licencias-panel'

export default async function CargarLicenciasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = (primerParametro(params.q) ?? '').trim().slice(0, 150)
  const dni = primerParametro(params.dni) ?? ''
  const supabase = await sesionLicencias(`/licencias/cargar?${new URLSearchParams({ q, dni })}`)
  const permisos = await permisosLicencias(supabase)
  if (permisos.error) return <ModuleMessage error>No se pudieron comprobar los permisos de licencias. Volvé a intentarlo.</ModuleMessage>
  if (!permisos.leer || !permisos.cargar) return <ModuleMessage>No tenés permiso para cargar licencias. Consultá al administrador.</ModuleMessage>
  const [{ personas, error }, catalogo] = await Promise.all([
    personasLicencias(supabase, q),
    supabase.from('licencias_tipos_excel').select('id, nombre, codigo, columna_ficha, descripcion, habilitado_para_carga').eq('habilitado_para_carga', true).order('categoria_excel_id').order('codigo'),
  ])
  if (error) return <ModuleMessage error>No se pudieron consultar los agentes. Volvé a intentarlo.</ModuleMessage>
  if (catalogo.error) return <ModuleMessage error>No se pudo cargar el catálogo de licencias. Volvé a intentarlo.</ModuleMessage>
  let persona = dni ? personas.find((item) => String(item.dni) === dni) ?? null : null
  if (!persona && /^\d{1,8}$/.test(dni)) {
    const seleccionado = await personasLicencias(supabase, dni)
    if (seleccionado.error) return <ModuleMessage error>No se pudo consultar el agente seleccionado. Volvé a intentarlo.</ModuleMessage>
    persona = seleccionado.personas.find((item) => String(item.dni) === dni) ?? null
  }
  const tipos = ((catalogo.data ?? []) as LicenciaTipo[]).filter((tipo) => tipo.codigo !== '43' && tipo.codigo !== '98')
  return (
    <section className="space-y-6">
      <div><Link href="/licencias" className="text-sm text-zinc-400 underline underline-offset-4">← Licencias</Link><h1 className="mt-4 text-2xl font-bold">Cargar licencias</h1><p className="mt-1 text-sm text-zinc-400">Buscá un agente para cargar licencias o consultar su ficha.</p></div>
      {dni && !persona ? <p role="alert" className="text-sm text-amber-200">No se encontró el agente seleccionado. Buscalo nuevamente.</p> : null}
      <CargarLicenciasPanel initialPersona={persona ? personaParaSelector(persona) : null} personas={personas.map(personaParaSelector)} q={q} tipos={tipos} hoy={fechaActual()} puedeVerFicha={permisos.ficha} />
    </section>
  )
}
