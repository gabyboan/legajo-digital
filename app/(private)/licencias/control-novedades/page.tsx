import Link from 'next/link'
import { fechaHoraCarga, fechaVisible } from '@/lib/licencias/domain'
import { sesionLicencias } from '@/lib/licencias/server'
import { redirigirSiSesionVencida } from '@/lib/auth/session-server'
import { cantidadVisible, estados, estadoTexto, filtrosNovedades, origenes, origenTexto, type Novedad, type Origen } from '@/lib/novedades/domain'
import { controlPath, permisosNovedades } from '@/lib/novedades/server'
import { ModuleMessage } from '../components/module-message'
import { ActualizarListado } from '../ultimas/actualizar-listado'

export default async function ControlNovedadesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = filtrosNovedades(await searchParams)
  const client = await sesionLicencias(controlPath)
  const permissions = await permisosNovedades(client)
  if (permissions.error) return <ModuleMessage error>No se pudo comprobar el acceso a Control de novedades. Revisá la conexión y que la base tenga la actualización del módulo.</ModuleMessage>
  if (!permissions.leer) return <ModuleMessage>Necesitás lectura de Licencias y el permiso de consulta o confirmación de novedades. Solicitá la habilitación al responsable.</ModuleMessage>
  const result = filters.valid ? await client.rpc('rpc_novedades_listar', { p_desde: filters.desde, p_hasta: filters.hasta, p_buscar: filters.q, p_origen: filters.origen, p_estado: filters.estado, p_offset: (filters.pagina - 1) * 25, p_limite: 26 }) : null
  redirigirSiSesionVencida(result?.error, controlPath)
  const rows = (result?.error ? [] : result?.data ?? []) as Novedad[]
  const pageLink = (page: number) => `${controlPath}?${new URLSearchParams({ desde: filters.desde, hasta: filters.hasta, q: filters.q, origen: filters.origen, estado: filters.estado, pagina: String(page) })}`
  const input = 'min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2'
  return <section className="space-y-6">
    <header><Link href="/licencias" className="text-sm text-zinc-400 underline">← Licencias</Link><h1 className="mt-4 text-2xl font-bold">Control de novedades</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Corroborá francos tomados y revisá horas, licencias y partes. Confirmar deja constancia del control sin volver a descontar banco ni sumar días.</p></header>
    <form method="get" className="grid gap-4 rounded-2xl border border-zinc-800 p-4 sm:grid-cols-2 xl:grid-cols-3">
      <label>Agente<input className={input} type="search" name="q" maxLength={150} defaultValue={filters.q} placeholder="Apellido, nombre, DNI o legajo" /></label>
      <label>Desde<input className={input} type="date" name="desde" required min="2026-01-01" defaultValue={filters.desde} /></label>
      <label>Hasta<input className={input} type="date" name="hasta" required min="2026-01-01" defaultValue={filters.hasta} /></label>
      <label>Origen<select className={input} name="origen" defaultValue={filters.origen}><option value="">Todos los módulos</option>{origenes.map((v) => <option key={v} value={v}>{origenTexto[v]}</option>)}</select></label>
      <label>Estado<select className={input} name="estado" defaultValue={filters.estado}><option value="todas">Todos los estados</option>{estados.map((v) => <option key={v} value={v}>{estadoTexto[v]}</option>)}</select></label>
      <div className="flex items-end gap-4"><button className="min-h-11 rounded-lg bg-sky-200 px-4 py-2 font-semibold text-zinc-950">Consultar</button><ActualizarListado /></div>
    </form>
    {!filters.valid ? <p role="alert" className="text-amber-200">Elegí un período válido desde 2026, de hasta 366 días.</p> : result?.error ? <p role="alert" className="text-amber-200">No se pudieron consultar las novedades y el calendario. No se muestran resultados parciales. Volvé a intentar.</p> : <>
      <p className="text-sm text-zinc-400">Las recargas ya verificadas están separadas: elegí Recarga verificada para consultarlas. Los avisos de feriados usan Agenda y no incluyen automáticamente todos los fines de semana.</p>
      <div className="space-y-3">{rows.slice(0, 25).map((n) => <article key={`${n.origen}-${n.id}`} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{n.persona}</h2><p className="text-sm text-zinc-400">DNI {n.dni} · Legajo {n.legajo ?? '—'} · {origenTexto[n.origen as Origen]} #{n.id}</p></div><span className={n.estado === 'confirmada' || n.recarga ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-amber-200'}>{estadoTexto[n.estado]}</span></div>
        <p className="mt-3">{n.tipo} · {fechaVisible(n.desde)}{n.hasta !== n.desde ? ` a ${fechaVisible(n.hasta)}` : ''} · {cantidadVisible(n)}</p>
        <p className="mt-2 text-xs text-zinc-400">Cargó: {n.cargado_por ?? 'Sin autor registrado'} · {fechaHoraCarga(n.cargado_at)}</p>
        {n.controlado_at ? <p className="mt-1 text-xs text-zinc-400">Control: {n.confirmado_por ?? 'Usuario no disponible'} · {fechaHoraCarga(n.controlado_at)}</p> : null}
        {n.feriados.map((f) => <p key={f.fecha} className="mt-2 text-sm text-amber-200">Feriado en Agenda: {fechaVisible(f.fecha)} · {f.nombre}</p>)}
        {n.control_desactualizado ? <p className="mt-2 text-sm text-amber-200">Cambió la novedad, el calendario o la licencia vinculada: requiere nuevo control.</p> : null}
        <Link href={`${controlPath}/${n.origen}/${n.id}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-sky-300 underline underline-offset-4">Abrir control y coincidencias →</Link>
      </article>)}{!rows.length ? <p className="rounded-xl border border-zinc-800 p-6 text-zinc-400">No hay novedades para estos filtros.</p> : null}</div>
      <nav aria-label="Páginas de novedades" className="flex gap-6">{filters.pagina > 1 ? <Link className="min-h-11 py-2 text-sky-300 underline" href={pageLink(filters.pagina - 1)}>← Anterior</Link> : null}<span className="py-2">Página {filters.pagina}</span>{rows.length > 25 ? <Link className="min-h-11 py-2 text-sky-300 underline" href={pageLink(filters.pagina + 1)}>Siguiente →</Link> : null}</nav>
    </>}
  </section>
}
