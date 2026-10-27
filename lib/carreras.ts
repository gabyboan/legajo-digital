const CARRERAS_RETIRADAS = new Set(['no'])

export function carreraVisible(nombre: string) {
  return !CARRERAS_RETIRADAS.has(nombre.trim().toLocaleLowerCase('es-AR'))
}