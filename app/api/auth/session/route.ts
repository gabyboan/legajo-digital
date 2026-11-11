import { createClient } from '@/utils/supabase/server'
import { destinoMfa, enlaceMfa } from '@/lib/auth/mfa'
import { comprobarSesionDatos } from '@/lib/auth/session-server'
import { enlaceSesionVencida, esSesionVencida } from '@/lib/auth/session'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const destination = destinoMfa(new URL(request.url).searchParams.get('next'))
  const expired = () => Response.json({ href: enlaceSesionVencida(destination) }, { status: 401, headers })
  try {
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (esSesionVencida(error) || (!user && (!error || error.name === 'AuthSessionMissingError'))) return expired()
    if (error || !user) return Response.json({ error: 'No se pudo comprobar la sesión.' }, { status: 503, headers })
    const status = await comprobarSesionDatos(client)
    if (status === 'expired') return expired()
    if (status === 'mfa') return Response.json({ href: enlaceMfa(destination) }, { status: 403, headers })
    if (status !== 'active') return Response.json({ error: 'No se pudo comprobar la sesión.' }, { status: status === 'conflict' ? 409 : 503, headers })
    return Response.json({ active: true }, { headers })
  } catch {
    return Response.json({ error: 'No se pudo conectar para comprobar la sesión.' }, { status: 503, headers })
  }
}
