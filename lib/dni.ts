// Keep the draft as text: Number() would remove leading zeros while typing.
export function formatearDni(value: string) {
  return value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Database identifiers are numeric; display a complete DNI using eight digits.
export function dniDesdeRegistro(value: number | null | undefined) {
  if (value == null) return ''
  const digits = String(value)
  return /^\d{7,8}$/.test(digits) ? digits.padStart(8, '0') : digits
}
