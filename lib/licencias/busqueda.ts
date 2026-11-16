import { personaParaSelector, type LicenciaPersona } from './domain'

export const BUSQUEDA_TIMEOUT_MS = 15_000

function esPersona(value: unknown): value is LicenciaPersona {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.dni === 'number' && Number.isSafeInteger(row.dni) && row.dni > 0 && row.dni <= 99_999_999
    && typeof row.apellido_nombre === 'string' && Boolean(row.apellido_nombre.trim())
    && (row.legajo === null || typeof row.legajo === 'number' && Number.isSafeInteger(row.legajo))
    && typeof row.activo === 'boolean'
    && ['carrera', 'situacion_revista', 'funcion'].every((field) => typeof row[field] === 'string')
}

// Validate the network boundary before putting data into React state.
export function personasDeRespuesta(value: unknown): LicenciaPersona[] | null {
  if (!value || typeof value !== 'object' || !('personas' in value) || !Array.isArray(value.personas) || value.personas.length > 100) return null
  const dnis = new Set<number>()
  const personas: LicenciaPersona[] = []
  for (const row of value.personas as unknown[]) {
    if (!esPersona(row) || dnis.has(row.dni)) return null
    dnis.add(row.dni)
    personas.push(personaParaSelector(row))
  }
  return personas
}

export function enlaceSesionBusqueda(value: unknown) {
  if (typeof value !== 'string') return undefined
  return ['/auth/expired?', '/auth/mfa?', '/login?'].some((prefix) => value.startsWith(prefix)) ? value : undefined
}
