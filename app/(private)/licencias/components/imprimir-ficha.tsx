'use client'

export function ImprimirFicha() {
  return <button type="button" onClick={() => window.print()} className="min-h-11 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">Imprimir / Guardar PDF</button>
}
