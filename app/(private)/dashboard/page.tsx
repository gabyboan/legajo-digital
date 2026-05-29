import Link from 'next/link'

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Base operativa del legajo digital.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/personas"
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:bg-zinc-800/60"
        >
          <h2 className="text-lg font-semibold">Personas</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Alta, edición y ficha base de cada agente.
          </p>
        </Link>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Documentos</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Próximo módulo: adjuntos del legajo.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Historial</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Próximo módulo: movimientos y observaciones.
          </p>
        </div>
      </div>
    </section>
  )
}