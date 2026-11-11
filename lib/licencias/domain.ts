export type LicenciaTipo = {
  id: number
  nombre: string
  codigo: string | null
  columna_ficha: string | null
  descripcion: string | null
  habilitado_para_carga: boolean
}

export type LicenciaPersona = {
  dni: number
  apellido_nombre: string
  legajo: number | null
  carrera: string
  situacion_revista: string
  funcion: string
  activo: boolean
  reloj?: number | null
  fecha_ingreso?: string | null
  fecha_nacimiento?: string | null
  telefono?: string | null
  domicilio?: string | null
}

export type LicenciaRegistro = {
  id: number
  dni: number
  apellido_nombre: string
  tipo_id: number
  tipo: { nombre: string; codigo: string | null; columna_ficha?: string | null }
  desde: string
  hasta: string
  dias: number
  dias_por_anio?: Record<string, number> | null
  cantidad_dias_ficha?: number | null
  cantidad_ficha: string | null
  observacion: string | null
  anulado_at: string | null
  dni_familiar: number | null
  numero_orden: number | null
  imprevisto_id: number | null
}

export type LicenciaFormState = { status: 'idle' | 'error' | 'success'; message?: string }

export type LicenciaCarga = LicenciaRegistro & {
  created_at: string
  created_by: string | null
  creado_por: string | null
  updated_at: string
  actualizado_por: string | null
  anulado_por: string | null
  motivo_borrado: string | null
  origen: 'manual' | 'importacion'
  version: string
}

export function fechaHoraCarga(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sin fecha registrada'
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

export function personaParaSelector(persona: LicenciaPersona): LicenciaPersona {
  return {
    dni: persona.dni,
    apellido_nombre: persona.apellido_nombre,
    legajo: persona.legajo,
    carrera: persona.carrera,
    situacion_revista: persona.situacion_revista,
    funcion: persona.funcion,
    activo: persona.activo,
  }
}

export function fechaValida(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export function hastaLicencia(desde: string, dias: number) {
  if (!fechaValida(desde) || !Number.isInteger(dias) || dias < 1 || dias > 36500) return null
  const fecha = new Date(`${desde}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias - 1)
  return fecha.toISOString().slice(0, 10)
}

export function fechaVisible(fecha: string | null | undefined) {
  return fecha ? fecha.slice(0, 10).split('-').reverse().join('/') : '—'
}

export function fechaActual() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
}

export function anioConsulta(value: string | undefined) {
  const current = Number(fechaActual().slice(0, 4))
  return value && /^\d{4}$/.test(value) && Number(value) >= 2026 && Number(value) <= current + 1 ? Number(value) : current
}

export function diasEnAnio(registro: LicenciaRegistro, anio: number) {
  if (registro.anulado_at) return 0
  if (registro.dias_por_anio) return registro.dias_por_anio[String(anio)] ?? 0
  const desde = registro.desde > `${anio}-01-01` ? registro.desde : `${anio}-01-01`
  const hasta = registro.hasta < `${anio}-12-31` ? registro.hasta : `${anio}-12-31`
  return hasta < desde ? 0 : Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000) + 1
}

export function primerParametro(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
