import 'server-only'
import type { createClient } from '@/utils/supabase/server'
import { redirigirSiSesionVencida } from '@/lib/auth/session-server'
import type { Novedad } from './domain'

type Client = Awaited<ReturnType<typeof createClient>>
export const controlPath = '/licencias/control-novedades'
export async function permisosNovedades(client: Client) {
  const [read, confirm] = await Promise.all([client.rpc('can_novedades_read'), client.rpc('can_novedades_confirm')])
  for (const r of [read, confirm]) redirigirSiSesionVencida(r.error, controlPath)
  return { leer: !read.error && read.data === true, confirmar: !confirm.error && confirm.data === true, error: Boolean(read.error || confirm.error) }
}
export async function detalleNovedad(client: Client, origen: string, id: number) {
  const { data, error } = await client.rpc('rpc_novedades_detalle', { p_origen: origen, p_id: id })
  redirigirSiSesionVencida(error, controlPath)
  return { registro: (error ? null : data) as Novedad | null, error }
}
export function mensajeControl(error: { code?: string; message?: string }) {
  redirigirSiSesionVencida(error, controlPath)
  if (error.code === '40001') return 'La novedad, el calendario o su control cambiaron. Actualizá la página y revisá los datos antes de continuar.'
  if (error.code === '42501') return 'No tenés permiso para este control o estás intentando controlar una carga propia.'
  if (error.code === '22023' && /^(Un franco futuro|El parte todavía|Esta novedad no admite|La novedad no está disponible)/.test(error.message ?? '')) return error.message!.slice(0, 300)
  if (error.code === 'PGRST202' || error.code === '42883') return 'La base necesita la actualización de Control de novedades. Contactá al responsable.'
  return 'No se pudo guardar el control. Actualizá y comprobá el historial antes de reintentar.'
}
