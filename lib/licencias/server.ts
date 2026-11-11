import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { enlaceMfa } from '@/lib/auth/mfa'
import { estadoMfa } from '@/lib/auth/mfa-server'
import type { LicenciaCarga, LicenciaPersona, LicenciaRegistro } from './domain'
import { exigirSesionDatos, redirigirSiSesionVencida } from '@/lib/auth/session-server'

type Client = Awaited<ReturnType<typeof createClient>>

export async function sesionLicencias(destination: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(destination)}`)
  const status = await estadoMfa(supabase, user)
  if (status === 'required' || status === 'error') redirect(enlaceMfa(destination))
  await exigirSesionDatos(supabase, destination)
  return supabase
}

export async function permisosLicencias(supabase: Client) {
  const [read, create, ficha, admin] = await Promise.all([
    supabase.rpc('can_licencias_read'),
    supabase.rpc('can_licencias_create'),
    supabase.rpc('can_ficha_read'),
    supabase.rpc('can_licencias_admin'),
  ])
  for (const result of [read, create, ficha, admin]) redirigirSiSesionVencida(result.error, '/licencias')
  return {
    leer: !read.error && read.data === true,
    cargar: !create.error && create.data === true,
    ficha: !ficha.error && ficha.data === true,
    administrar: !admin.error && admin.data === true,
    error: Boolean(read.error || create.error || ficha.error || admin.error),
  }
}

export async function personasLicencias(supabase: Client, buscar: string, ficha = false) {
  const { data, error } = await supabase.rpc(ficha ? 'rpc_ficha_personas' : 'rpc_licencias_personas', { p_buscar: buscar.trim().slice(0, 150) })
  redirigirSiSesionVencida(error, ficha ? '/licencias/fichas' : '/licencias/cargar')
  return { personas: (data ?? []) as LicenciaPersona[], error }
}

export async function historialLicencias(supabase: Client, anio: number, dni: number) {
  const registros: LicenciaRegistro[] = []
  // La RPC admite hasta 500 registros. Recorrer todas las páginas de la ficha.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.rpc('rpc_licencias_historial', { p_anio: anio, p_persona_dni: dni, p_offset: offset, p_limite: 500 })
    redirigirSiSesionVencida(error, `/licencias/fichas/${dni}?anio=${anio}`)
    if (error) return { registros: [], error }
    const pagina = (data ?? []) as LicenciaRegistro[]
    registros.push(...pagina)
    if (pagina.length < 500) return { registros, error: null }
  }
}

export async function ultimasLicencias(supabase: Client, options: { q?: string; estado?: string; offset?: number; id?: number } = {}) {
  const { data, error } = await supabase.rpc('rpc_licencias_ultimas', {
    p_buscar: options.q ?? '', p_estado: options.estado ?? 'vigentes', p_offset: options.offset ?? 0,
    p_limite: options.id ? 1 : 26, p_id: options.id ?? null,
  })
  redirigirSiSesionVencida(error, '/licencias/ultimas')
  return { registros: (error ? [] : data ?? []) as LicenciaCarga[], error }
}

export function mensajeLicencia(error: { code?: string; message?: string }, destination = '/licencias/cargar') {
  redirigirSiSesionVencida(error, destination)
  if (error.code === '40001') return 'La licencia cambió desde que la abriste. Volvé al listado y revisá la versión actual antes de corregirla.'
  if (error.code === '42501') return 'No tenés permiso para realizar esta operación. Revisá tu sesión y los permisos con el administrador.'
  if (error.code === '23505') return 'Ya existe una licencia con esos datos. Revisá la ficha antes de volver a cargarla.'
  if (['22023', 'P0001'].includes(error.code ?? '') && /^(Estudio|La persona|La licencia|El período|Tipo de licencia|Seleccioná un tipo|Ya existe|No se puede|La cantidad|DNI del familiar|Número de orden)/i.test(error.message ?? '')) return error.message!.slice(0, 300)
  return 'No se pudo completar la operación. Volvé a intentarlo; si persiste, contactá al administrador.'
}
