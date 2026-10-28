import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { logout } from '@/app/login/actions'
import { createClient } from '@/utils/supabase/server'
import { destinoMfa, enlaceMfa } from '@/lib/auth/mfa'
import { estadoMfa, factoresTotp } from '@/lib/auth/mfa-server'
import { verificarMfa } from './actions'
import { MfaForm } from './mfa-form'

export const metadata: Metadata = { title: 'Verificar acceso', robots: { index: false, follow: false } }

export default async function MfaPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) redirect('/login')
  const params = (await searchParams) ?? {}
  const destination = destinoMfa(params.next)
  const status = await estadoMfa(client, user)
  if (status === 'verified') redirect(destination)
  const { factors, error: factorError } = status === 'error'
    ? { factors: [], error: true } : await factoresTotp(client)

  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-white sm:p-6">
    <section aria-labelledby="mfa-title" className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:p-8">
      <div>
        <p className="text-sm text-zinc-400">Legajo Digital</p>
        <h1 id="mfa-title" className="mt-2 text-2xl font-bold">Verificá tu acceso</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">Para continuar, confirmá tu identidad con el código de tu aplicación autenticadora.</p>
        {user.email ? <p className="mt-2 break-all text-sm text-zinc-400">Cuenta: {user.email}</p> : null}
      </div>
      {factorError ? <div role="alert" className="space-y-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <p>No se pudo comprobar la verificación de tu cuenta.</p>
        <a href={enlaceMfa(destination)} className="inline-flex min-h-11 items-center underline underline-offset-4">Volver a intentar</a>
      </div> : factors.length ? <MfaForm factors={factors} destination={destination} action={verificarMfa} /> : <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
        No hay una aplicación autenticadora verificada disponible para esta cuenta. Si el sistema exige esa verificación, contactá al administrador para revisar la configuración de acceso.
      </div>}
      <form action={logout}>
        <button type="submit" className="min-h-11 w-full rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">Cerrar sesión</button>
      </form>
    </section>
  </main>
}
