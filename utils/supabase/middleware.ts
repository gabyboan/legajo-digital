import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from './config'
import { enlaceMfa, esRutaPrivada } from '@/lib/auth/mfa'
import { estadoMfa } from '@/lib/auth/mfa-server'
import { comprobarSesionDatos } from '@/lib/auth/session-server'
import { enlaceSesionVencida } from '@/lib/auth/session'
import { fetchConLimite } from '@/lib/auth/fetch'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const { url, key } = getSupabaseConfig()

  const supabase = createServerClient(url, key, {
    global: { fetch: fetchConLimite },
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  // Gate page navigation before Server Components start their data queries.
  // API and Server Action authorization remain enforced by their own checks and RLS.
  if (['GET', 'HEAD'].includes(request.method) && esRutaPrivada(request.nextUrl.pathname)) {
    const status = user ? await estadoMfa(supabase, user) : null
    const dataStatus = user && (status === 'verified' || status === 'none') ? await comprobarSesionDatos(supabase) : null
    if (!user || status === 'required' || status === 'error' || dataStatus === 'expired' || dataStatus === 'mfa') {
      const target = request.nextUrl.clone()
      const destination = request.nextUrl.pathname + request.nextUrl.search
      const href = dataStatus === 'expired' ? enlaceSesionVencida(destination)
        : user ? enlaceMfa(destination) : `/login?${new URLSearchParams({ next: destination })}`
      const location = new URL(href, target)
      target.pathname = location.pathname
      target.search = location.search
      const redirectResponse = NextResponse.redirect(target)
      // Keep refreshed session cookies when replacing the pass-through response.
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
      redirectResponse.headers.set('Cache-Control', 'private, no-store')
      return redirectResponse
    }
  }
  return response
}
