'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { contactoDesdeRegistro, versionContacto } from '@/lib/personas/contacto'
import { versionDomicilio } from '@/lib/personas/domicilio'
import { DOMICILIO_FIELDS, type DomicilioValores, type PersonaCampo, type PersonaEditFormProps, type PersonaFormState } from '@/lib/personas/types'
import { DatosDomicilio } from './datos-domicilio'
import { FormField, FormSection, personaInputClass } from './form-field'

const initialState: PersonaFormState = { status: 'idle' }
const steps: { id: string; label: string; fields: readonly PersonaCampo[] }[] = [
  { id: 'identificacion', label: 'Identificación', fields: ['dni', 'cuil', 'apellido', 'nombre', 'fecha_nacimiento', 'sexo_id', 'estado_civil'] },
  { id: 'contacto', label: 'Contacto', fields: ['email', 'telefono', 'contacto_version'] },
  { id: 'laboral', label: 'Datos laborales', fields: ['legajo', 'reloj', 'indice', 'carrera_id', 'situacion_id', 'fecha_ingreso', 'fecha_inicio_tarea_especifica'] },
  { id: 'formacion', label: 'Formación', fields: ['formacion_estudio', 'matricula', 'nivel_escolaridad', 'estado_escolaridad'] },
  { id: 'domicilio', label: 'Domicilio', fields: [...DOMICILIO_FIELDS, 'domicilio_version'] },
  { id: 'observaciones', label: 'Observaciones', fields: ['observacion'] },
]

function stepForField(field: string) {
  return steps.findIndex((step) => step.fields.includes(field as PersonaCampo))
}

function PersonaPanel({ index, active, pending, description, children }: {
  index: number; active: number; pending: boolean; description?: string; children: ReactNode
}) {
  const step = steps[index]
  return <section id={`persona-panel-${step.id}`} role="tabpanel" aria-labelledby={`persona-tab-${step.id}`}
    hidden={active !== index} data-persona-step={index} tabIndex={0} className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
    <FormSection title={step.label} description={description} disabled={pending}>{children}</FormSection>
  </section>
}
type Props = PersonaEditFormProps & {
  action: (state: PersonaFormState, formData: FormData) => Promise<PersonaFormState>
}

export function PersonaForm({ persona, carreras, situaciones, sexos, domicilio, domicilioError, fichaVersion, carreraActualId, situacionActualId, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState)
  // Keep the origin of this draft even if a server refresh brings newer props.
  const [versionFicha] = useState(fichaVersion)
  const contacto = contactoDesdeRegistro(persona)
  const [telefono, setTelefono] = useState(contacto.telefono)
  const [revisado, setRevisado] = useState(false)
  const [navigation, setNavigation] = useState({ step: 0, response: initialState })
  const [clientError, setClientError] = useState<PersonaCampo | null>(null)
  const [edicionDomicilio, setEdicionDomicilio] = useState<{ version: string; base: Partial<DomicilioValores> | null } | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const errorsRef = useRef<HTMLDivElement>(null)
  const initial = { ...persona, ...domicilio, carrera_id: carreraActualId, situacion_id: situacionActualId }
  const errorStep = steps.findIndex((step) => step.fields.some((field) => state.errors?.[field]))
  // A fresh server response opens its first invalid section; subsequent tab choices stay free.
  const activeStep = navigation.response !== state && errorStep >= 0 ? errorStep : navigation.step
  const domicilioModificado = edicionDomicilio !== null
  const domicilioBase = edicionDomicilio ? edicionDomicilio.base : domicilio
  const domicilioVersion = edicionDomicilio?.version ?? versionDomicilio(domicilio)

  function changeStep(index: number, focusTab = false) {
    if (pending) return
    setNavigation({ step: index, response: state })
    if (focusTab) requestAnimationFrame(() => {
      tabRefs.current[index]?.focus()
      tabRefs.current[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }

  function focusField(name: string) {
    const index = stepForField(name)
    if (index >= 0) changeStep(index)
    requestAnimationFrame(() => document.getElementById(name === 'dni' ? 'dni-visible' : name)?.focus())
  }

  function tabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = event.key === 'ArrowRight' ? (index + 1) % steps.length
      : event.key === 'ArrowLeft' ? (index + steps.length - 1) % steps.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : null
    if (target === null) return
    event.preventDefault()
    changeStep(target, true)
  }

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    setNavigation({ step: activeStep, response: state })
    // All sections stay mounted and submit together, including hidden required fields.
    const invalid = Array.from(event.currentTarget.elements).find((element) =>
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)
      && element.willValidate && !element.validity.valid
    ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined
    setClientError(invalid ? invalid.name as PersonaCampo : null)
    if (!invalid) return
    event.preventDefault()
    focusField(invalid.name)
    requestAnimationFrame(() => invalid.reportValidity())
  }

  useEffect(() => {
    if (state.status === 'error') errorsRef.current?.focus()
  }, [state])

  const value = (name: PersonaCampo) => state.values?.[name] ?? String(initial[name as keyof typeof initial] ?? '')
  const attrs = (name: PersonaCampo) => ({
    id: name, name,
    'aria-invalid': state.errors?.[name] || clientError === name ? true : undefined,
    'aria-describedby': [state.errors?.[name] ? `${name}-error` : '', clientError === name ? 'persona-client-error' : ''].filter(Boolean).join(' ') || undefined,
  })
  function input(name: PersonaCampo, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) {
    return <FormField id={name} label={label} error={state.errors?.[name]}>
      <input {...attrs(name)} defaultValue={value(name)} className={personaInputClass} {...props} />
    </FormField>
  }
  function select(name: PersonaCampo, label: string, options: { value: string; label: string }[], required = false) {
    const selected = value(name)
    return <FormField id={name} label={label} error={state.errors?.[name]}>
      <select {...attrs(name)} defaultValue={selected} required={required} className={personaInputClass}>
        <option value="">Seleccionar</option>
        {selected && !options.some((item) => item.value === selected) ? <option value={selected}>Valor actual: {selected}</option> : null}
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </FormField>
  }
  function textarea(name: PersonaCampo, label: string) {
    return <FormField id={name} label={label} error={state.errors?.[name]} className="md:col-span-2">
      <textarea {...attrs(name)} defaultValue={value(name)} rows={3} className={personaInputClass} />
    </FormField>
  }

  return (
    <form action={formAction} noValidate onSubmit={validateBeforeSubmit} onChange={(event) => {
      if (clientError) setClientError(null)
      if (!domicilioError && (event.target as HTMLElement).closest('[data-persona-step="4"]')) {
        setEdicionDomicilio((previous) => previous ?? { version: versionDomicilio(domicilio), base: domicilio })
      }
    }}
      onReset={(event) => event.preventDefault()} aria-busy={pending} className="min-w-0 space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-white sm:p-6">
      <input type="hidden" name="dni" value={persona.dni} />
      <input type="hidden" name="ficha_version" value={versionFicha} />
      <input type="hidden" name="contacto_version" value={versionContacto(persona)} />
      <input type="hidden" name="domicilio_presente" value={domicilioModificado && !domicilioError ? '1' : '0'} />
      <input type="hidden" name="domicilio_version" value={domicilioError ? '' : domicilioVersion} />

      <div className="min-w-0 space-y-3 border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-200">Datos del legajo</p>
          <p aria-live="polite" className="text-xs text-zinc-400">Paso {activeStep + 1} de {steps.length}</p>
        </div>
        <div role="tablist" aria-label="Secciones de la ficha" className="flex min-w-0 gap-2 overflow-x-auto pb-2 md:gap-1">
          {steps.map((step, index) => {
            const errorCount = step.fields.filter((field) => state.errors?.[field] || clientError === field).length
            return <button key={step.id} ref={(element) => { tabRefs.current[index] = element }} type="button" role="tab"
              id={`persona-tab-${step.id}`} aria-controls={`persona-panel-${step.id}`} aria-selected={activeStep === index}
              tabIndex={activeStep === index ? 0 : -1} disabled={pending} onClick={() => changeStep(index)} onKeyDown={(event) => tabKeyDown(event, index)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-60 md:gap-1.5 md:px-2 ${activeStep === index ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
              <span aria-hidden="true" className={`flex size-5 items-center justify-center rounded-full text-[10px] ${activeStep === index ? 'bg-emerald-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'}`}>{index + 1}</span>
              {step.label}
              {errorCount ? <span aria-label={`${errorCount} campos para revisar`} className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-200">{errorCount}</span> : null}
            </button>
          })}
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">Elegí la pestaña que quieras completar. Lo escrito se conserva al cambiar de sección. Los campos con * son obligatorios.</p>
      </div>

      {clientError ? <p id="persona-client-error" role="alert" aria-label="Revisar datos de la ficha" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">Revisá el campo marcado antes de guardar. Los campos con * son obligatorios.</p> : null}

      {state.status === 'error' ? (
        <div ref={errorsRef} tabIndex={-1} role="alert" aria-label="Error al guardar la ficha" className="space-y-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 outline-none focus-visible:ring-2 focus-visible:ring-red-300">
          <p className="font-medium">{state.message}</p>
          {state.errors ? <ul className="list-inside list-disc space-y-1">
            {Object.entries(state.errors).map(([name, message]) => <li key={name}><a href={`#${name === 'dni' ? 'dni-visible' : name}`} onClick={(event) => { event.preventDefault(); focusField(name) }} className="underline underline-offset-4">{message}</a></li>)}
          </ul> : null}
        </div>
      ) : null}

      <PersonaPanel index={0} active={activeStep} pending={pending} description="Datos que identifican a la persona.">
        <FormField id="dni-visible" label="DNI">
          <input id="dni-visible" value={persona.dni} readOnly className={personaInputClass} />
        </FormField>
        {input('cuil', 'CUIL', { inputMode: 'numeric', pattern: '[0-9]{11}' })}
        {input('apellido', 'Apellido *', { required: true, autoComplete: 'family-name' })}
        {input('nombre', 'Nombre *', { required: true, autoComplete: 'given-name' })}
        {input('fecha_nacimiento', 'Fecha de nacimiento', { type: 'date', autoComplete: 'bday' })}
        {select('sexo_id', 'Sexo', sexos.map((item) => ({ value: String(item.id), label: item.nombre })))}
        {select('estado_civil', 'Estado civil', ['casado/a','divorciado/a','separado/a','viudo/a','concubinato','soltero/a'].map((item) => ({ value: item, label: item.charAt(0).toUpperCase() + item.slice(1) })))}
      </PersonaPanel>

      <PersonaPanel index={1} active={activeStep} pending={pending} description="Un solo teléfono o celular de contacto, además del email opcional.">
        {input('email', 'Email', { type: 'email', autoComplete: 'email', maxLength: 254 })}
        <FormField id="telefono" label="Teléfono / celular" error={state.errors?.telefono}>
          <input {...attrs('telefono')} type="tel" autoComplete="tel" maxLength={100}
            value={telefono} onChange={(event) => setTelefono(event.target.value)}
            readOnly={contacto.pendiente && !revisado}
            aria-describedby={`telefono-ayuda${state.errors?.telefono ? ' telefono-error' : ''}${clientError === 'telefono' ? ' persona-client-error' : ''}`}
            className={personaInputClass} />
          <p id="telefono-ayuda" className="mt-2 text-xs text-zinc-400">Podés incluir +, código de área, espacios y extensiones.</p>
        </FormField>
        {contacto.pendiente ? <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 md:col-span-2">
          <p className="font-semibold">Contacto pendiente de revisión</p>
          <p>Hay dos números distintos registrados: <span className="font-medium">{persona.telefono}</span> y <span className="font-medium">{contacto.otroNumero}</span>.</p>
          <p>Podés guardar el resto de la ficha sin cambiarlos. Para conservar un solo número, confirmá la revisión y escribí el teléfono que debe quedar.</p>
          <label className="flex min-h-11 items-center gap-3">
            <input name="confirmar_revision_contacto" type="checkbox" checked={revisado}
              onChange={(event) => {
                setRevisado(event.target.checked)
                if (!event.target.checked) setTelefono(contacto.telefono)
              }} className="size-4 shrink-0 accent-emerald-400" />
            Ya revisé los números y quiero conservar sólo el teléfono escrito arriba.
          </label>
        </div> : null}
      </PersonaPanel>

      <PersonaPanel index={2} active={activeStep} pending={pending} description="Vínculo administrativo, carrera y situación de revista.">
        {input('legajo', 'Legajo', { type: 'number', min: 1, step: 1 })}
        {input('reloj', 'Número de reloj', { type: 'number', min: 1, step: 1 })}
        {input('indice', 'Índice')}
        {select('carrera_id', 'Carrera *', carreras.map((item) => ({ value: String(item.id), label: item.nombre })), true)}
        {select('situacion_id', 'Situación de revista *', situaciones.map((item) => ({ value: String(item.id), label: item.nombre })), true)}
        {input('fecha_ingreso', 'Fecha de ingreso', { type: 'date' })}
        {input('fecha_inicio_tarea_especifica', 'Inicio de tarea específica', { type: 'date' })}
      </PersonaPanel>

      <PersonaPanel index={3} active={activeStep} pending={pending}>
        {textarea('formacion_estudio', 'Formación / estudio')}
        {input('matricula', 'Matrícula', { maxLength: 10 })}
        {select('nivel_escolaridad', 'Nivel de escolaridad', ['secundaria','terciaria','universitario','doctorado','magister','diplomado'].map((item) => ({ value: item, label: item.charAt(0).toUpperCase() + item.slice(1) })))}
        {select('estado_escolaridad', 'Estado de escolaridad', ['completo','incompleto','en curso'].map((item) => ({ value: item, label: item.charAt(0).toUpperCase() + item.slice(1) })))}
      </PersonaPanel>

      <PersonaPanel index={4} active={activeStep} pending={pending || Boolean(domicilioError)} description="Al modificarlo se conserva el domicilio anterior en el historial.">
        {domicilioError ? <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 md:col-span-2">{domicilioError} No edites este domicilio hasta recargar la ficha. Podés guardar las otras secciones sin modificarlo.</p> : null}
        {edicionDomicilio && edicionDomicilio.version !== versionDomicilio(domicilio) ? <p role="status" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 md:col-span-2">El domicilio guardado cambió mientras editabas. Conservamos tu borrador; revisá la versión actual antes de volver a guardarlo.</p> : null}
        <DatosDomicilio key={domicilioVersion} domicilio={Object.fromEntries(DOMICILIO_FIELDS.map((name) => [name, (domicilioModificado ? state.values?.[name] : undefined) ?? domicilioBase?.[name] ?? null]))} />
      </PersonaPanel>

      <PersonaPanel index={5} active={activeStep} pending={pending}>
        {textarea('observacion', 'Observaciones del legajo')}
      </PersonaPanel>

      <div className="space-y-4 border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-400">Guardar cambios guarda lo cargado en todas las pestañas.</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" disabled={pending || activeStep === 0} onClick={() => changeStep(activeStep - 1, true)} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-default disabled:opacity-40">Anterior</button>
            <button type="button" disabled={pending || activeStep === steps.length - 1} onClick={() => changeStep(activeStep + 1, true)} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-default disabled:opacity-40">Siguiente</button>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-60">
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <Link href={`/personas/${persona.dni}`} aria-disabled={pending}
              onClick={(event) => { if (pending) event.preventDefault() }}
              className="min-h-11 rounded-lg border border-zinc-700 px-4 py-3 text-center text-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </form>
  )
}
