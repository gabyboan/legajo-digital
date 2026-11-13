import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fechaHoraCarga, fechaVisible } from '@/lib/licencias/domain'
import { sesionLicencias } from '@/lib/licencias/server'
import { cantidadVisible, estadoTexto, origenes, origenTexto, type Origen } from '@/lib/novedades/domain'
import { controlPath, detalleNovedad, permisosNovedades } from '@/lib/novedades/server'
import { ModuleMessage } from '@/app/(private)/licencias/components/module-message'
import { ActualizarListado } from '@/app/(private)/licencias/ultimas/actualizar-listado'
import { ControlForm } from '../../control-form'

export default async function NovedadPage({ params }: { params: Promise<{ origen: string; id: string }> }) {
  const { origen, id } = await params
  if (!origenes.includes(origen as Origen) || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) notFound()
  const client = await sesionLicencias(`${controlPath}/${origen}/${id}`)
  const permissions = await permisosNovedades(client)
  if (permissions.error || !permissions.leer) return <ModuleMessage error>No se pudo autorizar la consulta de esta novedad.</ModuleMessage>
  const { registro: n, error } = await detalleNovedad(client, origen, Number(id))
  if (error || !n) return <ModuleMessage error>No se pudo consultar la novedad y sus avisos. Actualizá antes de realizar el control.</ModuleMessage>
  const coincidencias = n.coincidencias ?? []
  return <section className="mx-auto max-w-5xl space-y-6">
    <header><Link href={controlPath} className="text-sm text-sky-300 underline">← Control de novedades</Link><h1 className="mt-4 text-2xl font-bold">{origenTexto[n.origen]} #{n.id} · {n.persona}</h1><p className="mt-2 text-zinc-400">DNI {n.dni} · Legajo {n.legajo ?? '—'}{n.carrera_id ? ` · Carrera ${n.carrera_id}` : ''}</p></header>
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="font-semibold">{estadoTexto[n.estado]}</p><p className="mt-2">{n.tipo} · {cantidadVisible(n)} · {fechaVisible(n.desde)} a {fechaVisible(n.hasta)}</p>
      <p className="mt-3 text-sm text-zinc-400">Cargó: {n.cargado_por ?? 'Sin autor registrado'} · {fechaHoraCarga(n.cargado_at)}</p>
      {n.controlado_at ? <p className="mt-2 text-sm text-zinc-400">Control: {n.confirmado_por ?? 'Usuario no disponible'} · {fechaHoraCarga(n.controlado_at)}</p> : null}
      {n.observacion ? <p className="mt-3 whitespace-pre-wrap">{n.observacion}</p> : null}
      {n.control_desactualizado ? <p role="status" className="mt-3 text-amber-200">El control anterior corresponde a otros datos. Revisá la versión actual.</p> : null}
      {n.recarga ? <p className="mt-3 text-sm text-emerald-200">Recarga ya verificada en su circuito de origen. No es un franco tomado ni requiere confirmación del revisor.</p> : null}
      {n.documento.documentacion_pendiente ? <p className="mt-3 text-amber-200">La licencia tiene documentación pendiente en origen.</p> : null}
      {n.documento.cantidad_ficha ? <p className="mt-2 text-sm">Cantidad anotada en ficha: {n.documento.cantidad_ficha}</p> : null}
      {n.origen === 'medico' ? <div className="mt-4 space-y-2 border-t border-zinc-700 pt-4"><h2 className="font-semibold">Parte y licencia</h2><p>Parte emitido · Código {n.documento.codigo ?? '—'}</p><p>{n.documento.devolucion_registrada ? `Devolución registrada · ${n.documento.dias_aprobados} días aprobados` : 'Devolución pendiente: el parte emitido no acredita días aprobados.'}</p><p>{n.licencia_id ? `Licencia vinculada: #${n.licencia_id}` : 'Sin licencia vinculada en este control. No se crea ni se cuenta una licencia automáticamente.'}</p></div> : null}
      <div className="mt-4"><ActualizarListado /></div>
    </div>
    <section className="rounded-2xl border border-amber-500/30 p-5"><h2 className="text-lg font-semibold">Calendario y posibles coincidencias</h2>
      {n.feriados.length ? n.feriados.map((f) => <p key={f.fecha} className="mt-2 text-amber-200">Feriado en Agenda: {fechaVisible(f.fecha)} · {f.nombre}</p>) : <p className="mt-2 text-sm text-zinc-400">No hay feriados registrados en Agenda para este período. Comprobá que el calendario del año esté completo.</p>}
      <p className="mt-2 text-sm text-zinc-400">Los avisos no bloquean por sí solos una carga: puede corresponder trabajar o tomar franco en un feriado. Sábado y domingo no se consideran feriados automáticamente.</p>
      {coincidencias.length ? <><p className="mt-4 text-sm">Otras novedades de esta persona en el período. Coincidir en fechas no prueba una incompatibilidad de horarios.</p><ul className="mt-3 space-y-3">{coincidencias.slice(0, 50).map((c) => <li key={`${c.origen}-${c.id}`} className="rounded-lg bg-zinc-900 p-3"><Link className="text-sky-300 underline" href={`${controlPath}/${c.origen}/${c.id}`}>{origenTexto[c.origen]} #{c.id} · {c.tipo}</Link><p className="mt-1 text-sm text-zinc-400">{fechaVisible(c.desde)} a {fechaVisible(c.hasta)} · {cantidadVisible(c)}</p></li>)}</ul>{coincidencias.length > 50 ? <p className="mt-3 text-amber-200">Se muestran las primeras 50 coincidencias. Consultá la ficha y acotá el listado para revisar las restantes.</p> : null}</> : <p className="mt-4 text-sm text-zinc-400">No se encontraron otras novedades vigentes que coincidan en este período.</p>}
    </section>
    {permissions.confirmar && !n.recarga && !n.anulada && !n.carga_propia ? <><p className="text-sm text-zinc-400">La confirmación es administrativa. Si falta la devolución médica o el franco es futuro, podés dejar una observación y completar la confirmación después.</p><ControlForm key={`${n.version}-${n.control_id}-${n.calendario_version}`} novedad={n} operacion={randomUUID()} /></> : <p className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">{n.carga_propia ? 'Otra persona debe controlar esta carga: participaste de su registro o modificación.' : n.recarga || n.anulada ? 'Esta novedad no requiere o no admite confirmación.' : 'Podés consultar. Para guardar un control necesitás el permiso específico de confirmación.'}</p>}
    <section><h2 className="text-lg font-semibold">Historial de controles</h2><div className="mt-3 space-y-3">{n.historial?.length ? n.historial.map((c) => <article key={c.id} className="rounded-xl border border-zinc-800 p-4"><p>{estadoTexto[c.estado]} · {c.usuario ?? 'Usuario no disponible'} · {fechaHoraCarga(c.fecha)}</p>{c.version !== n.version ? <p className="mt-1 text-xs text-amber-200">Versión anterior de la novedad</p> : null}{c.licencia_id ? <p className="mt-1 text-sm">Licencia vinculada en ese control: #{c.licencia_id}</p> : null}{c.observacion ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{c.observacion}</p> : null}</article>) : <p className="text-sm text-zinc-400">Todavía no hay controles registrados.</p>}</div><p className="mt-3 text-xs text-zinc-500">Se muestran hasta 50 controles recientes. Los anteriores se conservan en el registro de auditoría.</p></section>
  </section>
}
