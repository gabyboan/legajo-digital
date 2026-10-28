import 'server-only'
import type { createClient } from '@/utils/supabase/server'
import type { DomicilioValores, PersonaEditable } from './types'

export type FichaEdicionSnapshot = {
  persona: PersonaEditable & { horario_rotativo: boolean; created_at: string | null; updated_at: string | null }
  carreras: number[]
  situaciones: number[]
  domicilio: (DomicilioValores & { id: string }) | null
  version: string
}

export async function obtenerFichaEdicion(client: Awaited<ReturnType<typeof createClient>>, dni: number) {
  const result = await client.rpc('rpc_persona_ficha_edicion', { p_dni: dni })
  return { data: result.data as FichaEdicionSnapshot | null, error: result.error }
}

const PERSONA_FICHA_SELECT = 'dni, legajo, apellido, nombre, email, telefono, fecha_nacimiento, created_at, updated_at, horario_rotativo, cuil, reloj, indice, sexo_id, numero_contacto, estado_civil, fecha_ingreso, formacion_estudio, matricula, nivel_escolaridad, estado_escolaridad, fecha_inicio_tarea_especifica, observacion'

export function obtenerFichaPersona(client: Awaited<ReturnType<typeof createClient>>, dni: number) {
  return client.from('personas').select(PERSONA_FICHA_SELECT).eq('dni', dni).maybeSingle()
}

export function obtenerDomicilioVigente(client: Awaited<ReturnType<typeof createClient>>, dni: number) {
  return client.from('persona_domicilios')
    .select('calle, numero, barrio, manzana, lote, casa, torre, monoblock, piso, departamento, referencias, otros_datos, provincia_georef_id, provincia_nombre, localidad_georef_id, localidad_nombre')
    .eq('persona_dni', dni).is('vigente_hasta', null).maybeSingle()
}
