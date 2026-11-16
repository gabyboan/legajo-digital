import 'server-only'
import type { createClient } from '@/utils/supabase/server'
import type { PersonaListado } from './listado'

type Client = Awaited<ReturnType<typeof createClient>>
type PersonaRow = {
  dni: number; apellido: string; nombre: string; legajo: number | null
  persona_carreras: { carrera_id: number; carreras: { nombre: string } | { nombre: string }[] | null }[] | { carrera_id: number; carreras: { nombre: string } | { nombre: string }[] | null } | null
}

export async function consultarPersonas(supabase: Client) {
  const pageSize = 500
  async function leerPersonas() {
    const rows: PersonaRow[] = []
    for (let offset = 0; ; offset += pageSize) {
      const page = await supabase.from('personas').select('dni, apellido, nombre, legajo, persona_carreras(carrera_id, carreras(nombre))').order('apellido').order('nombre').order('dni').range(offset, offset + pageSize - 1)
      if (page.error) return { rows: [], error: page.error }
      rows.push(...(page.data ?? []) as unknown as PersonaRow[])
      if ((page.data?.length ?? 0) < pageSize) return { rows, error: null }
    }
  }
  async function leerInactivos() {
    const dnis = new Set<number>()
    for (let offset = 0; ; offset += pageSize) {
      const page = await supabase.from('persona_inactivo').select('dni').order('dni').range(offset, offset + pageSize - 1)
      if (page.error) return { dnis, error: page.error }
      for (const row of page.data ?? []) dnis.add(Number(row.dni))
      if ((page.data?.length ?? 0) < pageSize) return { dnis, error: null }
    }
  }
  // Cada listado termina al agotar sus propias páginas; no consultar otra vez
  // los inactivos cada vez que todavía quedan personas por cargar (o viceversa).
  const [personas, inactivos] = await Promise.all([leerPersonas(), leerInactivos()])
  if (personas.error || inactivos.error) return { personas: [], error: personas.error ?? inactivos.error }
  return { personas: personas.rows.map((persona): PersonaListado => ({
    dni: Number(persona.dni), apellido: persona.apellido, nombre: persona.nombre, legajo: persona.legajo,
    activo: !inactivos.dnis.has(Number(persona.dni)),
    carreras: (Array.isArray(persona.persona_carreras) ? persona.persona_carreras : persona.persona_carreras ? [persona.persona_carreras] : []).map((item) => ({
      id: item.carrera_id, nombre: (Array.isArray(item.carreras) ? item.carreras[0] : item.carreras)?.nombre ?? 'Sin carrera',
    })),
  })), error: null }
}
