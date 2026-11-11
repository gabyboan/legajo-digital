'use server'

import { revalidatePath } from 'next/cache'
import type { LicenciaFormState } from '@/lib/licencias/domain'
import { prepararLicencia } from '@/lib/licencias/guardar'
import { mensajeLicencia, permisosLicencias, sesionLicencias, ultimasLicencias } from '@/lib/licencias/server'
import { SesionNoDisponibleError } from '@/lib/auth/session-server'

function datoUnico(form: FormData, name: string) {
  const entries = form.getAll(name)
  return entries.length === 1 && typeof entries[0] === 'string' ? entries[0].trim() : null
}

async function autorizarCorreccion(form: FormData) {
  const supabase = await sesionLicencias('/licencias/ultimas')
  const permisos = await permisosLicencias(supabase)
  if (permisos.error || !permisos.leer || !permisos.administrar) return { error: 'No tenés permiso para editar o borrar licencias.' }
  const id = datoUnico(form, 'id')
  const version = datoUnico(form, 'version')
  if (!id || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1 || !version || !/^[a-f0-9]{32}$/.test(version)) return { error: 'La licencia o su versión son inválidas. Volvé al listado.' }
  const result = await ultimasLicencias(supabase, { id: Number(id), estado: 'todas' })
  if (result.error) return { error: mensajeLicencia(result.error, '/licencias/ultimas') }
  const registro = result.registros[0]
  if (!registro || registro.anulado_at) return { error: 'La licencia no existe o ya fue borrada. Volvé al listado.' }
  if (registro.version !== version) return { error: mensajeLicencia({ code: '40001' }) }
  return { supabase, registro, version }
}

export async function editarLicencia(_previous: LicenciaFormState, form: FormData): Promise<LicenciaFormState> {
  try {
    const context = await autorizarCorreccion(form)
    if (context.error || !context.registro || !context.supabase) return { status: 'error', message: context.error }
    const prepared = await prepararLicencia(context.supabase, form, context.registro.tipo_id)
    if (prepared.error || !prepared.args) return { status: 'error', message: prepared.error }
    if (prepared.args.p_dni !== context.registro.dni) return { status: 'error', message: 'No se puede cambiar el agente de una licencia.' }
    const { data, error } = await context.supabase.rpc('rpc_licencias_editar_versionada', {
      p_id: context.registro.id, p_version: context.version, p_datos: prepared.args,
    })
    if (error) return { status: 'error', message: mensajeLicencia(error, '/licencias/ultimas') }
    if (data !== context.registro.id) return { status: 'error', message: 'No se pudo confirmar la edición. Revisá el listado antes de reintentar.' }
    revalidatePath('/licencias', 'layout')
    return { status: 'success', message: 'Los cambios de la licencia se guardaron correctamente.' }
  } catch (error) {
    if (!(error instanceof SesionNoDisponibleError)) throw error
    return { status: 'error', message: error.message }
  }
}

export async function borrarLicencia(_previous: LicenciaFormState, form: FormData): Promise<LicenciaFormState> {
  try {
    const context = await autorizarCorreccion(form)
    if (context.error || !context.registro || !context.supabase) return { status: 'error', message: context.error }
    const motivo = datoUnico(form, 'motivo')
    if (!motivo || motivo.length < 3 || motivo.length > 500 || datoUnico(form, 'confirmar') !== 'si') return { status: 'error', message: 'Ingresá el motivo y confirmá el borrado de esta licencia.' }
    const { data, error } = await context.supabase.rpc('rpc_licencias_borrar_versionada', {
      p_id: context.registro.id, p_version: context.version, p_motivo: motivo,
    })
    if (error) return { status: 'error', message: mensajeLicencia(error, '/licencias/ultimas') }
    if (data !== context.registro.id) return { status: 'error', message: 'No se pudo confirmar el borrado. Revisá el listado antes de reintentar.' }
    revalidatePath('/licencias', 'layout')
    return { status: 'success', message: 'La licencia fue borrada y ya no se cuenta en la ficha del agente.' }
  } catch (error) {
    if (!(error instanceof SesionNoDisponibleError)) throw error
    return { status: 'error', message: error.message }
  }
}
