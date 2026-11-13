'use server'

import { revalidatePath } from 'next/cache'
import { exigirSesion, SesionNoDisponibleError } from '@/lib/auth/session-server'
import { createClient } from '@/utils/supabase/server'
import { datosControl, type ControlState } from '@/lib/novedades/domain'
import { controlPath, mensajeControl, permisosNovedades } from '@/lib/novedades/server'

export async function guardarControl(_previous: ControlState, form: FormData): Promise<ControlState> {
  const args = datosControl(form)
  if (!args) return { status: 'error', message: 'Revisá el formulario, corroborá los datos y las advertencias. Una observación requiere un motivo.' }
  try {
    const client = await createClient()
    await exigirSesion(client, controlPath)
    const permisos = await permisosNovedades(client)
    if (permisos.error || !permisos.confirmar) return { status: 'error', message: 'No se pudo autorizar la confirmación. Revisá tu sesión y permisos.' }
    const { data, error } = await client.rpc('rpc_novedades_controlar', args)
    if (error) return { status: 'error', message: mensajeControl(error) }
    if (!data || !Number.isSafeInteger(data.id)) return { status: 'error', message: 'No se recibió confirmación. Actualizá y comprobá el historial antes de reintentar.' }
    revalidatePath(controlPath, 'layout')
    return { status: 'success', message: 'Control guardado. El estado actual y su historial figuran en esta página.' }
  } catch (error) {
    if (!(error instanceof SesionNoDisponibleError)) throw error
    return { status: 'error', message: error.message }
  }
}
