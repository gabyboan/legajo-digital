import 'server-only'
import type { createClient } from '@/utils/supabase/server'
import type { PersonaListado } from './listado'

type Client = Awaited<ReturnType<typeof createClient>>
type PersonaRow = {
  dni: number; apellido: string; nombre: string; legajo: number | null
  persona_carreras: { carrera_id: number; carreras: { nombre: string } | { nombre: string }[] | null }[] | { carrera_id: number; carreras: { nombre: string } | { nombre: string }[] | null } | null
}

export async function consultarPersonas(supabase: Client) {
  const personas: PersonaRow[] = []
  const inactivos = new Set<number>()
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const [page, inactive] = await Promise.all([
      supabase.from('personas').select('dni, apellido, nombre, legajo, persona_carreras(carrera_id, carreras(nombre))').order('apellido').order('nombre').order('dni').range(offset, offset + pageSize - 1),
      supabase.from('persona_inactivo').select('dni').order('dni').range(offset, offset + pageSize - 1),
    ])
    if (page.error || inactive.error) return { personas: [], error: page.error ?? inactive.error }
    personas.push(...(page.data ?? []) as unknown as PersonaRow[])
    for (const row of inactive.data ?? []) inactivos.add(Number(row.dni))
    if ((page.data?.length ?? 0) < pageSize && (inactive.data?.length ?? 0) < pageSize) break
  }
  return { personas: personas.map((persona): PersonaListado => ({
    dni: Number(persona.dni), apellido: persona.apellido, nombre: persona.nombre, legajo: persona.legajo,
    activo: !inactivos.has(Number(persona.dni)),
    carreras: (Array.isArray(persona.persona_carreras) ? persona.persona_carreras : persona.persona_carreras ? [persona.persona_carreras] : []).map((item) => ({
      id: item.carrera_id, nombre: (Array.isArray(item.carreras) ? item.carreras[0] : item.carreras)?.nombre ?? 'Sin carrera',
    })),
  })), error: null }
}
