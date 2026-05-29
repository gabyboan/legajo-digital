import Link from 'next/link'

type ModulePlaceholderProps = {
  params: Promise<{ dni: string }>
  title: string
}

export async function ModulePlaceholder({
  params,
  title,
}: ModulePlaceholderProps) {
  const { dni } = await params

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/personas/${dni}`}
          className="text-sm text-zinc-400 underline underline-offset-4"
        >
          ← Volver a la ficha
        </Link>

        <h1 className="mt-3 text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Modulo pendiente de implementacion.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
        Este apartado queda reservado para la siguiente etapa del legajo.
      </div>
    </section>
  )
}
