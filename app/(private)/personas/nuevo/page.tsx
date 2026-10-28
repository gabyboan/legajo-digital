import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from '../permissions'
import { NuevaPersonaForm } from './nueva-persona-form'

type NuevaPersonaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function NuevaPersonaPage({
  searchParams,
}: NuevaPersonaPageProps) {
  const params = (await searchParams) ?? {}
  const rawError = params.error
  const error = Array.isArray(rawError) ? rawError[0] : rawError

  const supabase = await createClient()
  const canEdit = await canCurrentUserEditLegajo(supabase)

  if (!canEdit) {
    redirect(
      `/personas?error=${encodeURIComponent(
        'No tenés permisos para editar personas'
      )}`
    )
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/personas"
          className="text-sm text-zinc-400 underline underline-offset-4"
        >
          ← Volver a personas
        </Link>

        <h1 className="mt-3 text-2xl font-bold">Nueva persona</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Consultá las fuentes públicas, guardá la identidad y completá el resto del legajo después.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <NuevaPersonaForm />
    </section>
  )
}
