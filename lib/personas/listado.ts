import { limpiarBusqueda } from '@/lib/buscar-personas'

export type PersonaListado = {
  dni: number
  apellido: string
  nombre: string
  legajo: number | null
  activo: boolean
  carreras: { id: number; nombre: string }[]
}

export function indexarPersonas(personas: readonly PersonaListado[]) {
  return personas.map((persona) => ({
    persona,
    texto: limpiarBusqueda(`${persona.apellido} ${persona.nombre}`).join(' ') + ` ${persona.dni} ${persona.legajo ?? ''}`,
    dni: String(persona.dni), legajo: String(persona.legajo ?? ''),
    carreras: persona.carreras.map((item) => String(item.id)),
  }))
}

export function filtrarIndicePersonas(indice: ReturnType<typeof indexarPersonas>, q: string, carrera = '', estado = 'todos') {
  const terms = limpiarBusqueda(q)
  // Un DNI escrito con separadores debe coincidir igual que su versión numérica.
  const numeric = q.trim().replace(/[.\s-]/g, '')
  const esNumerico = /^\d+$/.test(numeric)
  return indice.filter(({ persona, texto, dni, legajo, carreras }) => {
    if (carrera && !carreras.includes(carrera)) return false
    if (estado === 'activos' && !persona.activo || estado === 'inactivos' && persona.activo) return false
    if (esNumerico) return dni.includes(numeric) || legajo.includes(numeric)
    return terms.every((term) => texto.includes(term))
  }).map(({ persona }) => persona)
}

export function filtrarPersonas(personas: PersonaListado[], q: string, carrera = '', estado = 'todos') {
  return filtrarIndicePersonas(indexarPersonas(personas), q, carrera, estado)
}
