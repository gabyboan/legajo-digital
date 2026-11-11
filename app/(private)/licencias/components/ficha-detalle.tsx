import { diasEnAnio, fechaVisible, type LicenciaPersona, type LicenciaRegistro } from '@/lib/licencias/domain'

export function FichaDetalle({ persona, registros, anio }: { persona: LicenciaPersona; registros: LicenciaRegistro[]; anio: number }) {
  const resumen = new Map<string, { registros: number; dias: number }>()
  for (const registro of registros) {
    if (registro.anulado_at) continue
    const label = `${registro.tipo.codigo ? `${registro.tipo.codigo} · ` : ''}${registro.tipo.nombre}`
    const previo = resumen.get(label) ?? { registros: 0, dias: 0 }
    resumen.set(label, { registros: previo.registros + 1, dias: previo.dias + diasEnAnio(registro, anio) })
  }
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{persona.apellido_nombre}</h2><span className={`rounded-full px-3 py-1 text-xs ${persona.activo ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-200'}`}>{persona.activo ? 'Activo' : 'Inactivo'}</span></div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {[
            ['DNI', persona.dni], ['Legajo', persona.legajo], ['Reloj', persona.reloj], ['Carrera', persona.carrera], ['Situación de revista', persona.situacion_revista], ['Función', persona.funcion],
            ['Fecha de ingreso', fechaVisible(persona.fecha_ingreso)], ['Fecha de nacimiento', fechaVisible(persona.fecha_nacimiento)], ['Teléfono', persona.telefono], ['Domicilio', persona.domicilio],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-zinc-400">{label}</dt><dd className="mt-1 break-words">{value || '—'}</dd></div>)}
        </dl>
      </div>
      <div><h2 className="text-lg font-semibold">Resumen de licencias · {anio}</h2><p className="mt-1 text-xs text-zinc-400">Se excluyen los registros anulados. Los días se cuentan dentro del año seleccionado; estudio se cuenta en días hábiles.</p></div>
      {resumen.size ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...resumen].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([tipo, item]) => <div key={tipo} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h3 className="text-sm font-medium">{tipo}</h3><p className="mt-2 text-sm text-zinc-400">{item.registros} registros · {item.dias} días en {anio}</p></div>)}</div> : <p className="rounded-xl border border-zinc-800 p-5 text-sm text-zinc-400">No hay licencias vigentes registradas para este año.</p>}
      <h2 className="text-lg font-semibold">Historial de licencias</h2>
      <div role="region" aria-label="Historial de licencias" tabIndex={0} className="overflow-x-auto rounded-xl border border-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-400">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400"><tr>{['Tipo', 'Desde', 'Hasta', 'Días', 'Cantidad en ficha', 'Observación', 'Estado'].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-zinc-800">{registros.map((registro) => <tr key={registro.id} className={registro.anulado_at ? 'text-zinc-500' : ''}>
            <td className="px-4 py-3"><p>{registro.tipo.codigo ? `${registro.tipo.codigo} · ` : ''}{registro.tipo.nombre}</p>{registro.imprevisto_id ? <p className="mt-1 text-xs text-zinc-400">Desde Imprevistos</p> : null}</td>
            <td className="whitespace-nowrap px-4 py-3">{fechaVisible(registro.desde)}</td><td className="whitespace-nowrap px-4 py-3">{fechaVisible(registro.hasta)}</td>
            <td className="px-4 py-3">{registro.dias}{registro.tipo.codigo === '29' ? ' hábiles' : ''}{registro.cantidad_dias_ficha != null ? <p className="mt-1 text-xs text-zinc-400">{registro.cantidad_dias_ficha} según ficha</p> : null}</td>
            <td className="px-4 py-3">{registro.cantidad_ficha || '—'}</td>
            <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3">{registro.observacion || '—'}{registro.numero_orden ? <p className="mt-1 text-xs text-zinc-400">Orden: {registro.numero_orden}</p> : null}{registro.dni_familiar ? <p className="mt-1 text-xs text-zinc-400">DNI familiar: {registro.dni_familiar}</p> : null}</td>
            <td className="px-4 py-3">{registro.anulado_at ? 'Anulada' : 'Vigente'}</td>
          </tr>)}{!registros.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">Sin registros para el año seleccionado.</td></tr> : null}</tbody>
        </table>
      </div>
    </div>
  )
}
