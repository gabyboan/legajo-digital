'use client'

import { useId, useRef, type ReactNode, type RefObject } from 'react'

export function BusquedaAgentes({ query, onChange, onSubmit, onArrowDown, onFocus, inputRef, children }: {
  query: string
  onChange: (value: string) => void
  onSubmit: () => void
  onArrowDown?: () => void
  onFocus?: () => void
  inputRef?: RefObject<HTMLInputElement | null>
  children?: ReactNode
}) {
  const id = useId()
  const localRef = useRef<HTMLInputElement>(null)
  const searchRef = inputRef ?? localRef
  return <form role="search" onSubmit={(event) => { event.preventDefault(); onSubmit() }} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-0 flex-1 sm:min-w-52">
        <label htmlFor={id} className="mb-2 block text-sm text-zinc-300">Buscar agente</label>
        <input ref={searchRef} id={id} name="q" type="search" value={query} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && onArrowDown) { event.preventDefault(); onArrowDown() }
        }} maxLength={150} autoComplete="off" placeholder="Apellido, nombre, DNI o legajo" aria-describedby={`${id}-ayuda`} className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none" />
      </div>
      {children}
      <button type="submit" className="min-h-11 rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-400">Buscar</button>
      {query ? <button type="button" onClick={() => { onChange(''); searchRef.current?.focus() }} className="min-h-11 px-3 text-sm text-zinc-300 underline underline-offset-4">Limpiar</button> : null}
    </div>
    <p id={`${id}-ayuda`} className="mt-3 text-xs text-zinc-400">Los resultados se actualizan mientras escribís, sin recargar la página. Combiná nombre, apellido, DNI o legajo en cualquier orden. Hacé clic en la fila de un agente o elegilo con ↓ y Enter.</p>
  </form>
}
