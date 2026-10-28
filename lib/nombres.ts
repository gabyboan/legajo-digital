export function capitalizarNombre(value: string) {
  return value.normalize('NFC').toLocaleLowerCase('es-AR').replace(/(^|[\s\-’'])\p{L}/gu, (letra) => letra.toLocaleUpperCase('es-AR'))
}

// Ignore capitalization, accent marks and separators, but preserve ñ.
export function nombresCoinciden(apellido: string, nombre: string, obtenido: string) {
  const normalizar = (value: string) => value.toLocaleLowerCase('es-AR')
    .normalize('NFD').replace(/[\u0301\u0308]/g, '').normalize('NFC')
    .replace(/[,.;\s]+/g, ' ').trim()
  return normalizar(`${apellido} ${nombre}`) === normalizar(obtenido)
}
