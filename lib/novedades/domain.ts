import { fechaActual, fechaValida } from '@/lib/licencias/domain'

export const origenes = ['franco', 'hora', 'medico', 'licencia', 'imprevisto'] as const
export type Origen = typeof origenes[number]
export const estados = ['pendiente', 'confirmada', 'observada', 'recarga_verificada', 'anulada'] as const
export type Estado = typeof estados[number]
export const origenTexto: Record<Origen, string> = { franco: 'Francos', hora: 'Horas', medico: 'Médicos', licencia: 'Licencias', imprevisto: 'Imprevistos' }
export const estadoTexto: Record<Estado, string> = { pendiente: 'Pendiente de confirmación', confirmada: 'Confirmada', observada: 'Observada', recarga_verificada: 'Recarga verificada', anulada: 'Anulada en origen' }
export type Feriado = { fecha: string; nombre: string }
export type Coincidencia = Pick<Novedad, 'origen' | 'id' | 'desde' | 'hasta' | 'tipo' | 'minutos' | 'cantidad' | 'unidad' | 'version'>
export type Control = { id: number; estado: 'confirmada' | 'observada'; usuario: string | null; fecha: string; observacion: string | null; licencia_id: number | null; version: string }
export type Novedad = {
  origen: Origen; id: number; dni: number; persona: string; legajo: number | null; carrera_id: number | null
  desde: string; hasta: string; minutos: number | null; cantidad: number | null; unidad: string; tipo: string
  usuario_carga: string | null; cargado_por: string | null; cargado_at: string | null
  version: string; control_id: number; calendario_version: string; estado: Estado
  anulada: boolean; recarga: boolean; puede_confirmar: boolean; carga_propia: boolean | null
  control_desactualizado: boolean; confirmado_por: string | null; controlado_at: string | null; observacion: string | null
  licencia_id: number | null; feriados: Feriado[]
  documento: { devolucion_registrada?: boolean; codigo?: string; dias_aprobados?: number; documentacion_pendiente?: boolean; cantidad_ficha?: string; numero_orden?: number }
  coincidencias?: Coincidencia[]; historial?: Control[]
}
export type ControlState = { status: 'idle' | 'success' | 'error'; message?: string }

export function cantidadVisible(n: Pick<Novedad, 'minutos' | 'cantidad' | 'unidad'>) {
  if (n.minutos !== null) return `${Math.floor(n.minutos / 60)} h ${String(n.minutos % 60).padStart(2, '0')} min`
  return n.cantidad === null ? 'Sin duración registrada' : `${n.cantidad} ${n.unidad}`
}
export function filtrosNovedades(params: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value
  const today = fechaActual()
  const inicio = `${today.slice(0, 7)}-01`
  const desde = first(params.desde) ?? inicio
  const hasta = first(params.hasta) ?? today
  const valid = fechaValida(desde) && fechaValida(hasta) && desde >= '2026-01-01' && hasta >= desde &&
    (Date.parse(hasta) - Date.parse(desde)) / 86400000 <= 366
  const rawPage = first(params.pagina) ?? '1'
  const pagina = /^\d+$/.test(rawPage) && Number(rawPage) >= 1 && Number(rawPage) <= 4001 ? Number(rawPage) : 1
  const origen = first(params.origen) ?? ''
  const estado = first(params.estado) ?? 'pendiente'
  return { desde, hasta, valid, pagina, q: (first(params.q) ?? '').trim().slice(0, 150),
    origen: origenes.includes(origen as Origen) ? origen : '', estado: estados.includes(estado as Estado) || estado === 'todas' ? estado : 'pendiente' }
}

export function datosControl(form: FormData) {
  const keys = ['origen', 'id', 'version', 'control_id', 'calendario_version', 'estado', 'observacion', 'operacion', 'licencia', 'corroborado', 'advertencias']
  const values: Record<string, string> = {}
  for (const key of keys) {
    const all = form.getAll(key)
    if (all.length > 1 || all.some((value) => typeof value !== 'string')) return null
    values[key] = String(all[0] ?? '').trim()
  }
  const positive = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
  if (!origenes.includes(values.origen as Origen) || !positive(values.id) || !/^\d+$/.test(values.control_id) || !Number.isSafeInteger(Number(values.control_id)) ||
    !/^[a-f0-9]{32}$/.test(values.version) || !/^[a-f0-9]{32}$/.test(values.calendario_version) ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(values.operacion) ||
    !['confirmada', 'observada'].includes(values.estado) || values.observacion.length > 500 ||
    (values.estado === 'observada' && values.observacion.length < 3) || values.corroborado !== 'si' || values.advertencias !== 'si') return null
  const link = values.licencia ? values.licencia.split(':') : []
  if (link.length && (values.origen !== 'medico' || link.length !== 2 || !positive(link[0]) || !/^[a-f0-9]{32}$/.test(link[1]))) return null
  return { p_origen: values.origen, p_id: Number(values.id), p_version: values.version, p_control_id: Number(values.control_id),
    p_calendario_version: values.calendario_version, p_estado: values.estado, p_observacion: values.observacion || null,
    p_operacion: values.operacion, p_licencia_id: link.length ? Number(link[0]) : null, p_licencia_version: link[1] ?? null }
}
