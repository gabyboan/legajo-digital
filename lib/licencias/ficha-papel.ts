import type { LicenciaRegistro } from './domain'

export const ANCHOS_FICHA = [42, 82, 52, 52, 52, 52, 52, 41, 28, 28, 27, 27, 27, 27, 27, 27, 75, 42]
export const FILAS_PRIMERA_HOJA = 19
export const FILAS_CONTINUACION = 21

const columnas: Record<string, number> = {
  ANUAL: 1,
  ENFERMEDAD: 2,
  PROFILACTICA: 3,
  FRANCO: 4,
  MATERNIDAD: 5,
  ESTUDIO: 6,
  ART8: 7,
  FALTA_CA: 8,
  FALTA_SA: 9,
}

export type FichaRenglon = { registroId: number; continuacion: boolean; celdas: string[] }

function fragmentarObservacion(texto: string) {
  const caracteres = [...texto.replace(/\s+/gu, ' ').trim()]
  const fragmentos: string[] = []
  for (let inicio = 0; inicio < caracteres.length; inicio += 40) {
    fragmentos.push([caracteres.slice(inicio, inicio + 20).join(''), caracteres.slice(inicio + 20, inicio + 40).join('')].filter(Boolean).join('\n'))
  }
  return fragmentos.length ? fragmentos : ['']
}

export function paginarFicha(registros: LicenciaRegistro[], dni: number, anio: number): FichaRenglon[][] {
  if (!Number.isInteger(anio) || anio < 2026 || anio > 9998) throw new Error('Año de ficha inválido.')
  if (registros.some((registro) => registro.dni !== dni)) throw new Error('Las licencias deben corresponder al agente de la ficha.')
  const ordenados = registros.filter((registro) => !registro.anulado_at && registro.hasta >= `${anio}-01-01` && registro.desde <= `${anio}-12-31`)
    .sort((a, b) => a.desde.localeCompare(b.desde) || a.id - b.id)
  const renglones: FichaRenglon[] = []
  for (const registro of ordenados) {
    const columna = columnas[registro.tipo.columna_ficha ?? '']
    const cantidad = registro.cantidad_ficha?.trim() || String(registro.cantidad_dias_ficha ?? registro.dias)
    const observacion = [
      columna === undefined ? `${registro.tipo.nombre}: ${cantidad} días` : '',
      registro.dni_familiar ? `DNI: ${registro.dni_familiar}` : '',
      registro.observacion?.trim() ?? '',
    ].filter(Boolean).join(' / ')
    fragmentarObservacion(observacion).forEach((fragmento, indice) => {
      const celdas = Array<string>(18).fill('')
      celdas[0] = `${registro.tipo.codigo ?? ''}${indice ? ' (cont.)' : ''}`
      celdas[16] = fragmento
      if (!indice) {
        if (columna !== undefined) celdas[columna] = cantidad
        const desde = registro.desde.split('-').map(Number)
        const hasta = registro.hasta.split('-').map(Number)
        celdas.splice(10, 3, String(desde[2]), String(desde[1]), String(desde[0]))
        celdas.splice(13, 3, ...(registro.desde === registro.hasta ? ['/', '/', '/'] : [String(hasta[2]), String(hasta[1]), String(hasta[0])]))
        celdas[17] = registro.numero_orden?.toString() ?? ''
      }
      renglones.push({ registroId: registro.id, continuacion: indice > 0, celdas })
    })
  }
  const paginas: FichaRenglon[][] = [renglones.slice(0, FILAS_PRIMERA_HOJA)]
  for (let inicio = FILAS_PRIMERA_HOJA; inicio < renglones.length; inicio += FILAS_CONTINUACION) {
    paginas.push(renglones.slice(inicio, inicio + FILAS_CONTINUACION))
  }
  return paginas
}
