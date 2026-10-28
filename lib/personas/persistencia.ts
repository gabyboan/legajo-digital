import 'server-only'
import type { createClient } from '@/utils/supabase/server'
import { contactoDesdeRegistro, errorTelefono, versionContacto, type ContactoRegistro } from './contacto'
import type { DatosPersona, PersonaFieldErrors } from './types'
import { obtenerDomicilioVigente } from './consultas'
import { tieneDomicilio, versionDomicilio } from './domicilio'

type Client = Awaited<ReturnType<typeof createClient>>

export function argumentosPersona(datos: DatosPersona, contacto: ContactoRegistro, horarioRotativo: boolean | null) {
  const { identificacion: i, contacto: c, laboral: l, formacion: f } = datos
  return {
    p_dni: i.dni, p_apellido: i.apellido, p_nombre: i.nombre,
    p_fecha_nacimiento: i.fechaNacimiento, p_email: c.email,
    p_telefono: contacto.telefono, p_numero_contacto: contacto.numero_contacto,
    p_legajo: l.legajo, p_carrera_id: l.carreraId, p_situacion_id: l.situacionId,
    p_horario_rotativo: horarioRotativo,
    p_cuil: i.cuil, p_reloj: l.reloj, p_indice: l.indice, p_sexo_id: i.sexoId,
    p_estado_civil: i.estadoCivil, p_fecha_ingreso: l.fechaIngreso,
    p_formacion_estudio: f.estudio, p_matricula: f.matricula,
    p_nivel_escolaridad: f.nivel, p_estado_escolaridad: f.estado,
    p_fecha_inicio_tarea_especifica: l.fechaInicioTareaEspecifica,
    p_observacion: datos.observaciones, p_domicilio: datos.domicilio?.valores ?? null,
  }
}

function errorGuardado(error: { code?: string; message?: string }) {
  if (error.code === 'P4090') return 'Otra edición actualizó esta ficha desde que la abriste. No se guardaron tus cambios. Conservamos tu borrador; recargá la ficha y revisá los datos actuales antes de volver a guardarla.'
  if (error.code === '55P03' || error.code === '40P01') return 'Otra operación está trabajando sobre esta ficha. Conservamos tu borrador. Esperá unos segundos y volvé a intentarlo; si cambió la ficha, será necesario recargarla.'
  if (error.code === '42501') return 'No tenés permisos para guardar estos cambios.'
  if (error.code === '23505') return 'Ya existe un registro con esos datos. Revisá DNI y legajo.'
  if (error.code === '23503') return 'Una opción seleccionada ya no está disponible. Volvé a cargar el formulario.'
  return 'No se pudieron guardar los cambios. Intentá nuevamente; si persiste, contactá al administrador.'
}

export async function guardarEdicionPersona(client: Client, datos: DatosPersona): Promise<
  { ok: true } | { ok: false; message: string; errors?: PersonaFieldErrors }
> {
  if (!datos.version || !/^[a-f0-9]{32}$/.test(datos.version)) {
    return { ok: false, message: 'No se pudo comprobar la versión de la ficha. Recargala antes de guardar. No se guardaron cambios.' }
  }
  const { data: actual, error } = await client.from('personas')
    .select('telefono, numero_contacto').eq('dni', datos.identificacion.dni).maybeSingle()
  if (error) return { ok: false, message: 'No se pudo comprobar el contacto actual. No se guardaron cambios.' }
  if (!actual) return { ok: false, message: 'La persona ya no está disponible. Volvé al listado.' }
  if (!datos.contacto.version || datos.contacto.version !== versionContacto(actual)) {
    return { ok: false, message: 'El contacto cambió desde que abriste la ficha. Volvé a cargarla antes de guardar.', errors: { telefono: 'Volvé a cargar la ficha para revisar los datos actuales.' } }
  }
  const contacto = contactoDesdeRegistro(actual)
  const preservarPendiente = contacto.pendiente && !datos.contacto.confirmarRevision
  const telefonoError = errorTelefono(datos.contacto.telefono)
  if (!preservarPendiente && telefonoError) {
    return { ok: false, message: 'Revisá el teléfono antes de guardar.', errors: { telefono: telefonoError } }
  }
  // Conflicting old numbers remain untouched until explicitly reviewed.
  const destino = preservarPendiente
    ? actual
    : { telefono: datos.contacto.telefono, numero_contacto: null }
  let domicilioSinCambios = false
  if (datos.domicilio) {
    const vigente = await obtenerDomicilioVigente(client, datos.identificacion.dni)
    if (vigente.error) return { ok: false, message: 'No se pudo leer el domicilio vigente. No se guardaron cambios. Recargá la ficha antes de volver a intentarlo.', errors: { calle: 'No se pudo comprobar el domicilio guardado.' } }
    if (!datos.domicilio.version || datos.domicilio.version !== versionDomicilio(vigente.data)) {
      return { ok: false, message: 'El domicilio cambió o no se pudo cargar al abrir la ficha. Recargala antes de guardar para conservar la versión actual.', errors: { calle: 'Revisá el domicilio vigente antes de guardar.' } }
    }
    if (tieneDomicilio(vigente.data) && !tieneDomicilio(datos.domicilio.valores)) {
      return { ok: false, message: 'El domicilio quedó vacío. Revisá los datos antes de guardar; el domicilio vigente se conserva.', errors: { calle: 'Completá el domicilio que debe quedar registrado.' } }
    }
    domicilioSinCambios = versionDomicilio(vigente.data) === versionDomicilio(datos.domicilio.valores)
  }
  const args = argumentosPersona(datos, destino, null)
  if (domicilioSinCambios) args.p_domicilio = null
  const result = await client.rpc('rpc_persona_editar_versionada', { p_datos: args, p_version: datos.version })
  if (result.error) return { ok: false, message: errorGuardado(result.error) }
  if (datos.domicilio) {
    const guardado = await obtenerDomicilioVigente(client, datos.identificacion.dni)
    if (guardado.error || versionDomicilio(guardado.data) !== versionDomicilio(datos.domicilio.valores)) {
      return { ok: false, message: 'La ficha se guardó, pero no se pudo confirmar el domicilio actualizado. Conservamos lo escrito en el formulario para que puedas revisarlo.', errors: { calle: 'No se confirmó el domicilio después de guardar. Revisá el registro antes de volver a enviarlo.' } }
    }
  }
  return { ok: true }
}

export async function guardarAltaPersona(client: Client, datos: DatosPersona, horarioRotativo: boolean) {
  const telefonoError = errorTelefono(datos.contacto.telefono)
  if (telefonoError) return { ok: false as const, message: telefonoError }
  const result = await client.rpc('rpc_persona_guardar_con_escolaridad', argumentosPersona(datos, {
    telefono: datos.contacto.telefono, numero_contacto: null,
  }, horarioRotativo))
  return result.error ? { ok: false as const, message: errorGuardado(result.error) } : { ok: true as const }
}
