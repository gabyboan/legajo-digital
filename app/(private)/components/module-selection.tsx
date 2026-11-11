import Link from 'next/link'

export function ModuleSelection() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[
        { href: '/legajo', title: 'Legajo Digital', description: 'Datos personales y laborales, familiares, asistencia y banco de horas del personal.', icon: 'legajo' },
        { href: '/licencias', title: 'Licencias', description: 'Cargá licencias y consultá las fichas del personal con su historial por año.', icon: 'licencias' },
      ].map(({ href, title, description, icon }) => (
        <Link key={href} href={href} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-emerald-400/50 hover:bg-zinc-800/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 sm:p-8">
          <span aria-hidden="true" className="mb-6 grid size-12 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              {icon === 'legajo' ? <><path d="M3 7h7l2-3h9v16H3z" /><path d="M7 11h10M7 15h7" /></> : <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M8 16l3 3 5-5" /></>}
            </svg>
          </span>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
          <span className="mt-6 inline-block text-sm font-semibold text-emerald-300">Entrar a {title} →</span>
        </Link>
      ))}
    </div>
  )
}
