import Link from 'next/link'

export default function LegajoPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Legajo Digital</h1>
        <p className="mt-1 text-sm text-zinc-400">Consultá y administrá los datos del personal.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { href: '/personas', title: 'Personas', description: 'Alta, edición y ficha de cada agente.' },
          { href: '/personas/familiares', title: 'Datos de familiares', description: 'Consulta y actualización de los familiares del personal.' },
          { href: '/personas/banco-horas', title: 'Banco inicial de horas', description: 'Administración del banco inicial de horas y francos.' },
          { href: '/personas/validacion-dni', title: 'Validación de DNI', description: 'Comprobación de identidad de agentes y familiares.' },
          { href: '/agenda', title: 'Agenda', description: 'Feriados y días no laborables.' },
        ].map(({ href, title, description }) => (
          <Link key={href} href={href} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-emerald-400/40 hover:bg-zinc-800/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-zinc-400">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
