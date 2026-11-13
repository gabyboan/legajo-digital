'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, type ReactNode } from 'react'

type ModuleId = 'legajo' | 'licencias'
type NavigationLink = { href: string; label: string }
type NavigationModule = {
  id: ModuleId
  label: string
  description: string
  paths: string[]
  links: NavigationLink[]
}

const modules: NavigationModule[] = [
  {
    id: 'legajo',
    label: 'Legajo Digital',
    description: 'Datos del personal',
    paths: ['/legajo', '/personas', '/agenda'],
    links: [
      { href: '/legajo', label: 'Inicio de Legajo' },
      { href: '/personas', label: 'Personas' },
      { href: '/personas/familiares', label: 'Datos de familiares' },
      { href: '/personas/banco-horas', label: 'Banco inicial de horas' },
      { href: '/personas/validacion-dni', label: 'Validación de DNI' },
      { href: '/personas/validacion-dni/familiares', label: 'Validación de familiares' },
      { href: '/agenda', label: 'Agenda' },
    ],
  },
  {
    id: 'licencias',
    label: 'Licencias',
    description: 'Carga y consulta',
    paths: ['/licencias'],
    links: [
      { href: '/licencias', label: 'Inicio de Licencias' },
      { href: '/licencias/cargar', label: 'Cargar licencias' },
      { href: '/licencias/ultimas', label: 'Últimas cargas' },
      { href: '/licencias/control-novedades', label: 'Control de novedades' },
      { href: '/licencias/fichas', label: 'Ver fichas' },
    ],
  },
]

const allLinks = [{ href: '/dashboard', label: 'Inicio' }, ...modules.flatMap((module) => module.links)]

function NavigationIcon({ type }: { type: ModuleId | 'inicio' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
      {type === 'inicio' ? <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h5v-7h4v7h5V9" /></> : type === 'legajo' ? <><path d="M3 7h7l2-3h9v16H3z" /><path d="M7 11h10M7 15h7" /></> : <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M8 16l3 3 5-5" /></>}
    </svg>
  )
}

function SidebarLink({ link, active, module, onNavigate }: {
  link: NavigationLink
  active: boolean
  module?: ModuleId
  onNavigate: () => void
}) {
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      onNavigate={onNavigate}
      className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${active
        ? module === 'licencias'
          ? 'border-sky-400/30 bg-sky-400/10 font-semibold text-sky-200'
          : 'border-emerald-400/30 bg-emerald-400/10 font-semibold text-emerald-200'
        : 'border-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      {module ? <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${active ? 'bg-current' : 'bg-zinc-600'}`} /> : <NavigationIcon type="inicio" />}
      <span>{link.label}</span>
    </Link>
  )
}

function ModuleGroup({ module, expanded, current, activeHref, onToggle, onNavigate, buttonRef }: {
  module: NavigationModule
  expanded: boolean
  current: boolean
  activeHref: string | undefined
  onToggle: () => void
  onNavigate: () => void
  buttonRef: (element: HTMLButtonElement | null) => void
}) {
  const blue = module.id === 'licencias'
  return (
    <div className={`overflow-hidden rounded-xl border transition ${current
      ? blue ? 'border-sky-400/35 bg-sky-400/5' : 'border-emerald-400/35 bg-emerald-400/5'
      : 'border-zinc-700/70 bg-zinc-950/25'
    }`}>
      <button
        ref={buttonRef}
        type="button"
        aria-labelledby={`nav-${module.id}-titulo`}
        aria-describedby={`nav-${module.id}-descripcion`}
        aria-expanded={expanded}
        aria-controls={`nav-${module.id}-links`}
        onClick={onToggle}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-zinc-800/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-400"
      >
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${blue ? 'bg-sky-400/10 text-sky-300' : 'bg-emerald-400/10 text-emerald-300'}`}><NavigationIcon type={module.id} /></span>
        <span className="min-w-0 flex-1">
          <span id={`nav-${module.id}-titulo`} className="block text-sm font-semibold text-white">{module.label}</span>
          <span id={`nav-${module.id}-descripcion`} className="mt-0.5 block text-xs text-zinc-400">{module.description}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`size-4 shrink-0 text-zinc-400 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <ul id={`nav-${module.id}-links`} aria-label={`Módulos de ${module.label}`} hidden={!expanded} className="mr-3 mb-3 ml-7 space-y-1 border-l border-zinc-700 pl-2">
        {module.links.map((link, index) => (
          <li key={link.href} className={index === 0 ? 'mb-2 border-b border-zinc-700/70 pb-2' : undefined}>
            <SidebarLink link={link} active={activeHref === link.href} module={module.id} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavigationPanel({ pathname, account }: { pathname: string; account: ReactNode }) {
  const currentModule = modules.find((module) => module.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)))?.id
  const [open, setOpen] = useState(false)
  const [expandedModule, setExpandedModule] = useState<ModuleId | null>(currentModule ?? null)
  const toggle = useRef<HTMLButtonElement>(null)
  const groupToggles = useRef<Record<ModuleId, HTMLButtonElement | null>>({ legajo: null, licencias: null })
  const activeHref = allLinks
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <aside
      aria-label="Panel de navegación"
      className="border-b border-zinc-800 bg-zinc-900 p-4 md:sticky md:top-0 md:flex md:h-screen md:w-72 md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:p-5"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        if (open && toggle.current?.getClientRects().length) {
          event.preventDefault()
          setOpen(false)
          toggle.current?.focus()
        } else if (expandedModule) {
          event.preventDefault()
          setExpandedModule(null)
          groupToggles.current[expandedModule]?.focus()
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          onNavigate={() => setOpen(false)}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
        >
          <p className="text-lg font-bold text-white">Gestión de personal</p>
          <p className="mt-1 text-xs text-zinc-400">Legajos y licencias</p>
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
      <div id="menu-principal" className={`${open ? 'block' : 'hidden'} mt-5 md:mt-8 md:flex md:flex-1 md:flex-col`}>
        <nav aria-label="Navegación principal" className="space-y-3">
          <SidebarLink link={allLinks[0]} active={activeHref === '/dashboard'} onNavigate={() => setOpen(false)} />
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">Módulos de trabajo</p>
          {modules.map((module) => (
            <ModuleGroup
              key={module.id}
              module={module}
              expanded={expandedModule === module.id}
              current={currentModule === module.id}
              activeHref={activeHref}
              onToggle={() => setExpandedModule((current) => current === module.id ? null : module.id)}
              onNavigate={() => setOpen(false)}
              buttonRef={(element) => { groupToggles.current[module.id] = element }}
            />
          ))}
        </nav>
        <div className="mt-6 md:mt-auto">{account}</div>
      </div>
    </aside>
  )
}

export function AppNavigation({ account }: { account: ReactNode }) {
  const pathname = usePathname()
  // Reset disclosure state on navigation, including browser back/forward.
  return <NavigationPanel key={pathname} pathname={pathname} account={account} />
}
