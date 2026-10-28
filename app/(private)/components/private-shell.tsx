import type { ReactNode } from 'react'
import { AppNavigation } from './app-navigation'

export function PrivateShell({ children, account }: { children: ReactNode; account: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-black"
      >
        Saltar al contenido
      </a>
      <div className="min-h-screen md:flex">
        <AppNavigation account={account} />
        <main id="contenido-principal" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
