import 'server-only'
import { redirect } from 'next/navigation'
import type { createClient } from '@/utils/supabase/server'
import { enlaceMfa } from './mfa'
import { enlaceSesionVencida, esSesionVencida } from './session'

type Client = Awaited<ReturnType<typeof createClient>>
export type EstadoSesionDatos = 'active' | 'expired' | 'mfa' | 'conflict' | 'unavailable'

export class SesionNoDisponibleError extends Error {}

// Auth can still accept a JWT after the database's one-hour session limit.
// This read-only RPC runs the same session/MFA checks as a real data request.
export async function comprobarSesionDatos(client: Client): Promise<EstadoSesionDatos> {
  const { error } = await client.rpc('verificar_mfa_opcional')
  if (!error) return 'active'
  if (esSesionVencida(error)) return 'expired'
  if (error.code === '42501' && /autenticadora/i.test(error.message)) return 'mfa'
  if (error.code === 'PT409') return 'conflict'
  return 'unavailable'
}

export function redirigirSiSesionVencida(error: { code?: string; status?: number } | null | undefined, destination: string) {
  if (esSesionVencida(error)) redirect(enlaceSesionVencida(destination))
}

export async function exigirSesionDatos(client: Client, destination: string) {
  const status = await comprobarSesionDatos(client)
  if (status === 'expired') redirect(enlaceSesionVencida(destination))
  if (status === 'mfa') redirect(enlaceMfa(destination))
  if (status !== 'active') throw new SesionNoDisponibleError(status === 'conflict'
    ? 'Esta cuenta tiene otra sesión de Gestión abierta. Comprobá la sesión antes de continuar.'
    : 'No se pudo comprobar la sesión. Volvé a intentarlo.')
}

export async function exigirSesion(client: Client, destination: string) {
  const { data: { user }, error } = await client.auth.getUser()
  if (!user && (!error || esSesionVencida(error) || error.name === 'AuthSessionMissingError')) redirect(enlaceSesionVencida(destination))
  if (error || !user) throw new SesionNoDisponibleError('No se pudo comprobar la sesión. Volvé a intentarlo.')
  await exigirSesionDatos(client, destination)
  return user
}
