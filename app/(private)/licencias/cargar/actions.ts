'use server'

import { revalidatePath } from 'next/cache'
import { fechaValida, type LicenciaFormState } from '@/lib/licencias/domain'
import { prepararLicencia } from '@/lib/licencias/guardar'
import { mensajeLicencia, permisosLicencias, sesionLicencias } from '@/lib/licencias/server'
import { SesionNoDisponibleError } from '@/lib/auth/session-server'

export async function calcularFechaEstudio(desde: string, dias: number) {
  if (!fechaValida(desde) || desde < '2026-01-01' || !Number.isInteger(dias) || dias < 1 || dias > 5) return { error: 'Estudio admite de 1 a 5 días hábiles por solicitud.' }
  let supabase
  try {
    supabase = await sesionLicencias('/licencias/cargar')
  } catch (error) {
    if (!(error instanceof SesionNoDisponibleError)) throw error
    return { error: error.message }
  }
  const permisos = await permisosLicencias(supabase)
  if (permisos.error || !permisos.leer || (!permisos.cargar && !permisos.administrar)) return { error: 'No tenés permiso para cargar o editar licencias.' }
  const { data, error } = await supabase.rpc('rpc_licencias_estudio_hasta', { p_desde: desde, p_dias: dias })
  if (error) return { error: mensajeLicencia(error) }
  if (typeof data !== 'string' || !fechaValida(data)) return { error: 'No se pudo calcular la fecha hasta.' }
  return { hasta: data }
}

export async function guardarLicencia(_previous: LicenciaFormState, formData: FormData): Promise<LicenciaFormState> {
  let supabase
  try {
    supabase = await sesionLicencias('/licencias/cargar')
  } catch (error) {
    if (!(error instanceof SesionNoDisponibleError)) throw error
    return { status: 'error', message: error.message }
  }
  const permisos = await permisosLicencias(supabase)
  if (permisos.error || !permisos.leer || !permisos.cargar) return { status: 'error', message: 'No se pudo autorizar la carga. Revisá tu sesión y tus permisos.' }
  const prepared = await prepararLicencia(supabase, formData)
  if (prepared.error || !prepared.args) return { status: 'error', message: prepared.error }
  const { error } = await supabase.rpc('rpc_licencias_guardar_con_datos', { p_id: null, ...prepared.args })
  if (error) return { status: 'error', message: mensajeLicencia(error) }
  revalidatePath('/licencias', 'layout')
  return { status: 'success', message: 'La licencia se guardó correctamente.' }
}
