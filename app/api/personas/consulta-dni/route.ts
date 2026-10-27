import { canCurrentUserEditLegajo } from '@/app/(private)/personas/permissions'
import { ConsultaNombreFamiliarError } from '@/lib/consulta-nombre-familiar'
import { comprobarPersonaParaUsuario } from '@/lib/persona-comprobaciones'
import {
  dniDelPayload,
  esOrigenPermitido,
  respuestaDeError,
} from '@/lib/validacion-dni-request'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 250

export async function POST(request: Request) {
  if (!esOrigenPermitido(request)) return respuestaDeError('Origen no autorizado.', 403)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return respuestaDeError('La solicitud no es válida.', 400)
  }

  const dni = dniDelPayload(payload)
  if (!dni) return respuestaDeError('El DNI no es válido.', 400)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return respuestaDeError('No autenticado.', 401)
  if (!(await canCurrentUserEditLegajo(supabase))) {
    return respuestaDeError('No tenés permiso para dar de alta personas.', 403)
  }

  const { data: existente, error } = await supabase
    .from('personas')
    .select('dni')
    .eq('dni', Number(dni))
    .maybeSingle()
  if (error) return respuestaDeError('No se pudo consultar el legajo.', 500)
  if (existente) return respuestaDeError('Ya existe una persona con ese DNI.', 409)

  try {
    const consulta = await comprobarPersonaParaUsuario(user.id, dni)
    return Response.json(consulta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return respuestaDeError(
      error instanceof ConsultaNombreFamiliarError
        ? error.message
        : 'No se pudo consultar las fuentes.',
      422
    )
  }
}
