'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { LicenciaPersona, LicenciaTipo } from '@/lib/licencias/domain'
import { ModuleMessage } from '../components/module-message'
import { PersonasSelector } from '../components/personas-selector'
import { LicenciaForm } from './licencia-form'

export function CargarLicenciasPanel({ initialPersona, personas, q, tipos, hoy, puedeVerFicha }: {
  initialPersona: LicenciaPersona | null
  personas: LicenciaPersona[]
  q: string
  tipos: LicenciaTipo[]
  hoy: string
  puedeVerFicha: boolean
}) {
  const [persona, setPersona] = useState(initialPersona)
  const [formVersion, setFormVersion] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  function seleccionar(agente: LicenciaPersona, query: string) {
    setPersona(agente)
    const params = new URLSearchParams({ dni: String(agente.dni) })
    if (query.trim()) params.set('q', query.trim())
    window.history.replaceState(null, '', `/licencias/cargar?${params}`)
  }

  function buscarOtro() {
    input.current?.focus()
    input.current?.select()
    input.current?.scrollIntoView({ block: 'nearest' })
  }

  function cancelar() {
    setPersona(null)
    window.history.replaceState(null, '', '/licencias/cargar')
    buscarOtro()
  }

  return (
    <div className="space-y-6">
      <PersonasSelector personas={personas} q={q} puedeVerFicha={puedeVerFicha} selectedDni={persona?.dni} onSelect={seleccionar} inputRef={input} />
      {persona ? <>
        <div data-agente-seleccionado={persona.dni} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-sky-400/25 bg-sky-400/5 p-5">
          <div><p className="mb-1 text-xs font-medium text-sky-300">Agente seleccionado</p><h2 aria-live="polite" className="font-semibold">{persona.apellido_nombre}</h2><p className="mt-1 text-sm text-zinc-400">DNI {persona.dni} · Legajo {persona.legajo ?? '—'} · {persona.carrera || 'Sin carrera'}{persona.activo ? '' : ' · Inactivo'}</p></div>
          <div className="flex flex-wrap items-center gap-4">
            {puedeVerFicha ? <Link href={`/licencias/fichas/${persona.dni}`} aria-label={`Ver ficha de ${persona.apellido_nombre}`} className="inline-flex min-h-11 items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">Ver ficha</Link> : null}
            <button type="button" onClick={buscarOtro} className="min-h-11 text-sm text-sky-300 underline underline-offset-4">Cambiar agente</button>
          </div>
        </div>
        {tipos.length ? <LicenciaForm key={`${persona.dni}:${formVersion}`} persona={persona} tipos={tipos} hoy={hoy} puedeVerFicha={puedeVerFicha} onCancelar={cancelar} onNuevaLicencia={() => setFormVersion((value) => value + 1)} /> : <ModuleMessage>No hay tipos de licencia habilitados para cargar.</ModuleMessage>}
        <p className="text-xs text-zinc-400">Los imprevistos se cargan y modifican desde el módulo Imprevistos de Gestión.</p>
      </> : <p className="text-sm text-zinc-400">Seleccioná un agente para cargar una licencia o abrí su ficha desde los resultados.</p>}
    </div>
  )
}
