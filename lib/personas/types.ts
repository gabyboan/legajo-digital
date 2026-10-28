export type OpcionCatalogo = { id: number; nombre: string }

export const DOMICILIO_FIELDS = [
  'calle', 'numero', 'barrio', 'manzana', 'lote', 'casa', 'torre', 'monoblock', 'piso',
  'departamento', 'referencias', 'otros_datos', 'provincia_georef_id',
  'provincia_nombre', 'localidad_georef_id', 'localidad_nombre',
] as const

export type DomicilioCampo = (typeof DOMICILIO_FIELDS)[number]
export type DomicilioValores = Record<DomicilioCampo, string | null>

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

export type PersonaEditable = FichaPersonaValores & {
  dni: number
  legajo: number | null
  apellido: string
  nombre: string
  email: string | null
  telefono: string | null
  fecha_nacimiento: string | null
}

export type PersonaEditFormProps = {
  fichaVersion: string
  persona: PersonaEditable
  situaciones: OpcionCatalogo[]
  carreras: OpcionCatalogo[]
  sexos: OpcionCatalogo[]
  domicilio: Partial<DomicilioValores> | null
  domicilioError?: string | null
  situacionActualId: string
  carreraActualId: string
}

export const PERSONA_FIELDS = [
  'dni', 'apellido', 'nombre', 'fecha_nacimiento', 'email', 'telefono',
  'legajo', 'carrera_id', 'situacion_id', 'cuil', 'reloj', 'indice', 'sexo_id',
  'estado_civil', 'fecha_ingreso', 'formacion_estudio', 'matricula',
  'nivel_escolaridad', 'estado_escolaridad', 'fecha_inicio_tarea_especifica',
  'observacion', 'ficha_version', 'contacto_version', 'domicilio_version', ...DOMICILIO_FIELDS,
] as const

export type PersonaCampo = (typeof PERSONA_FIELDS)[number]
export type PersonaFieldErrors = Partial<Record<PersonaCampo, string>>
export type PersonaFormState = {
  status: 'idle' | 'error'
  message?: string
  errors?: PersonaFieldErrors
  values?: Partial<Record<PersonaCampo, string>>
}

export type DatosPersona = {
  version: string | null
  identificacion: {
    dni: number; apellido: string; nombre: string; fechaNacimiento: string | null
    cuil: number | null; sexoId: number | null; estadoCivil: string | null
  }
  contacto: {
    email: string | null; telefono: string | null
    version: string | null; confirmarRevision: boolean
  }
  laboral: {
    legajo: number | null; carreraId: number; situacionId: number
    reloj: number | null; indice: string | null; fechaIngreso: string | null
    fechaInicioTareaEspecifica: string | null
  }
  formacion: {
    estudio: string | null; matricula: string | null
    nivel: string | null; estado: string | null
  }
  domicilio: { valores: DomicilioValores; version: string | null } | null
  observaciones: string | null
}
