import Link from 'next/link'
import { fechaActual, type LicenciaTipo } from '@/lib/licencias/domain'
import { permisosLicencias, sesionLicencias, ultimasLicencias } from '@/lib/licencias/server'
import { ModuleMessage } from '../../../components/module-message'
import { LicenciaForm } from '../../../cargar/licencia-form'
import { DatosCarga } from '../../listado'

export default async function EditarLicenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await sesionLicencias(`/licencias/ultimas/${id}/editar`)
  const permisos = await permisosLicencias(supabase)
  if (permisos.error || !permisos.leer || !permisos.administrar) return <ModuleMessage>No se pudo autorizar la edición. Revisá tu sesión y el permiso de administración de licencias.</ModuleMessage>
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return <ModuleMessage>La licencia indicada es inválida.</ModuleMessage>
  const result = await ultimasLicencias(supabase, { id: Number(id), estado: 'todas' })
  if (result.error) return <ModuleMessage error>No se pudo consultar la licencia. Volvé a intentarlo.</ModuleMessage>
  const registro = result.registros[0]
  if (!registro || registro.anulado_at) return <ModuleMessage>La licencia no existe o ya fue borrada.</ModuleMessage>
  const catalogo = await supabase.from('licencias_tipos_excel').select('id, nombre, codigo, columna_ficha, descripcion, habilitado_para_carga').eq('habilitado_para_carga', true).order('categoria_excel_id').order('codigo')
  if (catalogo.error) return <ModuleMessage error>No se pudo consultar el catálogo de licencias.</ModuleMessage>
  const tipos = ((catalogo.data ?? []) as LicenciaTipo[]).filter((tipo) => !['43', '98'].includes(tipo.codigo ?? ''))
  if (!tipos.some((tipo) => tipo.id === registro.tipo_id)) tipos.unshift({ id: registro.tipo_id, nombre: registro.tipo.nombre, codigo: registro.tipo.codigo, columna_ficha: registro.tipo.columna_ficha ?? null, descripcion: 'Tipo histórico de esta licencia. Podés conservarlo o elegir uno habilitado.', habilitado_para_carga: false })
  return <section className="space-y-6">
    <div><Link href="/licencias/ultimas" className="text-sm text-zinc-400 underline underline-offset-4">← Últimas cargas</Link><h1 className="mt-4 text-2xl font-bold">Editar licencia #{registro.id}</h1><p className="mt-2 text-sm text-zinc-400">Corregí los datos de esta licencia. La autoría y la fecha de carga original se conservan.</p></div>
    <div className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-5"><DatosCarga registro={registro} /></div>
    <LicenciaForm key={registro.id} persona={{ dni: registro.dni, apellido_nombre: registro.apellido_nombre, legajo: null, carrera: '', funcion: '', situacion_revista: '', activo: true }} tipos={tipos} hoy={fechaActual()} puedeVerFicha={permisos.ficha} registro={registro} />
  </section>
}
