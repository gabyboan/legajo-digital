import 'server-only'
import { cuitCorrespondeAlDni } from './cuit'

import {
  ConsultaCuitOnlineError,
  consultarNombrePorDni,
} from './cuitonline'

const VIGENCIA_COMPROBACION_MS = 15 * 60 * 1000
const INTERVALO_MINIMO_MS = 3_000

export type ComprobacionDni = {
  dni: string
  nombre: string
  tipo: 'CUIT' | 'CUIL'
  cuit: string
  comprobadoEn: string
}

type ComprobacionPendiente = ComprobacionDni & {
  venceEn: number
}

const comprobacionesPendientes = new Map<string, ComprobacionPendiente>()
const comprobacionesEnCurso = new Map<string, Promise<ComprobacionDni>>()
const ultimosInicios = new Map<string, number>()

function clave(userId: string, dni: string) {
  return userId + ':' + dni
}

function limpiarRegistrosVencidos() {
  const ahora = Date.now()

  for (const [key, comprobacion] of comprobacionesPendientes) {
    if (comprobacion.venceEn <= ahora) {
      comprobacionesPendientes.delete(key)
    }
  }

  for (const [key, inicio] of ultimosInicios) {
    if (inicio + VIGENCIA_COMPROBACION_MS <= ahora) {
      ultimosInicios.delete(key)
    }
  }
}

export async function comprobarDniParaUsuario(userId: string, dni: string) {
  limpiarRegistrosVencidos()

  const key = clave(userId, dni)
  const enCurso = comprobacionesEnCurso.get(key)

  if (enCurso) {
    return enCurso
  }

  const ahora = Date.now()
  const ultimoInicio = ultimosInicios.get(key)

  if (ultimoInicio && ahora - ultimoInicio < INTERVALO_MINIMO_MS) {
    throw new ConsultaCuitOnlineError('Esperá unos segundos antes de comprobar este DNI otra vez.')
  }

  ultimosInicios.set(key, ahora)

  const comprobacion = consultarNombrePorDni(dni)
    .then((consulta) => {
      if (!cuitCorrespondeAlDni(consulta.cuit, dni)) throw new ConsultaCuitOnlineError('La fuente devolvió un CUIT/CUIL inválido o que no corresponde al DNI.')
      const resultado: ComprobacionDni = {
        dni: consulta.dni,
        nombre: consulta.nombre,
        tipo: consulta.tipo,
        cuit: consulta.cuit,
        comprobadoEn: new Date().toISOString(),
      }

      comprobacionesPendientes.set(key, {
        ...resultado,
        venceEn: Date.now() + VIGENCIA_COMPROBACION_MS,
      })

      return resultado
    })
    .finally(() => {
      comprobacionesEnCurso.delete(key)
    })

  comprobacionesEnCurso.set(key, comprobacion)
  return comprobacion
}

export function obtenerComprobacionPendiente(userId: string, dni: string) {
  limpiarRegistrosVencidos()
  return comprobacionesPendientes.get(clave(userId, dni)) ?? null
}

export function consumirComprobacionPendiente(userId: string, dni: string) {
  comprobacionesPendientes.delete(clave(userId, dni))
}
