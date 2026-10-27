export type PersonaBuscable = {
  dni: number
  apellido: string
  nombre: string
}

function normalizar(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function limpiarBusqueda(value: string) {
  return normalizar(value).split(/\s+/).filter(Boolean).slice(0, 8)
}

export function ordenarPersonasPorCoincidencia<T extends PersonaBuscable>(
  personas: T[],
  terms: string[]
) {
  const normalizedTerms = terms.map(normalizar)

  function score(persona: PersonaBuscable) {
    const apellido = normalizar(persona.apellido)
    const nombre = normalizar(persona.nombre)
    const completo = `${apellido} ${nombre}`
    const invertido = `${nombre} ${apellido}`
    let result = 0

    if (normalizedTerms.length > 1 && (completo === normalizedTerms.join(' ') || invertido === normalizedTerms.join(' '))) {
      result += 1000
    }
    for (const term of normalizedTerms) {
      if (apellido === term || nombre === term) result += 300
      else if (apellido.startsWith(term) || nombre.startsWith(term)) result += 200
      else if (apellido.split(' ').includes(term) || nombre.split(' ').includes(term)) result += 150
      else if (apellido.includes(term) || nombre.includes(term)) result += 75
      else result -= 100
    }
    return result
  }

  return personas
    .filter((persona) => score(persona) > -100 * normalizedTerms.length)
    .map((persona, index) => ({ persona, index, score: score(persona) }))
    .sort((a, b) => b.score - a.score || a.persona.apellido.localeCompare(b.persona.apellido, 'es') ||
      a.persona.nombre.localeCompare(b.persona.nombre, 'es') || a.index - b.index)
    .map(({ persona }) => persona)
}
