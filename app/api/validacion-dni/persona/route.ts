import { canCurrentUserEditLegajo } from '@/app/(private)/personas/permissions'
import {
  dniDelPayload,
  esOrigenPermitido,
  respuestaDeError,
} from '@/lib/validacion-dni-request'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_NOMBRE_LENGTH = 120

function textoDelPayload(payload: unknown, campo: 'apellido' | 'nombre') {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null
  }

  const value = (payload as Record<string, unknown>)[campo]

  if (typeof value !== 'string') {
    return null
  }

  const texto = value.normalize('NFC').replace(/\s+/g, ' ').trim()

  return texto && texto.length <= MAX_NOMBRE_LENGTH ? texto : null
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
  const apellido = textoDelPayload(payload, 'apellido')
  const nombre = textoDelPayload(payload, 'nombre')

  if (!dni || !apellido || !nombre) {
    return respuestaDeError('DNI, apellido y nombre son obligatorios.', 400)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return respuestaDeError('No autenticado.', 401)
  }

  if (!(await canCurrentUserEditLegajo(supabase))) {
    return respuestaDeError('No tenés permiso para editar legajos.', 403)
  }

  const { data: persona, error } = await supabase
    .from('personas')
    .update({
      apellido,
      nombre,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('dni', Number(dni))
    .select('dni, apellido, nombre, cuil')
    .maybeSingle()

  if (error) {
    return respuestaDeError('No se pudo guardar el nombre en el legajo.', 500)
  }

  if (!persona) {
    return respuestaDeError('La persona no existe o no se pudo actualizar.', 404)
  }

  return Response.json(persona, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
