'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { capitalizarNombre, nombresCoinciden } from '@/lib/nombres'
import { formatearDni } from '@/lib/dni'
import type { ConsultaNombreFamiliar, FuenteFamiliar, IntentoFamiliar } from '@/lib/consulta-familiar-types'

type Props = { personaDni: number; dni: string; apellido: string; nombre: string }
const fuentes: Record<FuenteFamiliar, string> = { cuitonline: 'CuitOnline', nosis: 'Nosis', dateas: 'Dateas' }
const estados: Record<IntentoFamiliar['estado'], string> = {
  con_datos: 'Con datos', sin_resultados: 'Sin coincidencias', bloqueado: 'Acceso restringido', error: 'No disponible',
}

export function ComprobarNombreFamiliar({ personaDni, dni, apellido, nombre }: Props) {
  const [resultado, setResultado] = useState<ConsultaNombreFamiliar | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const solicitud = useRef<AbortController | null>(null)
  const { pending } = useFormStatus()
  useEffect(() => () => solicitud.current?.abort(), [])
  const puedeComprobar = /^\d{7,8}$/.test(dni)
  const puedeComparar = Boolean(apellido.trim() && nombre.trim())

  async function comprobar() {
    if (!puedeComprobar || solicitud.current) return
    const controller = new AbortController()
    solicitud.current = controller
    setCargando(true)
    setError('')
    setResultado(null)
    try {
      const response = await fetch('/api/validacion-dni/familiar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'comprobar-nombre', personaDni, dni }),
        signal: controller.signal,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar el DNI.')
      if (data.dni !== dni.padStart(8, '0') || !Array.isArray(data.intentos)) {
        throw new Error('No se obtuvo una respuesta válida para este DNI.')
      }
      if (!controller.signal.aborted) setResultado(data)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudo consultar el DNI.')
    } finally {
      if (!controller.signal.aborted) setCargando(false)
      if (solicitud.current === controller) solicitud.current = null
    }
  }

  const hayDatos = resultado?.intentos.some((intento) => intento.resultados.length > 0)
  const todasSinDatos = resultado?.intentos.every((intento) => intento.estado === 'sin_resultados')

  return <div className="space-y-3 border-t border-zinc-700 pt-3">
    <button type="button" onClick={comprobar} disabled={!puedeComprobar || cargando || pending}
      className="rounded-lg border border-sky-500/50 px-3 py-2 text-sm font-medium text-sky-200 disabled:cursor-not-allowed disabled:opacity-40">
      {cargando ? 'Consultando DNI…' : 'Consultar apellido y nombre por DNI'}
    </button>
    <p className="text-xs text-zinc-400">
      Ingresá el DNI del familiar para ver el apellido y nombre que devuelven CuitOnline, Nosis y Dateas.
    </p>
    <div aria-live="polite" aria-busy={cargando} className="space-y-3">
      {cargando && <p className="text-sm text-sky-200">Consultando las tres fuentes. La búsqueda puede demorar unos minutos.</p>}
      {resultado && <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm">
        <p className="font-medium">Resultados para el DNI {formatearDni(resultado.dni)}</p>
        {resultado.requiereRevision && <p className="text-amber-200">
          Hay distintos CUIT/CUIL o diferencias entre los nombres publicados. Revisá todas las coincidencias.
        </p>}
        {!hayDatos && <p className="text-amber-200">{todasSinDatos
          ? 'Las fuentes consultadas no encontraron coincidencias para este DNI.'
          : 'No se obtuvieron nombres. Algunas fuentes no pudieron completar la consulta; revisá sus estados.'}</p>}
        {puedeComparar && <p><span className="text-zinc-400">Ingresado:</span> {apellido} {nombre}</p>}
        {resultado.intentos.map((intento) => <div key={intento.fuente} className="space-y-2 border-t border-zinc-800 pt-3">
          <p><span className="font-medium">{fuentes[intento.fuente]}</span>
            <span className="ml-2 text-xs text-zinc-400">{estados[intento.estado]}</span></p>
          {intento.detalle && <p className="text-xs text-amber-200">{intento.detalle}</p>}
          {intento.resultados.map((dato, index) => <div key={dato.numero + ':' + index} className="space-y-1">
            <p><span className="text-zinc-400">Apellido y nombre:</span> {capitalizarNombre(dato.nombre)}</p>
            <p className="text-xs text-zinc-400">CUIT/CUIL de referencia: {dato.numero.slice(0, 2)}-{dato.numero.slice(2, 10)}-{dato.numero.slice(10)}</p>
            {puedeComparar && (nombresCoinciden(apellido, nombre, dato.nombre)
              ? <p className="text-emerald-300">El apellido y nombre coinciden con lo ingresado.</p>
              : <p className="text-amber-200">Hay diferencias con el apellido y nombre ingresados.</p>)}
          </div>)}
        </div>)}
        <p className="text-xs text-zinc-400">Revisá los resultados y completá el formulario. La consulta no guarda ni valida al familiar.</p>
      </div>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  </div>
}
