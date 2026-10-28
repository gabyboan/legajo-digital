'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, type ReactNode } from 'react'

const links = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/personas', label: 'Personas' },
  { href: '/personas/banco-horas', label: 'Banco inicial de horas' },
  { href: '/personas/validacion-dni', label: 'Validación de DNI' },
  { href: '/personas/validacion-dni/familiares', label: 'Validación de familiares' },
  { href: '/personas/familiares', label: 'Datos de familiares' },
  { href: '/agenda', label: 'Agenda' },
]

function NavigationPanel({ pathname, account }: { pathname: string; account: ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const activeHref = links
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <aside
      aria-label="Panel de navegación"
      className="border-b border-zinc-800 bg-zinc-900 p-4 md:w-72 md:shrink-0 md:border-r md:border-b-0 md:p-5"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false)
          toggle.current?.focus()
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          onNavigate={() => setOpen(false)}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
        >
          <p className="text-xl font-bold text-white">Legajo Digital</p>
          <p className="mt-1 text-sm text-zinc-400">Panel interno</p>
        </Link>
        <button
          ref={toggle}
          type="button"
          aria-label={open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={open}
          aria-controls="menu-principal"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-600 px-3 text-sm text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 md:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
            <path d={open ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
          Menú
        </button>
      </div>
      <div id="menu-principal" className={`${open ? 'block' : 'hidden'} mt-5 md:mt-8 md:block`}>
        <nav aria-label="Navegación principal" className="space-y-1">
          {links.map(({ href, label }) => {
            const active = href === activeHref
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                onNavigate={() => setOpen(false)}
                className={`flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${active
                  ? 'border-emerald-400/30 bg-emerald-400/10 font-semibold text-emerald-200'
                  : 'border-transparent text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
        {account}
      </div>
    </aside>
  )
}

export function AppNavigation({ account }: { account: ReactNode }) {
  const pathname = usePathname()
  // Reset disclosure state on navigation, including browser back/forward.
  return <NavigationPanel key={pathname} pathname={pathname} account={account} />
}
