'use client'

import { useState } from 'react'
import { dniDesdeRegistro, formatearDni } from '@/lib/dni'
import { capitalizarNombre, nombresCoinciden } from '@/lib/nombres'

type Familiar = { id: number; persona_dni: number; dni: number | null; apellido: string; nombre: string; dni_validado_at: string | null }
type Resultado = { nombre: string }
export function ListadoFamiliares({ familiares }: { familiares: Familiar[] }) {
  const [resultados, setResultados] = useState<Record<number, Resultado>>({})
  const [ocupado, setOcupado] = useState<Record<number, boolean>>({})
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [validados, setValidados] = useState<Record<number, string>>({})
  async function ejecutar(id: number, accion: 'comprobar' | 'validar') {
    if (ocupado[id]) return
    setOcupado((v) => ({ ...v, [id]: true }))
    setErrores((v) => ({ ...v, [id]: '' }))
    if (accion === 'comprobar') setResultados((v) => { const next = { ...v }; delete next[id]; return next })
    try {
      const response = await fetch('/api/validacion-dni/familiar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, accion }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.')
      if (accion === 'comprobar') setResultados((v) => ({ ...v, [id]: data }))
      else setValidados((v) => ({ ...v, [id]: data.validadoEn }))
    } catch (error) { setErrores((v) => ({ ...v, [id]: error instanceof Error ? error.message : 'Error de conexión.' })) }
    finally { setOcupado((v) => ({ ...v, [id]: false })) }
  }
  return <div className="space-y-3">{familiares.length === 0 ? <p>No se encontraron familiares cargados.</p> : familiares.map((f) => {
    const resultado = resultados[f.id]
    const validado = validados[f.id] || f.dni_validado_at
    const sinDni = !/^\d{7,8}$/.test(dniDesdeRegistro(f.dni))
    return <article key={f.id} className={`rounded-xl border border-zinc-700 p-4 space-y-2 ${sinDni ? 'opacity-50' : ''}`}>
      <p className="font-semibold">{f.apellido}, {f.nombre} — DNI {formatearDni(dniDesdeRegistro(f.dni)) || 'sin cargar'}</p>
      <p className="text-sm text-zinc-400">Titular: DNI {f.persona_dni}</p>
      {resultado && <div><p>Nombre obtenido: {capitalizarNombre(resultado.nombre)}</p><p className={nombresCoinciden(f.apellido, f.nombre, resultado.nombre) ? 'text-emerald-300' : 'text-amber-200'}>{nombresCoinciden(f.apellido, f.nombre, resultado.nombre) ? 'El apellido y nombre coinciden.' : 'Hay diferencias. Revisá el apellido y nombre antes de validar.'}</p></div>}
      {validado ? <p className="text-emerald-300">Validado: {new Date(validado).toLocaleString('es-AR')}</p> : <div className="flex gap-3">
        <button disabled={sinDni || ocupado[f.id]} onClick={() => ejecutar(f.id, 'comprobar')} className="rounded border px-3 py-2 disabled:opacity-50">{ocupado[f.id] ? 'Procesando…' : 'Comprobar DNI'}</button>
        <button disabled={sinDni || ocupado[f.id] || !resultado} onClick={() => ejecutar(f.id, 'validar')} className="rounded bg-emerald-400 text-black px-3 py-2 disabled:opacity-50">Validar familiar</button>
      </div>}
      {errores[f.id] && <p role="alert" className="text-red-300">{errores[f.id]}</p>}
    </article>
  })}</div>
}
