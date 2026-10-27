import { canCurrentUserEditLegajo } from '@/app/(private)/personas/permissions'
import {
  consumirComprobacionPendiente,
  obtenerComprobacionPendiente,
} from '@/lib/dni-comprobaciones'
import {
  dniDelPayload,
  esOrigenPermitido,
  respuestaDeError,
} from '@/lib/validacion-dni-request'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ValidacionRpc = {
  persona_dni: number
  cuil: number
  validado_at: string
}

export async function POST(request: Request) {
  if (!esOrigenPermitido(request)) {
    return respuestaDeError('Origen no autorizado.', 403)
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return respuestaDeError('La solicitud no es válida.', 400)
  }

  const dni = dniDelPayload(payload)

  if (!dni) {
    return respuestaDeError('El DNI no es válido.', 400)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return respuestaDeError('No autenticado.', 401)
  }

  if (!(await canCurrentUserEditLegajo(supabase))) {
    return respuestaDeError('No tenés permiso para validar DNIs.', 403)
  }

  const comprobacion = obtenerComprobacionPendiente(user.id, dni)

  if (!comprobacion) {
    return respuestaDeError(
      'Primero pulsá Comprobar y revisá el nombre antes de validar.',
      409
    )
  }

  const cuit = Number(comprobacion.cuit)

  if (!Number.isSafeInteger(cuit) || cuit < 10000000000 || cuit > 99999999999) {
    return respuestaDeError('La comprobación no devolvió un CUIT/CUIL válido.', 422)
  }

  const { data: persona, error: personaError } = await supabase.from('personas').select('cuil').eq('dni', Number(dni)).maybeSingle()
  if (personaError || !persona) return respuestaDeError('No se pudo consultar el CUIT/CUIL actual.', 409)
  if (persona.cuil != null && String(persona.cuil) !== comprobacion.cuit) {
    return respuestaDeError('El CUIT/CUIL obtenido es distinto del cargado. Revisá la inconsistencia antes de validar; no se reemplazó el dato.', 409)
  }

  const { data, error } = await supabase
    .rpc('confirmar_persona_dni_validacion_con_cuit', {
      p_dni: Number(dni),
      p_cuit: cuit,
    })
    .single()

  const validacion = data as ValidacionRpc | null

  if (error || !validacion) {
    return respuestaDeError('No se pudo guardar la validación.', 500)
  }

  consumirComprobacionPendiente(user.id, dni)

  return Response.json(
    {
      dni: validacion.persona_dni,
      cuil: validacion.cuil,
      validadoEn: validacion.validado_at,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
