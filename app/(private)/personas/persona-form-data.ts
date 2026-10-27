import 'server-only'

const ADDRESS_FIELDS = [
  'calle',
  'numero',
  'barrio',
  'manzana',
  'lote',
  'monoblock',
  'piso',
  'departamento',
  'referencias',
  'otros_datos',
  'provincia_georef_id',
  'provincia_nombre',
  'localidad_georef_id',
  'localidad_nombre',
] as const

type AddressField = (typeof ADDRESS_FIELDS)[number]

function nullableString(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function nullableInteger(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (text === '') return { value: null, valid: true }
  if (!/^\d+$/.test(text)) return { value: null, valid: false }

  const number = Number(text)
  return { value: Number.isSafeInteger(number) ? number : null, valid: Number.isSafeInteger(number) }
}

function nullableDate(value: FormDataEntryValue | null) {
  return nullableString(value)
}

function nullableMaxLength(value: FormDataEntryValue | null, maxLength: number) {
  const text = nullableString(value)
  return text === null ? null : text.slice(0, maxLength)
}

export function datosPersonalesFromFormData(formData: FormData) {
  return {
    apellido: String(formData.get('apellido') ?? '').trim(),
    nombre: String(formData.get('nombre') ?? '').trim(),
    fecha_nacimiento: nullableDate(formData.get('fecha_nacimiento')),
    email: nullableString(formData.get('email')),
    telefono: nullableString(formData.get('telefono')),
  }
}

export function datosLaboralesFromFormData(formData: FormData) {
  const legajo = nullableInteger(formData.get('legajo'))
  const carreraId = nullableInteger(formData.get('carrera_id'))
  const situacionId = nullableInteger(formData.get('situacion_id'))

  return {
    legajo: legajo.value,
    carreraId: carreraId.value,
    situacionId: situacionId.value,
    numerosValidos: legajo.valid && carreraId.valid && situacionId.valid,
  }
}

export function datosFichaFromFormData(formData: FormData) {
  const cuil = nullableInteger(formData.get('cuil'))
  const reloj = nullableInteger(formData.get('reloj'))
  const sexoId = nullableInteger(formData.get('sexo_id'))
  const numeroContacto = nullableInteger(formData.get('numero_contacto'))

  const domicilio = Object.fromEntries(
    ADDRESS_FIELDS.map((field) => [field, nullableString(formData.get(field))])
  ) as Record<AddressField, string | null>

  return {
    cuil: cuil.value,
    reloj: reloj.value,
    indice: nullableString(formData.get('indice')),
    sexoId: sexoId.value,
    numeroContacto: numeroContacto.value,
    estadoCivil: nullableString(formData.get('estado_civil')),
    fechaIngreso: nullableDate(formData.get('fecha_ingreso')),
    formacionEstudio: nullableString(formData.get('formacion_estudio')),
    matricula: nullableMaxLength(formData.get('matricula'), 10),
    nivelEscolaridad: nullableString(formData.get('nivel_escolaridad')),
    estadoEscolaridad: nullableString(formData.get('estado_escolaridad')),
    fechaInicioTareaEspecifica: nullableDate(
      formData.get('fecha_inicio_tarea_especifica')
    ),
    observacion: nullableString(formData.get('observacion')),
    domicilio,
    numerosValidos:
      cuil.valid && reloj.valid && sexoId.valid && numeroContacto.valid,
  }
}