import { createClient } from '@/utils/supabase/server'

type GeorefOption = { id: string; nombre: string }

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: 'No autenticado.' }, { status: 401 })

  const provinciaId = new URL(request.url).searchParams.get('provincia_id')?.trim()
  if (!provinciaId || !/^\d+$/.test(provinciaId)) {
    return Response.json({ error: 'Provincia inválida.' }, { status: 400 })
  }

  try {
    const endpoint = new URL('https://apis.datos.gob.ar/georef/api/localidades')
    endpoint.searchParams.set('provincia', provinciaId)
    endpoint.searchParams.set('campos', 'id,nombre')
    endpoint.searchParams.set('max', '5000')

    const response = await fetch(endpoint, { next: { revalidate: 86400 } })
    if (!response.ok) throw new Error('Georef no respondió correctamente.')

    const data = (await response.json()) as { localidades?: GeorefOption[] }
    const options = (data.localidades ?? []).map((item) => ({
      id: String(item.id),
      nombre: item.nombre,
    })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

    return Response.json({ options })
  } catch {
    return Response.json({ error: 'No fue posible consultar localidades en Georef.' }, { status: 502 })
  }
}