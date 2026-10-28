import { dniDesdeRegistro } from '@/lib/dni'
import { canCurrentUserEditLegajo } from '@/app/(private)/personas/permissions'
import { comprobarDniParaUsuario, obtenerComprobacionPendiente, consumirComprobacionPendiente } from '@/lib/dni-comprobaciones'
import { ConsultaCuitOnlineError } from '@/lib/cuitonline'
import { consultarNombreFamiliar, ConsultaNombreFamiliarError } from '@/lib/consulta-nombre-familiar'
import { dniDelPayload, esOrigenPermitido, respuestaDeError } from '@/lib/validacion-dni-request'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 250

export async function POST(request: Request) {
  if (!esOrigenPermitido(request)) return respuestaDeError('Origen no autorizado.', 403)
  let payload
  try { payload = await request.json() } catch { return respuestaDeError('Solicitud inválida.', 400) }
  if (!payload || !['comprobar', 'validar', 'comprobar-nombre'].includes(payload.accion)) return respuestaDeError('Datos inválidos.', 400)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return respuestaDeError('No autenticado.', 401)
  if (!(await canCurrentUserEditLegajo(supabase))) return respuestaDeError('Sin permiso para validar.', 403)
  // A draft has no familiar ID yet: authorize its titular before consulting the DNI.
  if (payload.accion === 'comprobar-nombre') {
    const dni = dniDelPayload(payload)
    if (!dni || !Number.isSafeInteger(payload.personaDni) || payload.personaDni <= 0) return respuestaDeError('Completá un DNI válido del familiar.', 400)
    const { data: titular, error } = await supabase.from('personas').select('dni').eq('dni', payload.personaDni).maybeSingle()
    if (error) return respuestaDeError('No se pudo consultar el titular.', 500)
    if (!titular) return respuestaDeError('Titular no encontrado.', 404)
    try {
      const resultado = await consultarNombreFamiliar(dni, request.signal)
      return Response.json(resultado, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return respuestaDeError(error instanceof ConsultaNombreFamiliarError ? error.message : 'No se pudo consultar el nombre.', 422)
    }
  }
  if (!Number.isSafeInteger(payload.id) || payload.id <= 0) return respuestaDeError('Familiar inválido.', 400)
  const { data: familiar, error } = await supabase.from('persona_familiares').select('id, dni, apellido, nombre, dni_validado_at').eq('id', payload.id).maybeSingle()
  if (error) return respuestaDeError('No se pudo cargar el familiar.', 500)
  if (!familiar) return respuestaDeError('Familiar no encontrado.', 404)
  if (!/^\d{7,8}$/.test(dniDesdeRegistro(familiar.dni))) return respuestaDeError('El familiar no tiene un DNI válido cargado.', 422)
  if (familiar.dni_validado_at) return respuestaDeError('El familiar ya está validado.', 409)
  const dni = dniDesdeRegistro(familiar.dni)
  // Scope pending checks to this relative and the identity that was reviewed.
  const scope = `${user.id}:familiar:${familiar.id}:${familiar.apellido}:${familiar.nombre}`
  if (payload.accion === 'comprobar') {
    try {
      const resultado = await comprobarDniParaUsuario(scope, dni)
      return Response.json({ dni: resultado.dni, nombre: resultado.nombre, comprobadoEn: resultado.comprobadoEn }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return respuestaDeError(error instanceof ConsultaCuitOnlineError ? error.message : 'No se pudo comprobar el DNI.', 422)
    }
  }
  const comprobacion = obtenerComprobacionPendiente(scope, dni)
  if (!comprobacion) return respuestaDeError('Primero comprobá el DNI y revisá el nombre.', 409)
  const validadoEn = new Date().toISOString()
  const update = supabase.from('persona_familiares').update({ dni_validado_at: validadoEn, updated_at: validadoEn, updated_by: user.id }).eq('id', familiar.id).eq('dni', familiar.dni).eq('apellido', familiar.apellido).eq('nombre', familiar.nombre).is('dni_validado_at', null)
  const { data: saved, error: saveError } = await update.select('dni_validado_at').maybeSingle()
  if (saveError || !saved) return respuestaDeError('No se guardó la validación. El familiar pudo cambiar; volvé a comprobar.', 409)
  consumirComprobacionPendiente(scope, dni)
  return Response.json({ validadoEn: saved.dni_validado_at }, { headers: { 'Cache-Control': 'no-store' } })
}
