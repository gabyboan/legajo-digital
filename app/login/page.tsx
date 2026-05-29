import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { login } from './actions'

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  const params = (await searchParams) ?? {}
  const rawError = params.error
  const error = Array.isArray(rawError) ? rawError[0] : rawError

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Legajo Digital</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Ingresá con tu usuario de Supabase Auth.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form action={login} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-zinc-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="nombre@correo.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-zinc-300">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="********"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Ingresar
          </button>
        </form>
      </div>
    </main>
  )
}