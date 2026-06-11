import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { canCurrentUserEditLegajo } from '../permissions'
import { AsistenciaCard, type HorarioPersona } from './components/asistencia-card'
import { DatosPersonalesCard } from './components/datos-personales-card'
import { EstadoLegajoCard } from './components/estado-legajo-card'
import { PersonaHeader } from './components/persona-header'
import { ProximosModulosCard } from './components/proximos-modulos-card'

type PersonaDetallePageProps = {
  params: Promise<{ dni: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getRelatedNombre(row: unknown, relationName: string) {
  if (!row || typeof row !== 'object') {
    return '-'
  }

  const relation = (row as Record<string, unknown>)[relationName]

  if (Array.isArray(relation)) {
    const first = relation[0]

    if (!first || typeof first !== 'object') {
      return '-'
    }

    const nombre = (first as Record<string, unknown>).nombre
    return typeof nombre === 'string' && nombre.trim() !== '' ? nombre : '-'
  }

  if (!relation || typeof relation !== 'object') {
    return '-'
  }

  const nombre = (relation as Record<string, unknown>).nombre
  return typeof nombre === 'string' && nombre.trim() !== '' ? nombre : '-'
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  )
}

export default async function PersonaDetallePage({
  params,
  searchParams,
}: PersonaDetallePageProps) {
  const { dni } = await params
  const dniNumber = Number(dni)

  if (!Number.isInteger(dniNumber)) {
    notFound()
  }

  const supabase = await createClient()

  const [
    personaRes,
    inactivoRes,
    situacionActualRes,
    carreraActualRes,
    canEdit,
  ] = await Promise.all([
    supabase
      .from('personas')
      .select(
        'dni, legajo, apellido, nombre, email, telefono, fecha_nacimiento, created_at, updated_at, horario_rotativo'
      )
      .eq('dni', dniNumber)
      .maybeSingle(),

    supabase
      .from('persona_inactivo')
      .select('dni, causa, fecha, observaciones')
      .eq('dni', dniNumber)
      .maybeSingle(),

    supabase
      .from('persona_situacion_revista')
      .select('situacion_id, situacion_revista(nombre)')
      .eq('dni', dniNumber)
      .limit(1),

    supabase
      .from('persona_carreras')
      .select('carrera_id, carreras(nombre)')
      .eq('dni', dniNumber)
      .limit(1),

    canCurrentUserEditLegajo(supabase),
  ])

  if (personaRes.error) {
    throw new Error(personaRes.error.message)
  }

  if (!personaRes.data) {
    notFound()
  }

  const persona = personaRes.data
  const inactivo = inactivoRes.data

  const situacionActualNombre = getRelatedNombre(
    situacionActualRes.data?.[0],
    'situacion_revista'
  )

  const carreraActualNombre = getRelatedNombre(
    carreraActualRes.data?.[0],
    'carreras'
  )

  const carreraActualId =
    carreraActualRes.data && carreraActualRes.data.length > 0
      ? Number(carreraActualRes.data[0].carrera_id)
      : null

  const horariosRes = carreraActualId
    ? await supabase.rpc('rpc_francos_horario', {
        p_dni: dniNumber,
        p_carrera_id: carreraActualId,
      })
    : { data: [], error: null }

  const horarios = ((horariosRes.data ?? []) as HorarioPersona[]).toSorted(
    (a, b) =>
      a.dia_semana - b.dia_semana ||
      a.hora_desde.localeCompare(b.hora_desde)
  )

  const paramsSearch = (await searchParams) ?? {}
  const rawError = paramsSearch.error
  const error = Array.isArray(rawError) ? rawError[0] : rawError

  return (
    <section className="space-y-6">
      <PersonaHeader
        dni={persona.dni}
        apellido={persona.apellido}
        nombre={persona.nombre}
        legajo={persona.legajo}
        carrera={carreraActualNombre}
        canEdit={canEdit}
      />

      {error ? <ErrorBanner message={error} /> : null}
      {inactivoRes.error ? (
        <ErrorBanner
          message={`Error al cargar estado del legajo: ${inactivoRes.error.message}`}
        />
      ) : null}
      {situacionActualRes.error ? (
        <ErrorBanner
          message={`Error al cargar situacion de revista: ${situacionActualRes.error.message}`}
        />
      ) : null}
      {carreraActualRes.error ? (
        <ErrorBanner
          message={`Error al cargar carrera: ${carreraActualRes.error.message}`}
        />
      ) : null}
      {horariosRes.error ? (
        <ErrorBanner
          message={`Error al cargar asistencia: ${horariosRes.error.message}`}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <DatosPersonalesCard
          persona={persona}
          inactivo={Boolean(inactivo)}
          carrera={carreraActualNombre}
          situacion={situacionActualNombre}
        />

        <div className="space-y-6">
          <AsistenciaCard
            dni={persona.dni}
            horarios={horarios}
            horarioRotativo={persona.horario_rotativo}
            canEdit={canEdit}
          />

          <EstadoLegajoCard
            dni={persona.dni}
            inactivo={inactivo}
            canEdit={canEdit}
          />

          <ProximosModulosCard />
        </div>
      </div>
    </section>
  )
}
