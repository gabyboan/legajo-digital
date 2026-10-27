import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/server'
import { limpiarBusqueda, ordenarPersonasPorCoincidencia } from '@/lib/buscar-personas'

type PersonaRow = {
  dni: number
  apellido: string
  nombre: string
  persona_carreras?: {
    carrera_id: number
    carreras?: { nombre: string } | Array<{ nombre: string }> | null
  } | Array<{
    carrera_id: number
    carreras?: { nombre: string } | Array<{ nombre: string }> | null
  }> | null
}

function parseEstado(value: string | null) {
  return value === 'activos' || value === 'inactivos' ? value : 'todos'
}

function carreraNombre(persona: PersonaRow) {
  const personaCarrera = Array.isArray(persona.persona_carreras)
    ? persona.persona_carreras[0]
    : persona.persona_carreras
  const relation = personaCarrera?.carreras
  const carrera = Array.isArray(relation) ? relation[0] : relation

  return carrera?.nombre?.trim() || 'Sin carrera'
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('No autenticado.', { status: 401 })

  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim()
  const carreraId = params.get('carrera') ?? ''
  const estado = parseEstado(params.get('estado'))

  let personasQuery = supabase
    .from('personas')
    .select('dni, apellido, nombre, persona_carreras(carrera_id, carreras(nombre))')
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true })
    .limit(2000)

  if (/^\d+$/.test(q)) {
    personasQuery = personasQuery.eq('dni', Number(q))
  }

  const [{ data: personasData, error }, { data: inactivos }] = await Promise.all([
    personasQuery,
    supabase.from('persona_inactivo').select('dni'),
  ])

  if (error) return new Response('No fue posible cargar las personas.', { status: 500 })

  const inactivosSet = new Set((inactivos ?? []).map((item) => String(item.dni)))
  const personas = (personasData ?? []) as unknown as PersonaRow[]
  const filtradas = personas.filter((persona) => {
    const personaCarrera = Array.isArray(persona.persona_carreras)
      ? persona.persona_carreras[0]
      : persona.persona_carreras
    const coincideCarrera = carreraId
      ? String(personaCarrera?.carrera_id) === carreraId
      : true
    const esActivo = !inactivosSet.has(String(persona.dni))
    const coincideEstado =
      estado === 'todos' || (estado === 'activos' ? esActivo : !esActivo)

    return coincideCarrera && coincideEstado
  })
  const ordenadas = q
    ? ordenarPersonasPorCoincidencia(filtradas, limpiarBusqueda(q))
    : filtradas

  const rows = ordenadas.map((persona) => ({
    DNI: persona.dni,
    Apellido: persona.apellido,
    Nombre: persona.nombre,
    Carrera: carreraNombre(persona),
    Estado: inactivosSet.has(String(persona.dni)) ? 'Inactivo' : 'Activo',
  }))
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 24 },
    { wch: 32 },
    { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Personas')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="personas.xlsx"',
    },
  })
}