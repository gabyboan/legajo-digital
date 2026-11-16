import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/server'
import { filtrarPersonas } from '@/lib/personas/listado'
import { consultarPersonas } from '@/lib/personas/listado-server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('No autenticado.', { status: 401 })

  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim().slice(0, 150)
  const carreraId = params.get('carrera') ?? ''
  const estado = params.get('estado') ?? 'todos'
  const listado = await consultarPersonas(supabase)
  if (listado.error) return new Response('No fue posible cargar las personas.', { status: 500 })
  const rows = filtrarPersonas(listado.personas, q, carreraId, estado).map((persona) => ({
    DNI: persona.dni,
    Apellido: persona.apellido,
    Nombre: persona.nombre,
    Legajo: persona.legajo,
    Carrera: persona.carreras.map((item) => item.nombre).join(', ') || 'Sin carrera',
    Estado: persona.activo ? 'Activo' : 'Inactivo',
  }))
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
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
