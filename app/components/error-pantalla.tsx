'use client'

import Link from 'next/link'

export function ErrorPantalla({ retry }: { retry: () => void }) {
  return <section role="alert" className="mx-auto max-w-xl space-y-4 rounded-2xl border border-amber-400/30 bg-zinc-900 p-6 text-white">
    <h1 className="text-xl font-semibold">No se pudo cargar esta página</h1>
    <p className="text-sm text-zinc-300">Volvé a cargar la vista. Si estabas guardando un cambio, comprobá primero que haya quedado registrado antes de enviarlo otra vez.</p>
    <div className="flex flex-wrap gap-4">
      <button type="button" onClick={retry} className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">Volver a cargar</button>
      <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm text-sky-300 underline underline-offset-4">Ir al inicio</Link>
    </div>
  </section>
}
