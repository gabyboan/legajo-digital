const SITUACIONES_RETIRADAS = new Set([
  'suplente ordinario - licencias varias',
  'suplente ordinario - cargo vacante',
])

export function situacionRevistaVisible(nombre: string) {
  return !SITUACIONES_RETIRADAS.has(nombre.trim().toLocaleLowerCase('es-AR'))
}

export function situacionRevistaLabel(nombre: string) {
  const normalizado = nombre.trim().toLocaleLowerCase('es-AR')

  if (normalizado === 'titular') return 'Titular (Planta Permanente)'
  if (normalizado === 'decreto de estabilidad') return 'Estabilidad'

  return nombre
}

export function normalizarSituacionesRevista<T extends { nombre: string }>(
  situaciones: T[]
) {
  const nombresVistos = new Set<string>()

  return situaciones
    .filter((situacion) => situacionRevistaVisible(situacion.nombre))
    .map((situacion) => ({
      ...situacion,
      nombre: situacionRevistaLabel(situacion.nombre),
    }))
    .filter((situacion) => {
      const clave = situacion.nombre.trim().toLocaleLowerCase('es-AR')
      if (nombresVistos.has(clave)) return false
      nombresVistos.add(clave)
      return true
    })
}