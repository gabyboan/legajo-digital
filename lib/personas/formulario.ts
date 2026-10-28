import 'server-only'
import { errorTelefono } from './contacto'
import {
  DOMICILIO_FIELDS, PERSONA_FIELDS,
  type DatosPersona, type DomicilioValores, type PersonaCampo,
  type PersonaFieldErrors, type PersonaFormState,
} from './types'

export function valoresPersona(formData: FormData) {
  return Object.fromEntries(PERSONA_FIELDS.map((name) => {
    const raw = formData.get(name)
    return [name, typeof raw === 'string' ? raw : '']
  })) as NonNullable<PersonaFormState['values']>
}

export function validarPersona(formData: FormData, options: { validarContacto?: boolean } = {}):
  | { ok: true; datos: DatosPersona; values: NonNullable<PersonaFormState['values']> }
  | { ok: false; state: PersonaFormState } {
  const errors: PersonaFieldErrors = {}
  const values = valoresPersona(formData)
  for (const name of PERSONA_FIELDS) {
    const raw = formData.get(name)
    if (raw !== null && typeof raw !== 'string') errors[name] = 'Ingresá un valor de texto.'
    if (formData.getAll(name).length > 1) errors[name] = 'El campo se recibió más de una vez. Volvé a cargar el formulario.'
  }
  const text = (name: PersonaCampo) => values[name]?.trim() || null
  const integer = (name: PersonaCampo, label: string, required = false) => {
    const raw = text(name)
    if (!raw) {
      if (required) errors[name] = `Completá ${label}.`
      return null
    }
    const value = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value <= 0) {
      errors[name] = `Ingresá ${label} como un número entero mayor que cero.`
      return null
    }
    return value
  }
  const date = (name: PersonaCampo) => {
    const raw = text(name)
    if (raw) {
      const parsed = new Date(`${raw}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
        errors[name] = 'Ingresá una fecha válida.'
      }
    }
    return raw
  }

  const dni = integer('dni', 'el DNI', true)
  if (text('dni') && !/^\d{7,8}$/.test(text('dni')!)) errors.dni = 'El DNI debe tener 7 u 8 dígitos.'
  const apellido = text('apellido') ?? ''
  const nombre = text('nombre') ?? ''
  if (!apellido) errors.apellido = 'Completá el apellido.'
  if (!nombre) errors.nombre = 'Completá el nombre.'
  const email = text('email')
  if (email && (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254)) errors.email = 'Ingresá un email válido.'
  const telefono = text('telefono')
  const telefonoError = errorTelefono(telefono)
  if (options.validarContacto !== false && telefonoError) errors.telefono = telefonoError
  const cuil = integer('cuil', 'el CUIL')
  if (text('cuil') && (!/^[1-9]\d{10}$/.test(text('cuil')!) || !cuil)) errors.cuil = 'El CUIL debe tener 11 dígitos.'
  const matricula = text('matricula')
  if (matricula && matricula.length > 10) errors.matricula = 'La matrícula admite hasta 10 caracteres.'

  const datos: DatosPersona = {
    version: text('ficha_version'),
    identificacion: {
      dni: dni ?? 0, apellido, nombre, cuil,
      fechaNacimiento: date('fecha_nacimiento'), sexoId: integer('sexo_id', 'el sexo seleccionado'),
      estadoCivil: text('estado_civil'),
    },
    contacto: {
      email, telefono, version: text('contacto_version'),
      confirmarRevision: formData.get('confirmar_revision_contacto') === 'on',
    },
    laboral: {
      legajo: integer('legajo', 'el legajo'),
      carreraId: integer('carrera_id', 'la carrera', true) ?? 0,
      situacionId: integer('situacion_id', 'la situación de revista', true) ?? 0,
      reloj: integer('reloj', 'el número de reloj'), indice: text('indice'),
      fechaIngreso: date('fecha_ingreso'), fechaInicioTareaEspecifica: date('fecha_inicio_tarea_especifica'),
    },
    formacion: { estudio: text('formacion_estudio'), matricula, nivel: text('nivel_escolaridad'), estado: text('estado_escolaridad') },
    domicilio: formData.get('domicilio_presente') === '1'
      ? { valores: Object.fromEntries(DOMICILIO_FIELDS.map((name) => [name, text(name)])) as DomicilioValores, version: text('domicilio_version') }
      : null,
    observaciones: text('observacion'),
  }
  if (Object.keys(errors).length) {
    return { ok: false, state: { status: 'error', message: 'Revisá los campos marcados. Tus cambios se conservan en el formulario.', errors, values } }
  }
  return { ok: true, datos, values }
}
