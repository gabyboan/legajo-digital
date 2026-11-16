import Link from 'next/link'
import { anioConsulta, fechaActual, primerParametro, type LicenciaTipo } from '@/lib/licencias/domain'
import { historialLicencias, permisosLicencias, personasLicencias, sesionLicencias } from '@/lib/licencias/server'
import { ModuleMessage } from '../../../components/module-message'
import { LicenciaForm } from '../../../cargar/licencia-form'

export default async function AgregarFilaPage({ params, searchParams }: {
  params: Promise<{ dni: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { dni } = await params
  const query = await searchParams
  const anio = anioConsulta(primerParametro(query.anio))
  const lado = primerParametro(query.lado) === 'arriba' ? 'arriba' : 'abajo'
  const referencia = primerParametro(query.referencia)
  const volverAFicha = `/licencias/fichas/${dni}?anio=${anio}&vista=ficha`
  const supabase = await sesionLicencias(volverAFicha)
  const permisos = await permisosLicencias(supabase)
  if (permisos.error || !permisos.ficha || !permisos.cargar) return <ModuleMessage>No tenés permiso para añadir filas de licencias.</ModuleMessage>
  if (!/^\d{1,8}$/.test(dni) || Number(dni) < 1 || (referencia !== undefined && (!/^-?\d+$/.test(referencia) || !Number.isSafeInteger(Number(referencia)) || Number(referencia) === 0))) return <ModuleMessage>La persona o la fila de referencia son inválidas.</ModuleMessage>
  const result = await personasLicencias(supabase, dni, true)
  if (result.error) return <ModuleMessage error>No se pudo consultar el agente.</ModuleMessage>
  const persona = result.personas.find((item) => String(item.dni) === dni)
  if (!persona) return <ModuleMessage>No se encontró la ficha del agente.</ModuleMessage>
  const historial = await historialLicencias(supabase, anio, persona.dni)
  if (historial.error) return <ModuleMessage error>No se pudo consultar la planilla.</ModuleMessage>
  const fila = historial.registros.find((item) => String(item.id) === referencia && !item.anulado_at)
  if (referencia !== undefined && !fila) return <ModuleMessage>La fila de referencia cambió. Actualizá la planilla.</ModuleMessage>
  const catalogo = await supabase.from('licencias_tipos_excel').select('id,nombre,codigo,columna_ficha,descripcion,habilitado_para_carga').eq('habilitado_para_carga', true).order('categoria_excel_id').order('codigo')
  if (catalogo.error) return <ModuleMessage error>No se pudo consultar el catálogo de licencias.</ModuleMessage>
  const tipos = ((catalogo.data ?? []) as LicenciaTipo[]).filter((tipo) => !['43', '98'].includes(tipo.codigo ?? ''))
  return <section className="space-y-6">
    <div><Link href={volverAFicha} className="text-sm text-zinc-400 underline underline-offset-4">← Volver a la planilla</Link><h1 className="mt-4 text-2xl font-bold">Añadir fila {fila ? lado : 'a la planilla'}</h1><p className="mt-2 text-sm text-zinc-400">{persona.apellido_nombre} · Año {anio}. {fila ? `Se insertará ${lado} de ${fila.tipo.nombre}, del ${fila.desde.split('-').reverse().join('/')}.` : 'Se agregará al final de las licencias registradas.'} Completá la licencia para guardar la fila.</p></div>
    <LicenciaForm persona={persona} tipos={tipos} hoy={fila?.desde ?? (fechaActual().startsWith(String(anio)) ? fechaActual() : `${anio}-01-01`)} puedeVerFicha={true} volverAFicha={volverAFicha} insercion={{ anio, referenciaId: fila?.id ?? null, lado }} />
  </section>
}
