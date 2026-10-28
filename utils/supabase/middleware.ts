import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from './config'
import { enlaceMfa, esRutaPrivada } from '@/lib/auth/mfa'
import { estadoMfa } from '@/lib/auth/mfa-server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const { url, key } = getSupabaseConfig()

  const supabase = createServerClient(url, key, {
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
  if (user && ['GET', 'HEAD'].includes(request.method) && esRutaPrivada(request.nextUrl.pathname)) {
    const status = await estadoMfa(supabase, user)
    if (status === 'required' || status === 'error') {
      const target = request.nextUrl.clone()
      const destination = request.nextUrl.pathname + request.nextUrl.search
      target.pathname = '/auth/mfa'
      target.search = new URL(enlaceMfa(destination), target).search
      const redirectResponse = NextResponse.redirect(target)
      // Keep refreshed session cookies when replacing the pass-through response.
      response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
      redirectResponse.headers.set('Cache-Control', 'private, no-store')
      return redirectResponse
    }
  }
  return response
}
