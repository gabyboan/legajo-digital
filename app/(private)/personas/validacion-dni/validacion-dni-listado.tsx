'use client'

import { useState } from 'react'

type Persona = {
  dni: number
  apellido: string
  nombre: string
  cuil: number | null
}

type ValidacionPersistida = {
  persona_dni: number
  validado_at: string
}

type ResultadoComprobacion =
  | { estado: 'cargando' }
  | {
      estado: 'correcto'
      nombre: string
      tipo: 'CUIT' | 'CUIL'
      cuit: string
      comprobadoEn: string
      cuilActual: number | null
      inconsistenciaCuit: boolean
    }
  | { estado: 'error'; mensaje: string }

type EdicionNombre = {
  apellido: string
  nombre: string
}

type ValidacionDniListadoProps = {
  personas: Persona[]
  validaciones: ValidacionPersistida[]
  canValidate: boolean
}

function fechaHora(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatoCuit(value: string | number | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '')

  if (!/^\d{11}$/.test(digits)) {
    return '-'
  }

  return [digits.slice(0, 2), digits.slice(2, 10), digits.slice(10)].join('-')
}

function recordFromPayload(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null
}

function stringFromPayload(payload: unknown, property: string) {
  const value = recordFromPayload(payload)?.[property]
  return typeof value === 'string' ? value.trim() : ''
}

function numberFromPayload(payload: unknown, property: string) {
  const value = recordFromPayload(payload)?.[property]
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

function errorFromPayload(payload: unknown, fallback: string) {
  return stringFromPayload(payload, 'error') || fallback
}

function personaFromPayload(payload: unknown): Persona | null {
  const dni = numberFromPayload(payload, 'dni')
  const apellido = stringFromPayload(payload, 'apellido')
  const nombre = stringFromPayload(payload, 'nombre')

  if (!dni || !apellido || !nombre) {
    return null
  }

  const cuil = numberFromPayload(payload, 'cuil')

  return { dni, apellido, nombre, cuil }
}

function normalizedName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function ValidacionDniListado({
  personas: personasIniciales,
  validaciones: validacionesIniciales,
  canValidate,
}: ValidacionDniListadoProps) {
  const [personas, setPersonas] = useState(personasIniciales)
  const [resultados, setResultados] = useState<Record<number, ResultadoComprobacion>>({})
  const [validaciones, setValidaciones] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      validacionesIniciales.map((validacion) => [
        validacion.persona_dni,
        validacion.validado_at,
      ])
    )
  )
  const [guardando, setGuardando] = useState<Record<number, boolean>>({})
  const [erroresValidacion, setErroresValidacion] = useState<Record<number, string>>({})
  const [edicionesNombre, setEdicionesNombre] = useState<Record<number, EdicionNombre>>({})
  const [guardandoNombre, setGuardandoNombre] = useState<Record<number, boolean>>({})
  const [erroresNombre, setErroresNombre] = useState<Record<number, string>>({})

  async function comprobar(dni: number) {
    setResultados((actual) => ({ ...actual, [dni]: { estado: 'cargando' } }))
    setErroresValidacion((actual) => {
      const siguiente = { ...actual }
      delete siguiente[dni]
      return siguiente
    })

    try {
      const response = await fetch('/api/validacion-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni }),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        setResultados((actual) => ({
          ...actual,
          [dni]: {
            estado: 'error',
            mensaje: errorFromPayload(payload, 'No se pudo completar la comprobación.'),
          },
        }))
        return
      }

      const nombre = stringFromPayload(payload, 'nombre')
      const tipo = stringFromPayload(payload, 'tipo')
      const cuit = stringFromPayload(payload, 'cuit').replace(/\D/g, '')
      const comprobadoEn = stringFromPayload(payload, 'comprobadoEn')

      if (
        !nombre ||
        (tipo !== 'CUIT' && tipo !== 'CUIL') ||
        !/^\d{11}$/.test(cuit) ||
        !comprobadoEn
      ) {
        throw new Error('Respuesta incompleta de la comprobación.')
      }

      setResultados((actual) => ({
        ...actual,
        [dni]: {
          estado: 'correcto',
          nombre,
          tipo,
          cuit,
          comprobadoEn,
          cuilActual: numberFromPayload(payload, 'cuilActual'),
          inconsistenciaCuit: recordFromPayload(payload)?.inconsistenciaCuit === true,
        },
      }))
    } catch {
      setResultados((actual) => ({
        ...actual,
        [dni]: {
          estado: 'error',
          mensaje: 'No se pudo completar la comprobación. Intentá nuevamente.',
        },
      }))
    }
  }

  async function validar(dni: number) {
    const resultado = resultados[dni]

    if (resultado?.estado !== 'correcto' || resultado.inconsistenciaCuit || validaciones[dni]) {
      return
    }

    setGuardando((actual) => ({ ...actual, [dni]: true }))
    setErroresValidacion((actual) => {
      const siguiente = { ...actual }
      delete siguiente[dni]
      return siguiente
    })

    try {
      const response = await fetch('/api/validacion-dni/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni }),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        setErroresValidacion((actual) => ({
          ...actual,
          [dni]: errorFromPayload(payload, 'No se pudo guardar la validación.'),
        }))
        return
      }

      const validadoEn = stringFromPayload(payload, 'validadoEn')
      const cuil = numberFromPayload(payload, 'cuil')

      if (!validadoEn || !cuil || !/^\d{11}$/.test(String(cuil))) {
        throw new Error('Respuesta incompleta de la validación.')
      }

      setValidaciones((actual) => ({ ...actual, [dni]: validadoEn }))
      setPersonas((actual) =>
        actual.map((persona) => (persona.dni === dni ? { ...persona, cuil } : persona))
      )
    } catch {
      setErroresValidacion((actual) => ({
        ...actual,
        [dni]: 'No se pudo guardar la validación. Intentá nuevamente.',
      }))
    } finally {
      setGuardando((actual) => ({ ...actual, [dni]: false }))
    }
  }

  function iniciarEdicionNombre(persona: Persona) {
    setEdicionesNombre((actual) => ({
      ...actual,
      [persona.dni]: { apellido: persona.apellido, nombre: persona.nombre },
    }))
    setErroresNombre((actual) => {
      const siguiente = { ...actual }
      delete siguiente[persona.dni]
      return siguiente
    })
  }

  function cancelarEdicionNombre(dni: number) {
    setEdicionesNombre((actual) => {
      const siguiente = { ...actual }
      delete siguiente[dni]
      return siguiente
    })
    setErroresNombre((actual) => {
      const siguiente = { ...actual }
      delete siguiente[dni]
      return siguiente
    })
  }

  function cambiarNombre(dni: number, campo: keyof EdicionNombre, value: string) {
    setEdicionesNombre((actual) => ({
      ...actual,
      [dni]: {
        ...(actual[dni] ?? { apellido: '', nombre: '' }),
        [campo]: value,
      },
    }))
  }

  async function guardarNombre(dni: number) {
    const edicion = edicionesNombre[dni]

    if (!edicion || guardandoNombre[dni]) {
      return
    }

    const apellido = normalizedName(edicion.apellido)
    const nombre = normalizedName(edicion.nombre)

    if (!apellido || !nombre) {
      setErroresNombre((actual) => ({
        ...actual,
        [dni]: 'Completá apellido y nombre.',
      }))
      return
    }

    setGuardandoNombre((actual) => ({ ...actual, [dni]: true }))
    setErroresNombre((actual) => {
      const siguiente = { ...actual }
      delete siguiente[dni]
      return siguiente
    })

    try {
      const response = await fetch('/api/validacion-dni/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, apellido, nombre }),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        setErroresNombre((actual) => ({
          ...actual,
          [dni]: errorFromPayload(payload, 'No se pudo guardar el nombre.'),
        }))
        return
      }

      const persona = personaFromPayload(payload)

      if (!persona) {
        throw new Error('Respuesta incompleta al guardar el nombre.')
      }

      setPersonas((actual) =>
        actual.map((actualPersona) =>
          actualPersona.dni === dni
            ? { ...actualPersona, apellido: persona.apellido, nombre: persona.nombre }
            : actualPersona
        )
      )
      cancelarEdicionNombre(dni)
    } catch {
      setErroresNombre((actual) => ({
        ...actual,
        [dni]: 'No se pudo guardar el nombre. Intentá nuevamente.',
      }))
    } finally {
      setGuardandoNombre((actual) => ({ ...actual, [dni]: false }))
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
      <table className="min-w-[1320px] divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/60 text-zinc-400">
          <tr>
            <th className="px-4 py-3 text-left font-medium">DNI</th>
            <th className="px-4 py-3 text-left font-medium">Nombre en legajo</th>
            <th className="px-4 py-3 text-left font-medium">Nombre del scraper</th>
            <th className="px-4 py-3 text-left font-medium">CUIT/CUIL</th>
            <th className="px-4 py-3 text-left font-medium">Validado</th>
            <th className="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {personas.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                No se encontraron personas.
              </td>
            </tr>
          ) : (
            personas.map((persona) => {
              const resultado = resultados[persona.dni]
              const validadoEn = validaciones[persona.dni]
              const cargando = resultado?.estado === 'cargando'
              const guardandoEstaFila = guardando[persona.dni] === true
              const editandoNombre = edicionesNombre[persona.dni]
              const guardandoEsteNombre = guardandoNombre[persona.dni] === true
              const puedeValidar =
                canValidate && resultado?.estado === 'correcto' && !resultado.inconsistenciaCuit && !validadoEn

              return (
                <tr key={persona.dni} className="hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-medium">{persona.dni}</td>
                  <td className="px-4 py-3">
                    {editandoNombre ? (
                      <div className="min-w-64 space-y-2">
                        <input
                          aria-label="Apellido"
                          value={editandoNombre.apellido}
                          onChange={(event) =>
                            cambiarNombre(persona.dni, 'apellido', event.target.value)
                          }
                          className="w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
                          placeholder="Apellido"
                        />
                        <input
                          aria-label="Nombre"
                          value={editandoNombre.nombre}
                          onChange={(event) =>
                            cambiarNombre(persona.dni, 'nombre', event.target.value)
                          }
                          className="w-full rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm"
                          placeholder="Nombre"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => guardarNombre(persona.dni)}
                            disabled={!canValidate || guardandoEsteNombre}
                            className="rounded border border-sky-400/60 px-2 py-1 text-xs font-medium text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {guardandoEsteNombre ? 'Guardando…' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelarEdicionNombre(persona.dni)}
                            disabled={guardandoEsteNombre}
                            className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                        {erroresNombre[persona.dni] ? (
                          <span className="block text-xs text-red-300" aria-live="polite">
                            {erroresNombre[persona.dni]}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>
                          {persona.apellido}, {persona.nombre}
                        </span>
                        <button
                          type="button"
                          onClick={() => iniciarEdicionNombre(persona)}
                          disabled={!canValidate || guardandoEstaFila}
                          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {resultado?.estado === 'correcto' ? (
                      <>
                        <span>{resultado.nombre}</span>
                        <span className="mt-1 block text-xs text-zinc-600">
                          Comprobado {fechaHora(resultado.comprobadoEn)}
                        </span>
                      </>
                    ) : (
                      '-'
                    )}
                    {resultado?.estado === 'error' ? (
                      <span className="block max-w-sm text-xs text-red-300" aria-live="polite">
                        {resultado.mensaje}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {resultado?.estado === 'correcto' ? (
                      <div className="space-y-1">
                        <span className="block text-zinc-300">
                          Fuente: {resultado.tipo} {formatoCuit(resultado.cuit)}
                        </span>
                        {resultado.inconsistenciaCuit ? (
                          <span role="alert" className="block text-xs text-red-300">Inconsistencia: cargado {formatoCuit(resultado.cuilActual)}; obtenido {formatoCuit(resultado.cuit)}. Revisá el dato antes de validar. No se reemplazar?.</span>
                        ) : validadoEn ? (
                          <span className="block text-xs text-emerald-300">
                            Guardado: {formatoCuit(persona.cuil)}
                          </span>
                        ) : (
                          <span className="block text-xs text-amber-200">
                            Se guardará al validar
                          </span>
                        )}
                      </div>
                    ) : persona.cuil ? (
                      <span className="text-zinc-400">{formatoCuit(persona.cuil)}</span>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {validadoEn ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
                        ✓ Validado {fechaHora(validadoEn)}
                      </span>
                    ) : resultado?.estado === 'correcto' ? (
                      <span className="text-xs text-amber-200">Pendiente de validar</span>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => comprobar(persona.dni)}
                        disabled={
                          !canValidate || cargando || guardandoEstaFila || Boolean(validadoEn)
                        }
                        className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {validadoEn
                          ? 'Comprobado'
                          : cargando
                            ? 'Comprobando…'
                            : resultado?.estado === 'correcto'
                              ? 'Comprobar de nuevo'
                              : 'Comprobar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => validar(persona.dni)}
                        disabled={!puedeValidar || guardandoEstaFila}
                        className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {validadoEn
                          ? '✓ Validado'
                          : guardandoEstaFila
                            ? 'Guardando…'
                            : '✓ Validar'}
                      </button>
                    </div>
                    {erroresValidacion[persona.dni] ? (
                      <span className="mt-2 block text-xs text-red-300" aria-live="polite">
                        {erroresValidacion[persona.dni]}
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
