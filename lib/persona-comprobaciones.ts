import 'server-only'

import {
  consultarNombreFamiliar,
} from './consulta-nombre-familiar'
import type { ConsultaNombreFamiliar } from './consulta-familiar-types'

const VIGENCIA_MS = 15 * 60 * 1000

type Pendiente = {
  consulta: ConsultaNombreFamiliar
  venceEn: number
}

const pendientes = new Map<string, Pendiente>()

function clave(userId: string, dni: string) {
  return `${userId}:persona:${dni}`
}

function limpiar() {
  const ahora = Date.now()
  for (const [key, pendiente] of pendientes) {
    if (pendiente.venceEn <= ahora) pendientes.delete(key)
  }
}

export async function comprobarPersonaParaUsuario(userId: string, dni: string) {
  limpiar()
  const consulta = await consultarNombreFamiliar(dni)
  pendientes.set(clave(userId, dni), { consulta, venceEn: Date.now() + VIGENCIA_MS })
  return consulta
}

export function obtenerComprobacionPersona(userId: string, dni: string) {
  limpiar()
  return pendientes.get(clave(userId, dni))?.consulta ?? null
}

export function consumirComprobacionPersona(userId: string, dni: string) {
  pendientes.delete(clave(userId, dni))
}
