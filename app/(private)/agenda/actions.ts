'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserManageFeriados } from '../personas/permissions'

function agendaError(message: string): never {
  redirect(`/agenda?error=${encodeURIComponent(message)}`)
}

async function requireFeriadosAdmin() {
  const supabase = await createClient()

  if (!(await canCurrentUserManageFeriados(supabase))) {
    agendaError('Solo Legajo Admin puede administrar feriados')
  }

  return supabase
}

export async function createFeriado(formData: FormData) {
  const supabase = await requireFeriadosAdmin()
  const fecha = String(formData.get('fecha') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const observacion = String(formData.get('observacion') ?? '').trim() || null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !nombre) {
    agendaError('Completa la fecha y el nombre del feriado')
  }

  const { error } = await supabase.from('feriados').insert({
    fecha,
    nombre,
    observacion,
  })

  if (error) agendaError(error.message)

  revalidatePath('/agenda')
  redirect('/agenda')
}

export async function updateFeriado(formData: FormData) {
  const supabase = await requireFeriadosAdmin()
  const id = Number(formData.get('id'))
  const fecha = String(formData.get('fecha') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()
  const observacion = String(formData.get('observacion') ?? '').trim() || null

  if (!Number.isInteger(id) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !nombre) {
    agendaError('Datos de feriado invalidos')
  }

  const { error } = await supabase
    .from('feriados')
    .update({
      fecha,
      nombre,
      observacion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) agendaError(error.message)

  revalidatePath('/agenda')
  redirect('/agenda')
}

export async function deleteFeriado(formData: FormData) {
  const supabase = await requireFeriadosAdmin()
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id)) agendaError('Feriado invalido')

  const { error } = await supabase.from('feriados').delete().eq('id', id)

  if (error) agendaError(error.message)

  revalidatePath('/agenda')
  redirect('/agenda')
}
