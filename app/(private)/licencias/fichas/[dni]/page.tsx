import Link from 'next/link'
import { anioConsulta, fechaActual, primerParametro } from '@/lib/licencias/domain'
import { historialLicencias, permisosLicencias, personasLicencias, sesionLicencias } from '@/lib/licencias/server'
import { ModuleMessage } from '../../components/module-message'
import { FichaDetalle } from '../../components/ficha-detalle'
import { FichaPapel } from '../../components/ficha-papel'
import { ImprimirFicha } from '../../components/imprimir-ficha'

export default async function FichaLicenciasPage({ params, searchParams }: { params: Promise<{ dni: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { dni } = await params
  const query = await searchParams
  const anio = anioConsulta(primerParametro(query.anio))
  const vista = primerParametro(query.vista) === 'ficha' ? 'ficha' : 'detalle'
  const destino = `/licencias/fichas/${dni}`
  const supabase = await sesionLicencias(`${destino}?${new URLSearchParams({ anio: String(anio), vista })}`)
  const permisos = await permisosLicencias(supabase)
  if (permisos.error) return <ModuleMessage error>No se pudieron comprobar los permisos de fichas. Volvé a intentarlo.</ModuleMessage>
  if (!permisos.ficha) return <ModuleMessage>No tenés permiso para consultar fichas. Consultá al administrador.</ModuleMessage>
  if (!/^\d{1,8}$/.test(dni) || Number(dni) < 1) return <ModuleMessage>El DNI de la ficha es inválido.</ModuleMessage>
  const { personas, error } = await personasLicencias(supabase, dni, true)
  if (error) return <ModuleMessage error>No se pudo consultar la ficha del agente. Volvé a intentarlo.</ModuleMessage>
  const persona = personas.find((item) => String(item.dni) === dni)
  if (!persona) return <ModuleMessage>No se encontró la ficha del agente.</ModuleMessage>
  const historial = await historialLicencias(supabase, anio, Number(dni))
  if (historial.error) return <ModuleMessage error>No se pudo cargar el historial de licencias. Volvé a intentarlo.</ModuleMessage>
  const current = Number(fechaActual().slice(0, 4))
  return (
    <section className="space-y-6">
      <div className="print:hidden"><Link href="/licencias/fichas" className="text-sm text-zinc-400 underline underline-offset-4">← Ver fichas</Link><h1 className="mt-4 text-2xl font-bold">Ficha de licencias</h1></div>
      <div className="space-y-4 print:hidden">
        <nav aria-label="Vista de la ficha" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-1">
          {[{ value: 'detalle', label: 'Resumen e historial' }, { value: 'ficha', label: 'Formato ficha' }].map(({ value, label }) => (
            <Link key={value} href={`${destino}?${new URLSearchParams({ anio: String(anio), vista: value })}`} aria-current={vista === value ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${vista === value ? 'bg-sky-400/15 font-semibold text-sky-200' : 'text-zinc-300 hover:bg-zinc-800'}`}>{label}</Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form action={destino} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="vista" value={vista} />
            <div><label htmlFor="anio" className="mb-2 block text-sm">Año de la ficha</label><select id="anio" name="anio" defaultValue={anio} className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm focus:outline-2 focus:outline-sky-400">{Array.from({ length: current - 2026 + 2 }, (_, index) => current + 1 - index).map((year) => <option key={year}>{year}</option>)}</select></div>
            <button className="min-h-11 rounded-lg border border-zinc-600 px-4 text-sm hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-400">Consultar año</button>
          </form>
          {vista === 'ficha' ? <ImprimirFicha /> : null}
        </div>
        {vista === 'ficha' ? <p className="text-sm text-zinc-400">Formato de la ficha de papel, en hojas A4 horizontales. Deslizá para ver todas las columnas.</p> : null}
      </div>
      {vista === 'ficha' ? <FichaPapel persona={persona} registros={historial.registros} anio={anio} /> : <FichaDetalle persona={persona} registros={historial.registros} anio={anio} />}
    </section>
  )
}
