import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { enlaceLoginVencido } from '@/lib/auth/session'

export async function GET(request: Request) {
  // A Server Action may try to stream its redirect as an RSC page. Cookie
  // cleanup needs a browser request to this handler, not that internal fetch.
  // A non-RSC response makes Next complete the redirect as a document request.
  if (request.headers.get('rsc') === '1') return new Response(null, {
    status: 204, headers: { 'Cache-Control': 'private, no-store' },
  })
  const destination = new URL(request.url).searchParams.get('next') ?? '/dashboard'
  const client = await createClient()
  // Route handlers can clear cookies; Server Components cannot.
  try {
    await client.auth.signOut({ scope: 'local' })
  } catch {
    // The login page must remain reachable even if Auth is temporarily offline.
  }
  return NextResponse.redirect(new URL(enlaceLoginVencido(destination), request.url), {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
