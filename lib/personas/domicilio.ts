import { DOMICILIO_FIELDS, type DomicilioValores } from './types'

export function normalizarDomicilio(domicilio: Partial<DomicilioValores> | null): DomicilioValores {
  return Object.fromEntries(DOMICILIO_FIELDS.map((field) => [field, domicilio?.[field]?.trim() || null])) as DomicilioValores
}

// Comparison snapshot, not an authorization token. All fields are compared in a fixed order.
export function versionDomicilio(domicilio: Partial<DomicilioValores> | null) {
  const normalizado = normalizarDomicilio(domicilio)
  return JSON.stringify(DOMICILIO_FIELDS.map((field) => normalizado[field]))
}

export function tieneDomicilio(domicilio: Partial<DomicilioValores> | null) {
  return Object.values(normalizarDomicilio(domicilio)).some((value) => value !== null)
}
