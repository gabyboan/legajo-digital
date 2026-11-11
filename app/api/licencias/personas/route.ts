import { createClient } from '@/utils/supabase/server'
import { enlaceMfa } from '@/lib/auth/mfa'
import { estadoMfa } from '@/lib/auth/mfa-server'
import { personaParaSelector } from '@/lib/licencias/domain'
import { permisosLicencias, personasLicencias } from '@/lib/licencias/server'
import { comprobarSesionDatos } from '@/lib/auth/session-server'
import { enlaceSesionVencida } from '@/lib/auth/session'
import { unstable_rethrow } from 'next/navigation'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const q = params.get('q') ?? ''
  const contexto = params.get('contexto')
  if (params.getAll('q').length > 1 || params.getAll('contexto').length !== 1 || q.length > 150 || (contexto !== 'cargar' && contexto !== 'fichas')) {
    return Response.json({ error: 'La búsqueda es inválida.' }, { status: 400, headers })
  }
  const destino = `/licencias/${contexto}?${new URLSearchParams({ q: q.trim() })}`
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Tu sesión terminó. Ingresá nuevamente.', href: `/login?${new URLSearchParams({ next: destino })}` }, { status: 401, headers })
    const mfa = await estadoMfa(supabase, user)
    if (mfa === 'error') return Response.json({ error: 'No se pudo comprobar tu sesión. Volvé a intentarlo.' }, { status: 503, headers })
    if (mfa === 'required') return Response.json({ error: 'Verificá tu código de autenticación para continuar.', href: enlaceMfa(destino) }, { status: 403, headers })
    const sesion = await comprobarSesionDatos(supabase)
    if (sesion === 'expired') return Response.json({ error: 'Tu sesión venció. Ingresá nuevamente.', href: enlaceSesionVencida(destino) }, { status: 401, headers })
    if (sesion === 'mfa') return Response.json({ error: 'Verificá tu código de autenticación para continuar.', href: enlaceMfa(destino) }, { status: 403, headers })
    if (sesion !== 'active') return Response.json({ error: 'No se pudo comprobar tu sesión. Volvé a intentarlo.' }, { status: sesion === 'conflict' ? 409 : 503, headers })
    const permisos = await permisosLicencias(supabase)
    if (permisos.error) return Response.json({ error: 'No se pudieron comprobar los permisos. Volvé a intentarlo.' }, { status: 503, headers })
    if (contexto === 'fichas' ? !permisos.ficha : !permisos.leer || !permisos.cargar) {
      return Response.json({ error: 'No tenés permiso para consultar estos agentes.' }, { status: 403, headers })
    }
    const result = await personasLicencias(supabase, q, contexto === 'fichas')
    if (result.error) return Response.json({ error: 'No se pudieron buscar los agentes. Volvé a intentarlo.' }, { status: 503, headers })
    return Response.json({ personas: result.personas.map(personaParaSelector) }, { headers })
  } catch (error) {
    unstable_rethrow(error)
    return Response.json({ error: 'No se pudo conectar con la búsqueda. Volvé a intentarlo.' }, { status: 503, headers })
  }
}
