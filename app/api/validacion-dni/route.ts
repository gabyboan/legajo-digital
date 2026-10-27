import { canCurrentUserEditLegajo } from '@/app/(private)/personas/permissions'
import { comprobarDniParaUsuario } from '@/lib/dni-comprobaciones'
import { ConsultaCuitOnlineError } from '@/lib/cuitonline'
import {
  dniDelPayload,
  esOrigenPermitido,
  respuestaDeError,
} from '@/lib/validacion-dni-request'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
    return respuestaDeError('No tenés permiso para comprobar DNIs.', 403)
  }

  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('dni, cuil')
    .eq('dni', Number(dni))
    .maybeSingle()

  if (personaError) {
    return respuestaDeError('No se pudo comprobar el DNI en el legajo.', 500)
  }

  if (!persona) {
    return respuestaDeError('El DNI no pertenece al personal cargado.', 404)
  }

  const { data: validacion, error: validacionError } = await supabase
    .from('persona_dni_validaciones')
    .select('validado_at')
    .eq('persona_dni', Number(dni))
    .maybeSingle()

  if (validacionError) {
    return respuestaDeError('No se pudo consultar el estado de validación.', 500)
  }

  if (validacion) {
    return respuestaDeError(
      'Este DNI ya fue validado y no se volverá a consultar con el scraper.',
      409
    )
  }

  try {
    const resultado = await comprobarDniParaUsuario(user.id, dni)

    return Response.json({ ...resultado, cuilActual: persona.cuil, inconsistenciaCuit: persona.cuil != null && String(persona.cuil) !== resultado.cuit }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof ConsultaCuitOnlineError) {
      return respuestaDeError(error.message, 422)
    }

    return respuestaDeError('No se pudo completar la comprobación.', 502)
  }
}
