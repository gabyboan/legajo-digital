'use client'

import { useEffect, useState } from 'react'

import type { DomicilioValores } from '@/lib/personas/types'
import { FormField as Field, personaInputClass as inputClass } from './form-field'

type GeorefOption = { id: string; nombre: string }

type Props = { domicilio?: Partial<DomicilioValores> | null }

export function DatosDomicilio({ domicilio }: Props) {
  const [provincias, setProvincias] = useState<GeorefOption[]>([])
  const [localidades, setLocalidades] = useState<GeorefOption[]>([])
  const [cargandoProvincias, setCargandoProvincias] = useState(true)
  const [cargandoLocalidades, setCargandoLocalidades] = useState(Boolean(domicilio?.provincia_georef_id))
  const [errorGeoref, setErrorGeoref] = useState<string | null>(null)
  const [provinciaId, setProvinciaId] = useState(
    domicilio?.provincia_georef_id ?? ''
  )
  const [provinciaNombre, setProvinciaNombre] = useState(
    domicilio?.provincia_nombre ?? ''
  )
  const [localidadId, setLocalidadId] = useState(
    domicilio?.localidad_georef_id ?? ''
  )
  const [localidadNombre, setLocalidadNombre] = useState(
    domicilio?.localidad_nombre ?? ''
  )

  useEffect(() => {
    let activo = true

    async function cargarProvincias() {
      try {
        const response = await fetch('/api/georef/provincias')
        const body = (await response.json()) as {
          options?: GeorefOption[]
          error?: string
        }

        if (!response.ok) throw new Error(body.error ?? 'No se pudieron cargar las provincias.')
        if (activo) setProvincias(body.options ?? [])
      } catch (error) {
        if (activo) setErrorGeoref(error instanceof Error ? error.message : 'No se pudieron cargar las provincias.')
      } finally {
        if (activo) setCargandoProvincias(false)
      }
    }

    void cargarProvincias()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!provinciaId) {
      return
    }

    let activo = true

    async function cargarLocalidades() {
      try {
        const response = await fetch(
          `/api/georef/localidades?provincia_id=${encodeURIComponent(provinciaId)}`
        )
        const body = (await response.json()) as {
          options?: GeorefOption[]
          error?: string
        }

        if (!response.ok) throw new Error(body.error ?? 'No se pudieron cargar las localidades.')
        if (activo) setLocalidades(body.options ?? [])
      } catch (error) {
        if (activo) setErrorGeoref(error instanceof Error ? error.message : 'No se pudieron cargar las localidades.')
      } finally {
        if (activo) setCargandoLocalidades(false)
      }
    }

    void cargarLocalidades()
    return () => {
      activo = false
    }
  }, [provinciaId])

  function cambiarProvincia(id: string) {
    setCargandoLocalidades(Boolean(id))
    setLocalidades([])
    setErrorGeoref(null)
    const provincia = provincias.find((item) => item.id === id)
    setProvinciaId(id)
    setProvinciaNombre(provincia?.nombre ?? '')
    setLocalidadId('')
    setLocalidadNombre('')
  }

  function cambiarLocalidad(id: string) {
    const localidad = localidades.find((item) => item.id === id)
    setLocalidadId(id)
    setLocalidadNombre(localidad?.nombre ?? '')
  }

  return (
    <>
      <input type="hidden" name="provincia_georef_id" value={provinciaId} />
      <input type="hidden" name="provincia_nombre" value={provinciaNombre} />
      <input type="hidden" name="localidad_georef_id" value={localidadId} />
      <input type="hidden" name="localidad_nombre" value={localidadNombre} />

      <Field id="provincia_selector" label="Provincia">
        <select id="provincia_selector" value={provinciaId} onChange={(event) => cambiarProvincia(event.target.value)} disabled={cargandoProvincias} className={inputClass}>
          <option value="">{cargandoProvincias ? 'Cargando…' : 'Seleccionar'}</option>
          {provinciaId && !provincias.some((item) => item.id === provinciaId) ? <option value={provinciaId}>{provinciaNombre || provinciaId}</option> : null}
          {provincias.map((provincia) => <option key={provincia.id} value={provincia.id}>{provincia.nombre}</option>)}
        </select>
      </Field>
      <Field id="localidad_selector" label="Ciudad / localidad">
        <select id="localidad_selector" value={localidadId} onChange={(event) => cambiarLocalidad(event.target.value)} disabled={!provinciaId || cargandoLocalidades} className={inputClass}>
          <option value="">{cargandoLocalidades ? 'Cargando…' : 'Seleccionar'}</option>
          {localidadId && !localidades.some((item) => item.id === localidadId) ? <option value={localidadId}>{localidadNombre || localidadId}</option> : null}
          {localidades.map((localidad) => <option key={localidad.id} value={localidad.id}>{localidad.nombre}</option>)}
        </select>
      </Field>
      {errorGeoref ? <p className="text-sm text-amber-300 md:col-span-2">Georef: {errorGeoref}</p> : null}
      <Field id="calle" label="Calle">
        <input id="calle" name="calle" type="text" defaultValue={domicilio?.calle ?? ''} className={inputClass} />
      </Field>
      <Field id="numero" label="Número">
        <input id="numero" name="numero" type="text" defaultValue={domicilio?.numero ?? ''} className={inputClass} />
      </Field>
      <Field id="barrio" label="Barrio">
        <input id="barrio" name="barrio" type="text" defaultValue={domicilio?.barrio ?? ''} className={inputClass} />
      </Field>
      <Field id="manzana" label="Manzana">
        <input id="manzana" name="manzana" type="text" defaultValue={domicilio?.manzana ?? ''} className={inputClass} />
      </Field>
      <Field id="lote" label="Lote">
        <input id="lote" name="lote" type="text" defaultValue={domicilio?.lote ?? ''} className={inputClass} />
      </Field>
      <Field id="casa" label="Casa">
        <input id="casa" name="casa" type="text" defaultValue={domicilio?.casa ?? ''} className={inputClass} />
      </Field>
      <Field id="torre" label="Torre">
        <input id="torre" name="torre" type="text" defaultValue={domicilio?.torre ?? ''} className={inputClass} />
      </Field>
      <Field id="monoblock" label="Monoblock">
        <input id="monoblock" name="monoblock" type="text" defaultValue={domicilio?.monoblock ?? ''} className={inputClass} />
      </Field>
      <Field id="piso" label="Piso">
        <input id="piso" name="piso" type="text" defaultValue={domicilio?.piso ?? ''} className={inputClass} />
      </Field>
      <Field id="departamento" label="Departamento">
        <input id="departamento" name="departamento" type="text" defaultValue={domicilio?.departamento ?? ''} className={inputClass} />
      </Field>
      <Field id="referencias" label="Puntos de referencia" className="md:col-span-2">
        <textarea id="referencias" name="referencias" rows={2} defaultValue={domicilio?.referencias ?? ''} className={inputClass} />
      </Field>
      <Field id="otros_datos" label="Otros datos del domicilio" className="md:col-span-2">
        <textarea id="otros_datos" name="otros_datos" rows={2} defaultValue={domicilio?.otros_datos ?? ''} className={inputClass} />
      </Field>
    </>
  )
}
