'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  canCurrentUserEditLegajo,
  canCurrentUserWriteFrancos,
} from './permissions'

function toNullableString(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function toNullableDate(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function toNullableInt(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()

  if (text === '') {
    return null
  }

  const num = Number(text)

  if (!Number.isInteger(num)) {
    return null
  }

  return num
}


function bancoInicialErrorMessage(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes('6') && lower.includes('hora')) {
    return 'Banco inicial permite saldos mayores a 6 horas. La base de datos todavia esta aplicando la regla diaria; hay que actualizar rpc_francos_saldo_inicial para omitir ese limite en este flujo.'
  }

  return message
}
function isValidHourMinute(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function asistenciaItemsFromFormData(formData: FormData, redirectTo: string) {
  const items: Array<{
    dia_semana: number
    hora_desde: string
    hora_hasta: string
  }> = []

  if (formData.get('horario_rotativo') === 'on') {
    return items
  }

  for (let dia = 1; dia <= 7; dia += 1) {
    const enabled = formData.get(`asiste_${dia}`) === 'on'
    const desde = String(formData.get(`hora_desde_${dia}`) ?? '').trim()
    const hasta = String(formData.get(`hora_hasta_${dia}`) ?? '').trim()

    if (!enabled && !desde && !hasta) {
      continue
    }

    if (!enabled || !isValidHourMinute(desde) || !isValidHourMinute(hasta)) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent(
          'Completá día, hora desde y hora hasta con formato HH:MM'
        )}`
      )
    }

    if (hasta <= desde) {
      redirect(
        `${redirectTo}?error=${encodeURIComponent(
          'La hora hasta debe ser mayor que la hora desde'
        )}`
      )
    }

    items.push({
      dia_semana: dia,
      hora_desde: desde,
      hora_hasta: hasta,
    })
  }

  return items
}

async function requireLegajoEdit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  redirectTo: string
) {
  const canEdit = await canCurrentUserEditLegajo(supabase)

  if (!canEdit) {
    redirect(`${redirectTo}?error=No%20ten%C3%A9s%20permisos%20para%20editar`)
  }
}

async function requireFrancosWrite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  redirectTo: string
) {
  const canWrite = await canCurrentUserWriteFrancos(supabase)

  if (!canWrite) {
    redirect(
      `${redirectTo}?error=${encodeURIComponent(
        'No tenés permisos para cargar francos'
      )}`
    )
  }
}

async function syncSituacionRevista(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dni: number,
  situacionId: number | null
) {
  const { error: deleteError } = await supabase
    .from('persona_situacion_revista')
    .delete()
    .eq('dni', dni)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  if (situacionId === null) {
    return
  }

  const { error: insertError } = await supabase
    .from('persona_situacion_revista')
    .insert({
      dni,
      situacion_id: situacionId,
    })

  if (insertError) {
    throw new Error(insertError.message)
  }
}

async function syncCarrera(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dni: number,
  carreraId: number
) {
  const { error } = await supabase
    .from('persona_carreras')
    .upsert(
      {
        dni,
        carrera_id: carreraId,
      },
      {
        onConflict: 'dni',
      }
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function createPersona(formData: FormData) {
  const supabase = await createClient()

  await requireLegajoEdit(supabase, '/personas/nuevo')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const dniRaw = String(formData.get('dni') ?? '').trim()
  const apellido = String(formData.get('apellido') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()

  const legajo = toNullableInt(formData.get('legajo'))
  const situacionId = toNullableInt(formData.get('situacion_id'))
  const carreraIdRaw = toNullableInt(formData.get('carrera_id'))

  if (!dniRaw || !apellido || !nombre) {
    redirect('/personas/nuevo?error=Faltan%20campos%20obligatorios')
  }

  const dni = Number(dniRaw)

  if (!Number.isInteger(dni) || dni <= 0) {
    redirect('/personas/nuevo?error=DNI%20inv%C3%A1lido')
  }

  if (carreraIdRaw === null || carreraIdRaw <= 0) {
    redirect('/personas/nuevo?error=Debe%20seleccionar%20una%20carrera')
  }

  const carreraId = carreraIdRaw
  const horarioRotativo = formData.get('horario_rotativo') === 'on'
  const asistenciaItems = asistenciaItemsFromFormData(
    formData,
    '/personas/nuevo'
  )

  const payload = {
    dni,
    legajo,
    apellido,
    nombre,
    email: toNullableString(formData.get('email')),
    telefono: toNullableString(formData.get('telefono')),
    fecha_nacimiento: toNullableDate(formData.get('fecha_nacimiento')),
    horario_rotativo: horarioRotativo,
    created_by: user?.id ?? null,
    updated_by: user?.id ?? null,
  }

  const { error } = await supabase.from('personas').insert(payload)

  if (error) {
    redirect(`/personas/nuevo?error=${encodeURIComponent(error.message)}`)
  }

  try {
    await syncCarrera(supabase, dni, carreraId)
    await syncSituacionRevista(supabase, dni, situacionId)

    if (asistenciaItems.length > 0) {
      await requireFrancosWrite(supabase, '/personas/nuevo')

      const { error: asistenciaError } = await supabase.rpc(
        'rpc_francos_horario_guardar',
        {
          p_dni: dni,
          p_carrera_id: carreraId,
          p_items: asistenciaItems,
        }
      )

      if (asistenciaError) {
        throw new Error(asistenciaError.message)
      }
    }
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : 'No se pudo guardar la carrera, situación de revista o asistencia'

    redirect(`/personas/nuevo?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  redirect(`/personas/${dni}`)
}

export async function updatePersona(formData: FormData) {
  const supabase = await createClient()

  const dniRaw = String(formData.get('dni') ?? '').trim()
  const dni = Number(dniRaw)

  if (!Number.isInteger(dni) || dni <= 0) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  await requireLegajoEdit(supabase, `/personas/${dni}/editar`)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const apellido = String(formData.get('apellido') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()

  const legajo = toNullableInt(formData.get('legajo'))
  const situacionId = toNullableInt(formData.get('situacion_id'))
  const carreraIdRaw = toNullableInt(formData.get('carrera_id'))

  if (!dniRaw || !apellido || !nombre) {
    redirect('/personas?error=Faltan%20campos%20obligatorios')
  }

  if (carreraIdRaw === null || carreraIdRaw <= 0) {
    redirect(`/personas/${dni}/editar?error=Debe%20seleccionar%20una%20carrera`)
  }

  const carreraId = carreraIdRaw

  const payload = {
    legajo,
    apellido,
    nombre,
    email: toNullableString(formData.get('email')),
    telefono: toNullableString(formData.get('telefono')),
    fecha_nacimiento: toNullableDate(formData.get('fecha_nacimiento')),
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  }

  const { error } = await supabase
    .from('personas')
    .update(payload)
    .eq('dni', dni)

  if (error) {
    redirect(`/personas/${dni}/editar?error=${encodeURIComponent(bancoInicialErrorMessage(error.message))}`)
  }

  try {
    await syncCarrera(supabase, dni, carreraId)
    await syncSituacionRevista(supabase, dni, situacionId)
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : 'No se pudo guardar la carrera o la situación de revista'

    redirect(`/personas/${dni}/editar?error=${encodeURIComponent(message)}`)
  }

  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  redirect(`/personas/${dni}`)
}

export async function updateAsistenciaPersona(formData: FormData) {
  const supabase = await createClient()

  const dni = Number(String(formData.get('dni') ?? '').trim())
  const carreraId = toNullableInt(formData.get('carrera_id'))

  if (!Number.isInteger(dni) || dni <= 0) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  await requireLegajoEdit(supabase, `/personas/${dni}/editar`)
  await requireFrancosWrite(supabase, `/personas/${dni}/editar`)

  if (carreraId === null || carreraId <= 0) {
    redirect(
      `/personas/${dni}/editar?error=${encodeURIComponent(
        'Debe seleccionar una carrera antes de cargar asistencia'
      )}`
    )
  }

  const items = asistenciaItemsFromFormData(formData, `/personas/${dni}/editar`)
  const horarioRotativo = formData.get('horario_rotativo') === 'on'

  const { error: modalidadError } = await supabase
    .from('personas')
    .update({ horario_rotativo: horarioRotativo })
    .eq('dni', dni)

  if (modalidadError) {
    redirect(
      `/personas/${dni}/editar?error=${encodeURIComponent(modalidadError.message)}`
    )
  }

  const { error } = await supabase.rpc('rpc_francos_horario_guardar', {
    p_dni: dni,
    p_carrera_id: carreraId,
    p_items: items,
  })

  if (error) {
    redirect(`/personas/${dni}/editar?error=${encodeURIComponent(bancoInicialErrorMessage(error.message))}`)
  }

  revalidatePath(`/personas/${dni}`)
  revalidatePath(`/personas/${dni}/editar`)
  redirect(`/personas/${dni}`)
}

export async function updateBancoInicialHoras(formData: FormData) {
  const supabase = await createClient()

  const dni = Number(String(formData.get('dni') ?? '').trim())
  const carreraId = toNullableInt(formData.get('carrera_id'))

  if (!Number.isInteger(dni) || dni <= 0) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  await requireLegajoEdit(supabase, `/personas/${dni}/editar`)
  await requireFrancosWrite(supabase, `/personas/${dni}/editar`)

  if (carreraId === null || carreraId <= 0) {
    redirect(
      `/personas/${dni}/editar?error=${encodeURIComponent(
        'Debe seleccionar una carrera antes de cargar banco inicial'
      )}`
    )
  }

  const fecha = toNullableDate(formData.get('saldo_inicial_fecha'))
  const horas = toNullableInt(formData.get('saldo_inicial_horas')) ?? 0
  const minutosResto =
    toNullableInt(formData.get('saldo_inicial_minutos')) ?? 0
  const signo = String(formData.get('saldo_inicial_signo') ?? '1') === '-1'
    ? -1
    : 1

  if (!fecha) {
    redirect(
      `/personas/${dni}/editar?error=${encodeURIComponent(
        'Debe indicar la fecha del banco inicial'
      )}`
    )
  }

  if (horas < 0 || minutosResto < 0 || minutosResto > 59) {
    redirect(
      `/personas/${dni}/editar?error=${encodeURIComponent(
        'El banco inicial debe cargarse en horas y minutos validos'
      )}`
    )
  }

  const minutos = signo * (horas * 60 + minutosResto)

  if (minutos === 0) {
    redirect(
      `/personas/${dni}/editar?error=${encodeURIComponent(
        'El banco inicial debe ser distinto de cero'
      )}`
    )
  }

  const { error } = await supabase.rpc('rpc_francos_saldo_inicial', {
    p_dni: dni,
    p_carrera_id: carreraId,
    p_fecha: fecha,
    p_minutos: minutos,
    p_observacion: toNullableString(formData.get('saldo_inicial_observacion')),
  })

  if (error) {
    redirect(`/personas/${dni}/editar?error=${encodeURIComponent(bancoInicialErrorMessage(error.message))}`)
  }

  revalidatePath(`/personas/${dni}`)
  revalidatePath(`/personas/${dni}/editar`)
  redirect(`/personas/${dni}/editar`)
}

export async function updateBancoInicialHorasDesdeListado(formData: FormData) {
  const supabase = await createClient()
  const q = toNullableString(formData.get('q'))
  const redirectTo = q
    ? `/personas/banco-horas?q=${encodeURIComponent(q)}`
    : '/personas/banco-horas'

  const dni = Number(String(formData.get('dni') ?? '').trim())
  const carreraId = toNullableInt(formData.get('carrera_id'))

  if (!Number.isInteger(dni) || dni <= 0) {
    redirect('/personas/banco-horas?error=DNI%20invalido')
  }

  await requireLegajoEdit(supabase, redirectTo)
  await requireFrancosWrite(supabase, redirectTo)

  if (carreraId === null || carreraId <= 0) {
    redirect(
      `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
        'Debe seleccionar una carrera antes de cargar banco inicial'
      )}`
    )
  }

  const fecha = toNullableDate(formData.get('saldo_inicial_fecha'))
  const horas = toNullableInt(formData.get('saldo_inicial_horas')) ?? 0
  const minutosResto =
    toNullableInt(formData.get('saldo_inicial_minutos')) ?? 0
  const signo = String(formData.get('saldo_inicial_signo') ?? '1') === '-1'
    ? -1
    : 1

  if (!fecha) {
    redirect(
      `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
        'Debe indicar la fecha del banco inicial'
      )}`
    )
  }

  if (horas < 0 || minutosResto < 0 || minutosResto > 59) {
    redirect(
      `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
        'El banco inicial debe cargarse en horas y minutos validos'
      )}`
    )
  }

  const minutos = signo * (horas * 60 + minutosResto)

  if (minutos === 0) {
    redirect(
      `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
        'El banco inicial debe ser distinto de cero'
      )}`
    )
  }

  const { error } = await supabase.rpc('rpc_francos_saldo_inicial', {
    p_dni: dni,
    p_carrera_id: carreraId,
    p_fecha: fecha,
    p_minutos: minutos,
    p_observacion: toNullableString(formData.get('saldo_inicial_observacion')),
  })

  if (error) {
    redirect(
      `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
        bancoInicialErrorMessage(error.message)
      )}`
    )
  }

  revalidatePath('/personas/banco-horas')
  revalidatePath(`/personas/${dni}`)
  revalidatePath(`/personas/${dni}/editar`)
  redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}updated=${dni}`)
}
export async function deleteBancoInicialHoras(formData: FormData) {
  const supabase = await createClient()

  const dni = Number(String(formData.get('dni') ?? '').trim())
  const carreraId = toNullableInt(formData.get('carrera_id'))

  if (!Number.isInteger(dni) || dni <= 0) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  await requireLegajoEdit(supabase, `/personas/${dni}/editar`)
  await requireFrancosWrite(supabase, `/personas/${dni}/editar`)

  if (carreraId === null || carreraId <= 0) {
    redirect(
      `/personas/${dni}/editar?error=${encodeURIComponent(
        'Debe seleccionar una carrera antes de eliminar banco inicial'
      )}`
    )
  }

  const { error } = await supabase.rpc('rpc_francos_saldo_inicial_eliminar', {
    p_dni: dni,
    p_carrera_id: carreraId,
  })

  if (error) {
    redirect(`/personas/${dni}/editar?error=${encodeURIComponent(bancoInicialErrorMessage(error.message))}`)
  }

  revalidatePath(`/personas/${dni}`)
  revalidatePath(`/personas/${dni}/editar`)
  redirect(`/personas/${dni}/editar`)
}

export async function inactivarPersona(formData: FormData) {
  const supabase = await createClient()

  const dni = Number(String(formData.get('dni') ?? '').trim())

  if (!Number.isInteger(dni)) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  await requireLegajoEdit(supabase, `/personas/${dni}`)

  const causa = String(formData.get('causa') ?? '').trim()
  const observaciones = toNullableString(formData.get('observaciones'))

  if (!causa) {
    redirect('/personas?error=Datos%20inv%C3%A1lidos')
  }

  const { error } = await supabase.from('persona_inactivo').upsert({
    dni,
    causa,
    observaciones,
    fecha: new Date().toISOString().slice(0, 10),
  })

  if (error) {
    redirect(`/personas/${dni}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  redirect(`/personas/${dni}`)
}

export async function reactivarPersona(formData: FormData) {
  const supabase = await createClient()

  const dni = Number(String(formData.get('dni') ?? '').trim())

  if (!Number.isInteger(dni)) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  await requireLegajoEdit(supabase, `/personas/${dni}`)

  const { error } = await supabase
    .from('persona_inactivo')
    .delete()
    .eq('dni', dni)

  if (error) {
    redirect(`/personas/${dni}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  redirect(`/personas/${dni}`)
}
