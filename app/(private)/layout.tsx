import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/login/actions'
import { PrivateShell } from './components/private-shell'
import { enlaceMfa } from '@/lib/auth/mfa'
import { estadoMfa } from '@/lib/auth/mfa-server'

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
  const status = await estadoMfa(supabase, user)
  if (status === 'required' || status === 'error') redirect(enlaceMfa('/dashboard'))

  return (
    <PrivateShell
      account={
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Usuario
          </p>
          <p className="mt-2 break-all text-sm text-zinc-200">{user.email}</p>

          <form action={logout} className="mt-4">
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      }
    >
      {children}
    </PrivateShell>
  )
}
