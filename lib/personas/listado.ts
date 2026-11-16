import { limpiarBusqueda } from '@/lib/buscar-personas'

export type PersonaListado = {
  dni: number
  apellido: string
  nombre: string
  legajo: number | null
  activo: boolean
  carreras: { id: number; nombre: string }[]
}

export function filtrarPersonas(personas: PersonaListado[], q: string, carrera = '', estado = 'todos') {
  const terms = limpiarBusqueda(q)
  // Un DNI escrito con separadores debe coincidir igual que su versión numérica.
  const numeric = q.trim().replace(/[.\s-]/g, '')
  return personas.filter((persona) => {
    if (carrera && !persona.carreras.some((item) => String(item.id) === carrera)) return false
    if (estado === 'activos' && !persona.activo || estado === 'inactivos' && persona.activo) return false
    if (/^\d+$/.test(numeric)) return String(persona.dni).includes(numeric) || String(persona.legajo ?? '').includes(numeric)
    const fields = limpiarBusqueda(`${persona.apellido} ${persona.nombre}`).join(' ') + ` ${persona.dni} ${persona.legajo ?? ''}`
    return terms.every((term) => fields.includes(term))
  })
}
