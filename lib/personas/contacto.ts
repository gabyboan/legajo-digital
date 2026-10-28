export type ContactoRegistro = {
  telefono: string | null
  numero_contacto: number | null
}

function texto(value: string | number | null) {
  return String(value ?? '').trim()
}

export function mismoTelefono(a: string, b: string) {
  const digitsA = a.replace(/\D/g, '')
  const digitsB = b.replace(/\D/g, '')
  return digitsA !== '' && digitsA === digitsB
}

export function errorTelefono(telefono: string | null) {
  return telefono && (!/\d/.test(telefono) || telefono.length > 100)
    ? 'Ingresá un teléfono válido, con código de área si corresponde.'
    : null
}

export function contactoDesdeRegistro(registro: ContactoRegistro) {
  const telefono = texto(registro.telefono)
  const anterior = texto(registro.numero_contacto)
  const pendiente = Boolean(telefono && anterior && !mismoTelefono(telefono, anterior))
  return {
    telefono: telefono || anterior,
    pendiente,
    otroNumero: pendiente ? anterior : null,
  }
}

// Optimistic concurrency snapshot; this is not an authorization token.
export function versionContacto(registro: ContactoRegistro) {
  return JSON.stringify([registro.telefono, registro.numero_contacto])
}
