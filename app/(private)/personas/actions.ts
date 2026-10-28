'use server'

import { capitalizarNombre } from '@/lib/nombres'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  consumirComprobacionPersona,
  obtenerComprobacionPersona,
} from '@/lib/persona-comprobaciones'
import {
  canCurrentUserEditLegajo,
  canCurrentUserWriteFrancos,
} from './permissions'
import { validarPersona, valoresPersona } from '@/lib/personas/formulario'
import { guardarAltaPersona, guardarEdicionPersona } from '@/lib/personas/persistencia'
import type { PersonaFormState } from '@/lib/personas/types'

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

export async function guardarIdentidadPersona(formData: FormData) {
  const supabase = await createClient()
  await requireLegajoEdit(supabase, '/personas/nuevo')

  const dniRaw = String(formData.get('dni') ?? '').replace(/\D/g, '')
  const apellido = String(formData.get('apellido') ?? '').replace(/\s+/g, ' ').trim()
  const nombre = String(formData.get('nombre') ?? '').replace(/\s+/g, ' ').trim()
  const cuitRaw = String(formData.get('cuit') ?? '').trim()
  const cuit = cuitRaw.replace(/\D/g, '')
  const fechaNacimiento = String(formData.get('fecha_nacimiento') ?? '').trim()
  const modo = String(formData.get('modo') ?? 'fuentes')

  const fechaValida = !fechaNacimiento || (
    /^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento) &&
    !Number.isNaN(Date.parse(`${fechaNacimiento}T00:00:00Z`)) &&
    new Date(`${fechaNacimiento}T00:00:00Z`).toISOString().slice(0, 10) === fechaNacimiento
  )

  if (
    !/^\d{7,8}$/.test(dniRaw) ||
    !apellido ||
    !nombre ||
    (cuitRaw !== '' && !/^\d{11}$/.test(cuit)) ||
    !fechaValida
  ) {
    redirect('/personas/nuevo?error=Completá%20un%20DNI%20válido,%20apellido%20y%20nombre')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const consulta = obtenerComprobacionPersona(user.id, dniRaw)
  const candidato = consulta?.intentos
    .flatMap((intento) => intento.resultados)
    .find((resultado) => resultado.numero === cuit)

  if (modo !== 'manual' && !candidato) {
    redirect('/personas/nuevo?error=Volvé%20a%20consultar%20el%20DNI%20antes%20de%20guardar')
  }

  const { data: persona, error } = await supabase.rpc('rpc_persona_guardar_identidad', {
    p_dni: Number(dniRaw),
    p_apellido: apellido,
    p_nombre: nombre,
    p_cuil: cuit ? Number(cuit) : null,
    p_fecha_nacimiento: fechaNacimiento || null,
  }).single()

  if (error || !persona) {
    redirect(`/personas/nuevo?error=${encodeURIComponent(error?.message ?? 'No se pudo guardar la identidad')}`)
  }

  consumirComprobacionPersona(user.id, dniRaw)
  revalidatePath('/personas')
  revalidatePath(`/personas/${Number(dniRaw)}`)
  redirect(`/personas/${Number(dniRaw)}/editar`)
}

export async function createPersona(formData: FormData) {
  const supabase = await createClient()

  await requireLegajoEdit(supabase, '/personas/nuevo')

  const parsed = validarPersona(formData)
  if (!parsed.ok) redirect(`/personas/nuevo?error=${encodeURIComponent(parsed.state.message ?? 'Revisá los datos.')}`)
  const datos = parsed.datos
  datos.identificacion.apellido = capitalizarNombre(datos.identificacion.apellido)
  datos.identificacion.nombre = capitalizarNombre(datos.identificacion.nombre)
  const dni = datos.identificacion.dni
  const carreraId = datos.laboral.carreraId
  const asistenciaItems = asistenciaItemsFromFormData(formData, '/personas/nuevo')
  if (asistenciaItems.length > 0) await requireFrancosWrite(supabase, '/personas/nuevo')
  const saved = await guardarAltaPersona(supabase, datos, formData.get('horario_rotativo') === 'on')
  if (!saved.ok) redirect(`/personas/nuevo?error=${encodeURIComponent(saved.message)}`)

  if (asistenciaItems.length > 0) {
    const { error: asistenciaError } = await supabase.rpc(
      'rpc_francos_horario_guardar',
      {
        p_dni: dni,
        p_carrera_id: carreraId,
        p_items: asistenciaItems,
      }
    )

    if (asistenciaError) {
      revalidatePath('/personas')
      revalidatePath(`/personas/${dni}`)
      redirect(
        `/personas/${dni}/editar?error=${encodeURIComponent(
          `La persona fue creada, pero no se pudo guardar la asistencia: ${asistenciaError.message}`
        )}`
      )
    }
  }

  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  redirect(`/personas/${dni}`)
}

async function guardarFormularioPersona(formData: FormData): Promise<PersonaFormState> {
  const supabase = await createClient()
  // Every exposed Server Action checks authorization before any read or write.
  if (!(await canCurrentUserEditLegajo(supabase))) {
    return { status: 'error', message: 'Tu sesión no permite editar legajos. Volvé a ingresar o consultá al administrador.', values: valoresPersona(formData) }
  }
  const parsed = validarPersona(formData, { validarContacto: false })
  if (!parsed.ok) return parsed.state
  let saved
  try {
    saved = await guardarEdicionPersona(supabase, parsed.datos)
  } catch {
    return { status: 'error', message: 'No se pudo conectar para guardar. Tus cambios se conservan en el formulario.', values: parsed.values }
  }
  if (!saved.ok) {
    return { status: 'error', message: saved.message, errors: saved.errors, values: parsed.values }
  }
  const dni = parsed.datos.identificacion.dni
  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  revalidatePath(`/personas/${dni}/editar`)
  redirect(`/personas/${dni}`)
}

export async function updatePersonaConEstado(_previousState: PersonaFormState, formData: FormData): Promise<PersonaFormState> {
  return guardarFormularioPersona(formData)
}

export async function updatePersona(formData: FormData) {
  const state = await guardarFormularioPersona(formData)
  const raw = String(formData.get('dni') ?? '').trim()
  const destination = /^\d{7,8}$/.test(raw) ? `/personas/${Number(raw)}/editar` : '/personas'
  redirect(`${destination}?error=${encodeURIComponent(state.message ?? 'Revisá los datos.')}`)
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
  const page = toNullableInt(formData.get('page'))
  const query = new URLSearchParams()

  if (q) {
    query.set('q', q)
  }

  if (page && page > 1) {
    query.set('page', String(page))
  }

  const redirectTo = query.size > 0
    ? `/personas/banco-horas?${query.toString()}`
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

function familiarFromFormData(formData: FormData) {
  return {
    apellido: capitalizarNombre(String(formData.get('familiar_apellido') ?? '').trim()),
    nombre: capitalizarNombre(String(formData.get('familiar_nombre') ?? '').trim()),
    fecha_nacimiento: toNullableDate(
      formData.get('familiar_fecha_nacimiento')
    ),
    dni: toNullableInt(String(formData.get('familiar_dni') ?? '').replace(/\D/g, '')),
    parentesco: String(formData.get('familiar_parentesco') ?? '').trim(),
  }
}

function validateFamiliar(
  familiar: ReturnType<typeof familiarFromFormData>,
  redirectTo: string
) {
  if (!familiar.apellido || !familiar.nombre || !familiar.parentesco) {
    redirect(familiarRedirectWithError(redirectTo, 'Completá apellido, nombre y parentesco del familiar'))
  }

  if (familiar.dni !== null && familiar.dni <= 0) {
    redirect(familiarRedirectWithError(redirectTo, 'El DNI del familiar no es válido'))
  }

  if (
    familiar.fecha_nacimiento &&
    familiar.fecha_nacimiento > new Date().toISOString().slice(0, 10)
  ) {
    redirect(familiarRedirectWithError(redirectTo, 'La fecha de nacimiento del familiar no puede ser futura'))
  }
}

function familiarErrorMessage(error: { code?: string; message: string }) {
  if (
    error.code === '23505' &&
    error.message.includes('persona_familiares_persona_dni_familiar_dni_uidx')
  ) {
    return 'Ya existe un familiar cargado con ese DNI. Usá Editar sobre el registro existente.'
  }

  return error.message
}

function familiarRedirectTo(formData: FormData, personaDni: number) {
  const fallback = `/personas/${personaDni}/editar`
  const requested = String(formData.get('return_to') ?? '').trim()

  return requested === '/personas/familiares' ||
    requested.startsWith('/personas/familiares?')
    ? (() => { const url = new URL(requested, 'http://legajo.local'); url.searchParams.delete('error'); return url.pathname + url.search })()
    : fallback
}

function familiarRedirectWithError(redirectTo: string, message: string) {
  const separator = redirectTo.includes('?') ? '&' : '?'
  return `${redirectTo}${separator}error=${encodeURIComponent(message)}`
}

export async function createFamiliar(formData: FormData) {
  const supabase = await createClient()
  const personaDni = Number(formData.get('dni'))

  if (!Number.isInteger(personaDni) || personaDni <= 0) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  const redirectTo = familiarRedirectTo(formData, personaDni)

  await requireLegajoEdit(supabase, redirectTo)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const familiar = familiarFromFormData(formData)
  validateFamiliar(familiar, redirectTo)

  const { error } = await supabase.from('persona_familiares').insert({
    persona_dni: personaDni,
    ...familiar,
    created_by: user.id,
    updated_by: user.id,
  })

  if (error) {
    redirect(familiarRedirectWithError(redirectTo, familiarErrorMessage(error)))
  }

  revalidatePath(`/personas/${personaDni}`)
  revalidatePath('/personas/familiares')
  revalidatePath(redirectTo)

  redirect(redirectTo)
}

export async function updateFamiliar(formData: FormData) {
  const supabase = await createClient()
  const personaDni = Number(formData.get('dni'))
  const familiarId = Number(formData.get('familiar_id'))

  if (
    !Number.isInteger(personaDni) ||
    personaDni <= 0 ||
    !Number.isInteger(familiarId) ||
    familiarId <= 0
  ) {
    redirect('/personas?error=Datos%20inv%C3%A1lidos')
  }

  const redirectTo = familiarRedirectTo(formData, personaDni)

  await requireLegajoEdit(supabase, redirectTo)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const familiar = familiarFromFormData(formData)
  validateFamiliar(familiar, redirectTo)

  const { error } = await supabase
    .from('persona_familiares')
    .update({
      ...familiar,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', familiarId)
    .eq('persona_dni', personaDni)

  if (error) {
    redirect(familiarRedirectWithError(redirectTo, familiarErrorMessage(error)))
  }

  revalidatePath(`/personas/${personaDni}`)
  revalidatePath('/personas/familiares')
  revalidatePath(redirectTo)
  redirect(redirectTo)
}

export async function updateFamiliarFallecido(formData: FormData) {
  const supabase = await createClient()
  const personaDni = Number(formData.get('dni'))
  const familiarId = Number(formData.get('familiar_id'))
  const fallecidoValue = String(formData.get('fallecido') ?? '')

  if (
    !Number.isInteger(personaDni) ||
    personaDni <= 0 ||
    !Number.isInteger(familiarId) ||
    familiarId <= 0
  ) {
    redirect('/personas?error=Datos%20inv%C3%A1lidos')
  }

  const redirectTo = familiarRedirectTo(formData, personaDni)

  if (fallecidoValue !== 'true' && fallecidoValue !== 'false') {
    redirect(familiarRedirectWithError(redirectTo, 'El estado del familiar no es valido'))
  }

  await requireLegajoEdit(supabase, redirectTo)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('persona_familiares')
    .update({
      fallecido: fallecidoValue === 'true',
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', familiarId)
    .eq('persona_dni', personaDni)

  if (error) {
    redirect(familiarRedirectWithError(redirectTo, familiarErrorMessage(error)))
  }

  revalidatePath(`/personas/${personaDni}`)
  revalidatePath('/personas/familiares')
  revalidatePath(redirectTo)
  redirect(redirectTo)
}

export async function deleteFamiliar(formData: FormData) {
  const supabase = await createClient()
  const personaDni = Number(formData.get('dni'))
  const familiarId = Number(formData.get('familiar_id'))

  if (
    !Number.isInteger(personaDni) ||
    personaDni <= 0 ||
    !Number.isInteger(familiarId) ||
    familiarId <= 0
  ) {
    redirect('/personas?error=Datos%20inv%C3%A1lidos')
  }

  const redirectTo = familiarRedirectTo(formData, personaDni)

  await requireLegajoEdit(supabase, redirectTo)

  const { error } = await supabase
    .from('persona_familiares')
    .delete()
    .eq('id', familiarId)
    .eq('persona_dni', personaDni)

  if (error) {
    redirect(familiarRedirectWithError(redirectTo, error.message))
  }

  revalidatePath(`/personas/${personaDni}`)
  revalidatePath('/personas/familiares')
  revalidatePath(redirectTo)
  redirect(redirectTo)
}

export async function inactivarPersona(formData: FormData) {
  const supabase = await createClient()

  const dni = Number(String(formData.get('dni') ?? '').trim())

  if (!Number.isInteger(dni)) {
    redirect('/personas?error=DNI%20inv%C3%A1lido')
  }

  await requireLegajoEdit(supabase, `/personas/${dni}`)

  const causa = String(formData.get('causa') ?? '').trim()
  const fechaDesde = toNullableDate(formData.get('fecha_desde'))
  const observaciones = toNullableString(formData.get('observaciones'))

  if (!causa || !fechaDesde) {
    redirect('/personas?error=Datos%20inv%C3%A1lidos')
  }

  const { error } = await supabase.rpc('rpc_persona_inactivar', {
    p_dni: dni,
    p_causa: causa,
    p_fecha_desde: fechaDesde,
    p_observaciones: observaciones,
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

  const fechaHasta = toNullableDate(formData.get('fecha_hasta'))

  if (!fechaHasta) {
    redirect(`/personas/${dni}?error=Fecha%20de%20reactivaci%C3%B3n%20inv%C3%A1lida`)
  }

  const { error } = await supabase.rpc('rpc_persona_reactivar', {
    p_dni: dni,
    p_fecha_hasta: fechaHasta,
  })

  if (error) {
    redirect(`/personas/${dni}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  redirect(`/personas/${dni}`)
}
