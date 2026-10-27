'use client'

import { useEffect, useState } from 'react'

export type OpcionCatalogo = {
  id: number
  nombre: string
}

export type DomicilioValores = {
  calle: string | null
  numero: string | null
  barrio: string | null
  manzana: string | null
  lote: string | null
  monoblock: string | null
  piso: string | null
  departamento: string | null
  referencias: string | null
  otros_datos: string | null
  provincia_georef_id: string | null
  provincia_nombre: string | null
  localidad_georef_id: string | null
  localidad_nombre: string | null
}

export type FichaPersonaValores = {
  cuil: number | null
  reloj: number | null
  indice: string | null
  sexo_id: number | null
  numero_contacto: number | null
  estado_civil: string | null
  fecha_ingreso: string | null
  formacion_estudio: string | null
  matricula: string | null
  nivel_escolaridad: string | null
  estado_escolaridad: string | null
  fecha_inicio_tarea_especifica: string | null
  observacion: string | null
}

type GeorefOption = { id: string; nombre: string }

type Props = {
  sexos: OpcionCatalogo[]
  ficha?: Partial<FichaPersonaValores>
  domicilio?: Partial<DomicilioValores> | null
}

const inputClass =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-500'

function Field({
  id,
  label,
  children,
  className = '',
}: {
  id: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  )
}

export function DatosFichaAdicionales({ sexos, ficha = {}, domicilio }: Props) {
  const [provincias, setProvincias] = useState<GeorefOption[]>([])
  const [localidades, setLocalidades] = useState<GeorefOption[]>([])
  const [cargandoProvincias, setCargandoProvincias] = useState(true)
  const [cargandoLocalidades, setCargandoLocalidades] = useState(false)
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
      <div className="border-t border-zinc-800 pt-5 md:col-span-2">
        <h2 className="text-lg font-semibold">Datos de identificación y contacto</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Campos opcionales para completar gradualmente el legajo.
        </p>
      </div>

      <Field id="cuil" label="CUIL">
        <input id="cuil" name="cuil" type="number" min="10000000000" max="99999999999" defaultValue={ficha.cuil ?? ''} className={inputClass} />
      </Field>
      <Field id="reloj" label="Número de reloj">
        <input id="reloj" name="reloj" type="number" min="1" defaultValue={ficha.reloj ?? ''} className={inputClass} />
      </Field>
      <Field id="indice" label="Índice">
        <input id="indice" name="indice" type="text" defaultValue={ficha.indice ?? ''} className={inputClass} />
      </Field>
      <Field id="sexo_id" label="Sexo">
        <select id="sexo_id" name="sexo_id" defaultValue={ficha.sexo_id ? String(ficha.sexo_id) : ''} className={inputClass}>
          <option value="">Sin especificar</option>
          {sexos.map((sexo) => <option key={sexo.id} value={sexo.id}>{sexo.nombre}</option>)}
        </select>
      </Field>
      <Field id="numero_contacto" label="Número de contacto">
        <input id="numero_contacto" name="numero_contacto" type="number" min="1" defaultValue={ficha.numero_contacto ?? ''} className={inputClass} />
      </Field>
      <Field id="estado_civil" label="Estado civil">
        <select id="estado_civil" name="estado_civil" defaultValue={ficha.estado_civil ?? ''} className={inputClass}>
          <option value="">Seleccionar</option>
          <option value="casado/a">Casado/a</option>
          <option value="divorciado/a">Divorciado/a</option>
          <option value="separado/a">Separado/a</option>
          <option value="viudo/a">Viudo/a</option>
          <option value="concubinato">Concubinato</option>
          <option value="soltero/a">Soltero/a</option>
        </select>
      </Field>

      <div className="border-t border-zinc-800 pt-5 md:col-span-2">
        <h2 className="text-lg font-semibold">Formación y antecedentes</h2>
      </div>
      <Field id="fecha_ingreso" label="Fecha de ingreso">
        <input id="fecha_ingreso" name="fecha_ingreso" type="date" defaultValue={ficha.fecha_ingreso ?? ''} className={inputClass} />
      </Field>
      <Field id="fecha_inicio_tarea_especifica" label="Inicio de tarea específica">
        <input id="fecha_inicio_tarea_especifica" name="fecha_inicio_tarea_especifica" type="date" defaultValue={ficha.fecha_inicio_tarea_especifica ?? ''} className={inputClass} />
      </Field>
      <Field id="formacion_estudio" label="Formación / estudio" className="md:col-span-2">
        <textarea id="formacion_estudio" name="formacion_estudio" rows={3} defaultValue={ficha.formacion_estudio ?? ''} className={inputClass} />
      </Field>
      <Field id="matricula" label="Matrícula">
        <input id="matricula" name="matricula" type="text" maxLength={10} defaultValue={ficha.matricula ?? ''} className={inputClass} />
      </Field>
      <Field id="nivel_escolaridad" label="Nivel de escolaridad">
        <select id="nivel_escolaridad" name="nivel_escolaridad" defaultValue={ficha.nivel_escolaridad ?? ''} className={inputClass}>
          <option value="">Seleccionar</option>
          <option value="secundaria">Secundaria</option>
          <option value="terciaria">Terciaria</option>
          <option value="universitario">Universitario</option>
          <option value="doctorado">Doctorado</option>
          <option value="magister">Magister</option>
          <option value="diplomado">Diplomado</option>
        </select>
      </Field>
      <Field id="estado_escolaridad" label="Estado de escolaridad">
        <select id="estado_escolaridad" name="estado_escolaridad" defaultValue={ficha.estado_escolaridad ?? ''} className={inputClass}>
          <option value="">Seleccionar</option>
          <option value="completo">Completo</option>
          <option value="incompleto">Incompleto</option>
          <option value="en curso">En curso</option>
        </select>
      </Field>
      <Field id="observacion" label="Observaciones" className="md:col-span-2">
        <textarea id="observacion" name="observacion" rows={3} defaultValue={ficha.observacion ?? ''} className={inputClass} />
      </Field>

      <div className="border-t border-zinc-800 pt-5 md:col-span-2">
        <h2 className="text-lg font-semibold">Domicilio</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Al modificarlo se conserva el domicilio anterior en el historial.
        </p>
      </div>
      <input type="hidden" name="domicilio_presente" value="1" />
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