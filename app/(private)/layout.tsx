import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { logout } from '@/app/login/actions'

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

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-8">
            <h1 className="text-xl font-bold">Legajo Digital</h1>
            <p className="mt-1 text-sm text-zinc-400">Panel interno</p>
          </div>

          <nav className="space-y-2">
            <Link
              href="/dashboard"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              Dashboard
            </Link>

            <Link
              href="/personas"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              Personas
            </Link>

            <Link
              href="/agenda"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
            >
              Agenda
            </Link>
          </nav>

          <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Usuario
            </p>
            <p className="mt-2 break-all text-sm text-zinc-200">{user.email}</p>

            <form action={logout} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm transition hover:bg-zinc-800"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
