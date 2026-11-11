import Link from 'next/link'
import Form from 'next/form'
import { fechaHoraCarga, fechaVisible, type LicenciaCarga } from '@/lib/licencias/domain'
import { ActualizarListado } from './actualizar-listado'

export function DatosCarga({ registro }: { registro: LicenciaCarga }) {
  return <dl className="grid gap-4 text-sm sm:grid-cols-3">
    <div><dt className="text-xs text-zinc-400">Agente</dt><dd className="mt-1 font-medium">{registro.apellido_nombre}</dd><dd className="mt-1 text-xs text-zinc-400">DNI {registro.dni} · Licencia #{registro.id}</dd></div>
    <div><dt className="text-xs text-zinc-400">Licencia y período</dt><dd className="mt-1">{registro.tipo.codigo ? `${registro.tipo.codigo} · ` : ''}{registro.tipo.nombre}</dd><dd className="mt-1 text-xs text-zinc-400">{fechaVisible(registro.desde)} al {fechaVisible(registro.hasta)} · {registro.dias} {registro.tipo.codigo === '29' ? 'días hábiles' : 'días'}</dd></div>
    <div><dt className="text-xs text-zinc-400">Cargada por</dt><dd className="mt-1 break-words">{registro.creado_por || (registro.origen === 'importacion' ? 'Importación anterior' : 'Usuario no registrado')}</dd><dd className="mt-1 text-xs text-zinc-400"><time dateTime={registro.created_at}>{fechaHoraCarga(registro.created_at)}</time></dd></div>
  </dl>
}

export function UltimasLicenciasListado({ registros, q, estado, pagina, hayMas, puedeAdministrar, puedeVerFicha }: {
  registros: LicenciaCarga[]; q: string; estado: string; pagina: number; hayMas: boolean; puedeAdministrar: boolean; puedeVerFicha: boolean
}) {
  const input = 'min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none'
  const hrefPagina = (value: number) => `/licencias/ultimas?${new URLSearchParams({ q, estado, pagina: String(value) })}`
  return <div className="space-y-5">
    <Form action="/licencias/ultimas" className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <div><label htmlFor="buscar-cargas" className="mb-2 block text-sm">Buscar agente en las cargas</label><input id="buscar-cargas" name="q" defaultValue={q} key={q} maxLength={150} placeholder="Apellido, nombre, DNI o legajo" className={input} /></div>
      <div><label htmlFor="estado-cargas" className="mb-2 block text-sm">Estado</label><select id="estado-cargas" name="estado" defaultValue={estado} key={estado} className={input}><option value="vigentes">Vigentes</option><option value="borradas">Borradas</option><option value="todas">Todas</option></select></div>
      <button type="submit" className="min-h-11 rounded-lg bg-white px-5 text-sm font-semibold text-black hover:bg-sky-100">Aplicar filtros</button>
    </Form>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400"><p>Más recientes primero · 25 por página · Horario de Argentina</p><ActualizarListado /></div>
    {!puedeAdministrar ? <p className="rounded-lg border border-zinc-800 p-3 text-sm text-zinc-400">Podés consultar las cargas. Editar y borrar requieren permiso de administración de licencias.</p> : null}
    {!registros.length ? <p role="status" className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">No hay licencias para los filtros seleccionados.</p> : <ul className="space-y-4" aria-label="Últimas licencias cargadas">{registros.map((registro) => <li key={registro.id}>
      <article aria-label={`Licencia ${registro.id} de ${registro.apellido_nombre}`} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="p-5"><DatosCarga registro={registro} /></div>
        {registro.anulado_at ? <div className="space-y-1 border-t border-red-400/15 bg-red-400/5 px-5 py-3 text-xs text-red-200"><p>Borrada por {registro.anulado_por || 'usuario no registrado'} · {fechaHoraCarga(registro.anulado_at)}</p>{registro.motivo_borrado ? <p className="break-words">Motivo: {registro.motivo_borrado}</p> : null}</div> : registro.updated_at !== registro.created_at ? <p className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-400">Última edición: {registro.actualizado_por || 'usuario no registrado'} · {fechaHoraCarga(registro.updated_at)}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/30 px-5 py-2">
          <span className={`rounded-full px-2.5 py-1 text-xs ${registro.anulado_at ? 'bg-red-400/10 text-red-200' : 'bg-emerald-400/10 text-emerald-200'}`}>{registro.anulado_at ? 'Borrada · no cuenta en la ficha' : 'Vigente'}</span>
          <div className="flex flex-wrap gap-2">
            {puedeVerFicha ? <Link href={`/licencias/fichas/${registro.dni}?anio=${registro.desde.slice(0, 4)}`} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-sky-300 underline underline-offset-4">Ver ficha</Link> : null}
            {puedeAdministrar && !registro.anulado_at ? <><Link href={`/licencias/ultimas/${registro.id}/editar`} className="inline-flex min-h-11 items-center rounded-lg border border-zinc-600 px-4 text-sm hover:bg-zinc-800">Editar</Link><Link href={`/licencias/ultimas/${registro.id}/borrar`} className="inline-flex min-h-11 items-center rounded-lg border border-red-400/30 px-4 text-sm text-red-200 hover:bg-red-400/10">Borrar</Link></> : null}
          </div>
        </div>
      </article>
    </li>)}</ul>}
    <nav aria-label="Páginas de últimas cargas" className="flex flex-wrap items-center justify-between gap-4 text-sm">
      {pagina > 1 ? <Link href={hrefPagina(pagina - 1)} className="inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">← Anteriores</Link> : <span />}
      <p className="text-zinc-400">Página {pagina}</p>
      {hayMas ? <Link href={hrefPagina(pagina + 1)} className="inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">Siguientes →</Link> : <span />}
    </nav>
  </div>
}
