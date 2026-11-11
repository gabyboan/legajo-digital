import 'server-only'
import type { createClient } from '@/utils/supabase/server'
import { fechaValida, hastaLicencia } from './domain'
import { mensajeLicencia } from './server'

export async function prepararLicencia(supabase: Awaited<ReturnType<typeof createClient>>, formData: FormData, tipoAnterior?: number) {
  const fields = ['dni', 'tipo_id', 'desde', 'dias', 'dni_familiar', 'numero_orden', 'cantidad_ficha', 'observacion']
  const values: Record<string, string> = {}
  for (const name of fields) {
    const entries = formData.getAll(name)
    if (entries.length > 1 || entries.some((value) => typeof value !== 'string')) return { error: 'Los datos del formulario son inválidos.' }
    values[name] = String(entries[0] ?? '').trim()
  }
  const entero = (value: string, max: number) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= max
  if (!entero(values.dni, 99999999) || !entero(values.tipo_id, 32767) || !entero(values.dias, 36500) || !fechaValida(values.desde) || values.desde < '2026-01-01' || values.desde > '2200-12-31') return { error: 'Revisá el agente, el tipo de licencia, la fecha y la cantidad de días.' }
  if ((values.dni_familiar && !entero(values.dni_familiar, 99999999)) || (values.numero_orden && !entero(values.numero_orden, 2147483647)) || values.cantidad_ficha.length > 12 || values.observacion.length > 2000) return { error: 'Revisá el DNI del familiar, el número de orden y la extensión de las observaciones.' }
  const { data: tipo, error: tipoError } = await supabase.from('licencias_tipos_excel').select('id, codigo, habilitado_para_carga').eq('id', Number(values.tipo_id)).maybeSingle()
  if (tipoError) return { error: mensajeLicencia(tipoError) }
  // Un tipo histórico se puede conservar, pero no asignar a otra licencia.
  if ((!tipo || !tipo.habilitado_para_carga) && Number(values.tipo_id) !== tipoAnterior) return { error: 'Seleccioná un tipo de licencia habilitado. Los imprevistos se cargan desde Gestión.' }
  if (tipo && ['43', '98'].includes(tipo.codigo)) return { error: 'Los imprevistos se cargan desde Gestión.' }
  let hasta = hastaLicencia(values.desde, Number(values.dias))
  if (tipo?.codigo === '29') {
    if (Number(values.dias) > 5) return { error: 'Estudio admite de 1 a 5 días hábiles por solicitud.' }
    const result = await supabase.rpc('rpc_licencias_estudio_hasta', { p_desde: values.desde, p_dias: Number(values.dias) })
    if (result.error) return { error: mensajeLicencia(result.error) }
    hasta = typeof result.data === 'string' && fechaValida(result.data) ? result.data : null
  }
  if (!hasta) return { error: 'No se pudo calcular la fecha de finalización.' }
  return { args: {
    p_dni: Number(values.dni), p_tipo_id: Number(values.tipo_id), p_desde: values.desde, p_hasta: hasta,
    p_observacion: values.observacion || null, p_dni_familiar: values.dni_familiar ? Number(values.dni_familiar) : null,
    p_numero_orden: values.numero_orden ? Number(values.numero_orden) : null, p_cantidad_ficha: values.cantidad_ficha || null,
  } }
}
