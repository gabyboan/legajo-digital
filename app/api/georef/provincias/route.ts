import { createClient } from '@/utils/supabase/server'

type GeorefOption = { id: string; nombre: string }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: 'No autenticado.' }, { status: 401 })

  try {
    const response = await fetch(
      'https://apis.datos.gob.ar/georef/api/provincias?campos=id,nombre&max=100',
      { next: { revalidate: 86400 } }
    )

    if (!response.ok) throw new Error('Georef no respondió correctamente.')
    const data = (await response.json()) as { provincias?: GeorefOption[] }
    const options = (data.provincias ?? []).map((item) => ({
      id: String(item.id),
      nombre: item.nombre,
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

    return Response.json({ options })
  } catch {
    return Response.json({ error: 'No fue posible consultar provincias en Georef.' }, { status: 502 })
  }
}