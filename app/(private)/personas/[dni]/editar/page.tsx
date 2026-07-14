import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import {
  canCurrentUserEditLegajo,
  canCurrentUserWriteFrancos,
} from '../../permissions'
import { AsistenciaEditForm } from './components/asistencia-edit-form'
import {
  BancoInicialHorasForm,
  type BancoInicialHoras,
} from './components/banco-inicial-horas-form'
import { PersonaEditForm } from './components/persona-edit-form'
import {
  FamiliaresEditForm,
  type Familiar,
} from './components/familiares-edit-form'

type EditarPersonaPageProps = {
  params: Promise<{ dni: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type HorarioPersona = {
  dia_semana: number
  hora_desde: string
  hora_hasta: string
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  )
}

function humanizeError(message: string) {
  if (message.includes('persona_familiares_persona_dni_familiar_dni_uidx')) {
    return 'Ya existe un familiar cargado con ese DNI. Usá Editar sobre el registro existente.'
  }

  return message
}

export default async function EditarPersonaPage({
  params,
  searchParams,
}: EditarPersonaPageProps) {
  const { dni } = await params
  const dniNumber = Number(dni)

  if (!Number.isInteger(dniNumber)) {
    notFound()
  }

  const supabase = await createClient()
  const [canEdit, canWriteFrancos] = await Promise.all([
    canCurrentUserEditLegajo(supabase),
    canCurrentUserWriteFrancos(supabase),
  ])

  if (!canEdit) {
    redirect(
      `/personas/${dniNumber}?error=No%20ten%C3%A9s%20permisos%20para%20editar`
    )
  }

  const [
    personaRes,
    situacionesRes,
    situacionActualRes,
    carrerasRes,
    carreraActualRes,
    familiaresRes,
    sexosRes,
    domicilioRes,
  ] = await Promise.all([
    supabase
      .from('personas')
      .select(
        'dni, legajo, apellido, nombre, email, telefono, fecha_nacimiento, horario_rotativo, cuil, reloj, indice, sexo_id, numero_contacto, estado_civil, fecha_ingreso, formacion_estudio, matricula, nivel_escolaridad, fecha_inicio_tarea_especifica, observacion'
      )
      .eq('dni', dniNumber)
      .maybeSingle(),

    supabase
      .from('situacion_revista')
      .select('id, nombre')
      .order('nombre', { ascending: true }),

    supabase
      .from('persona_situacion_revista')
      .select('situacion_id')
      .eq('dni', dniNumber)
      .order('situacion_id'),

    supabase
      .from('carreras')
      .select('id, nombre')
      .order('id', { ascending: true }),

    supabase
      .from('persona_carreras')
      .select('carrera_id')
      .eq('dni', dniNumber)
      .limit(1),

    supabase
      .from('persona_familiares')
      .select('id, apellido, nombre, fecha_nacimiento, dni, parentesco')
      .eq('persona_dni', dniNumber)
      .order('apellido')
      .order('nombre'),

    supabase
      .from('sexos')
      .select('id, nombre')
      .order('id', { ascending: true }),

    supabase
      .from('persona_domicilios')
      .select('calle, numero, barrio, manzana, lote, monoblock, piso, departamento, referencias, otros_datos, provincia_georef_id, provincia_nombre, localidad_georef_id, localidad_nombre')
      .eq('persona_dni', dniNumber)
      .is('vigente_hasta', null)
      .maybeSingle()
  ])

  if (personaRes.error) {
    throw new Error(personaRes.error.message)
  }

  const persona = personaRes.data

  if (!persona) {
    notFound()
  }

  const situaciones = situacionesRes.data ?? []
  const carreras = carrerasRes.data ?? []
  const sexos = sexosRes.data ?? []
  const domicilio = domicilioRes.data

  const situacionActualId =
    situacionActualRes.data && situacionActualRes.data.length > 0
      ? String(situacionActualRes.data[0].situacion_id)
      : ''

  const carreraActualId =
    carreraActualRes.data && carreraActualRes.data.length > 0
      ? String(carreraActualRes.data[0].carrera_id)
      : ''

  const horariosActualesRes = carreraActualId
    ? await supabase.rpc('rpc_francos_horario', {
        p_dni: dniNumber,
        p_carrera_id: Number(carreraActualId),
      })
    : { data: [], error: null }

  const bancoInicialRes = carreraActualId
    ? await supabase.rpc('rpc_francos_saldo_inicial_actual', {
        p_dni: dniNumber,
        p_carrera_id: Number(carreraActualId),
      })
    : { data: [], error: null }

  const horariosPorDia = new Map<number, HorarioPersona>()

  for (const row of (horariosActualesRes.data ?? []) as HorarioPersona[]) {
    if (!horariosPorDia.has(row.dia_semana)) {
      horariosPorDia.set(row.dia_semana, row)
    }
  }

  const paramsSearch = (await searchParams) ?? {}
  const rawError = paramsSearch.error
  const error = Array.isArray(rawError) ? rawError[0] : rawError

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/personas/${persona.dni}`}
          className="text-sm text-zinc-400 underline underline-offset-4"
        >
          ← Volver a la ficha
        </Link>

        <h1 className="mt-3 text-2xl font-bold">Editar persona</h1>
      </div>

      {error ? <ErrorBanner message={humanizeError(error)} /> : null}
      {situacionesRes.error ? (
        <ErrorBanner
          message={`Error al cargar Situacion de Revista: ${situacionesRes.error.message}`}
        />
      ) : null}
      {carrerasRes.error ? (
        <ErrorBanner
          message={`Error al cargar Carreras: ${carrerasRes.error.message}`}
        />
      ) : null}
      {familiaresRes.error ? (
        <ErrorBanner message={`Error al cargar familiares: ${familiaresRes.error.message}`} />
      ) : null}
      {horariosActualesRes.error && carreraActualId ? (
        <ErrorBanner
          message={`Error al cargar asistencia: ${horariosActualesRes.error.message}`}
        />
      ) : null}
      {bancoInicialRes.error && carreraActualId ? (
        <ErrorBanner
          message={`Error al cargar banco inicial: ${bancoInicialRes.error.message}`}
        />
      ) : null}

      <PersonaEditForm
        persona={persona}
        situaciones={situaciones}
        carreras={carreras}
        sexos={sexos}
        domicilio={domicilio}
        situacionActualId={situacionActualId}
        carreraActualId={carreraActualId}
      />

      <AsistenciaEditForm
        dni={persona.dni}
        carreraActualId={carreraActualId}
        canEditAsistencia={canWriteFrancos}
        horariosPorDia={horariosPorDia}
        horarioRotativo={persona.horario_rotativo}
      />

      <FamiliaresEditForm
        personaDni={persona.dni}
        familiares={(familiaresRes.data ?? []) as Familiar[]}
      />

      <BancoInicialHorasForm
        dni={persona.dni}
        carreraActualId={carreraActualId}
        canEditBancoInicial={canWriteFrancos}
        bancoInicial={
          ((bancoInicialRes.data ?? [])[0] as BancoInicialHoras | undefined) ??
          null
        }
      />
    </section>
  )
}
