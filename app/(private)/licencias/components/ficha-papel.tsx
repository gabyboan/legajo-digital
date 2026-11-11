import { fechaVisible, type LicenciaPersona, type LicenciaRegistro } from '@/lib/licencias/domain'
import { ANCHOS_FICHA, FILAS_CONTINUACION, FILAS_PRIMERA_HOJA, paginarFicha } from '@/lib/licencias/ficha-papel'
import styles from './ficha-papel.module.css'

export function FichaPapel({ persona, registros, anio }: { persona: LicenciaPersona; registros: LicenciaRegistro[]; anio: number }) {
  const paginas = paginarFicha(registros, persona.dni, anio)
  const anchoTotal = ANCHOS_FICHA.reduce((total, ancho) => total + ancho, 0)
  return (
    <div role="region" aria-label="Ficha en formato papel" tabIndex={0} className={styles.root}>
      {paginas.map((pagina, indice) => (
        <article key={indice} className={styles.paper} aria-label={`Hoja ${indice + 1} de ${paginas.length}`}>
          <div className={styles.heading}>
            <h2>FICHA DE REGISTRO DE LICENCIAS</h2>
            <p>División Recursos Humanos</p>
          </div>
          <div className={styles.identity}>
            <p><strong>Apellido y Nombres:</strong> {persona.apellido_nombre}</p>
            <p><strong>Legajo Nº:</strong> {persona.legajo ?? '—'}</p>
            <p><strong>Documento Nº:</strong> {persona.dni}</p>
          </div>
          {!indice ? <>
            <div className={styles.address}>
              <p><strong>Domicilio:</strong> {persona.domicilio || '—'}</p>
              <p><strong>Fecha de Ingreso:</strong> {fechaVisible(persona.fecha_ingreso)}</p>
              <p><strong>Fecha de Nac.:</strong> {fechaVisible(persona.fecha_nacimiento)}</p>
            </div>
            <div className={styles.additional}>
              <p><strong>Teléfono:</strong> {persona.telefono || '—'}</p>
              <p><strong>Datos adicionales:</strong> {[persona.carrera, persona.situacion_revista, persona.funcion].filter(Boolean).join(' / ') || '—'}</p>
            </div>
          </> : null}
          <table className={styles.table} aria-label={`Planilla de licencias de ${persona.apellido_nombre}, ${anio}, hoja ${indice + 1}`}>
            <colgroup>{ANCHOS_FICHA.map((ancho, columna) => <col key={columna} style={{ width: `${ancho * 100 / anchoTotal}%` }} />)}</colgroup>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>Cod.</th>
                <th scope="col" rowSpan={2}>Lic. Anual</th>
                <th scope="col" rowSpan={2}>Día x<br />Enferm.</th>
                <th scope="col" rowSpan={2}>Lic.<br />Profiláctica</th>
                <th scope="col" rowSpan={2}>Días<br />Franco</th>
                <th scope="col" rowSpan={2}>Lic. x<br />Matern.</th>
                <th scope="col" rowSpan={2}>Días x<br />Estudio</th>
                <th scope="col" rowSpan={2}>Art. 8</th>
                <th scope="colgroup" colSpan={2}>Faltas</th>
                <th scope="colgroup" colSpan={3}>Desde</th>
                <th scope="colgroup" colSpan={3}>Hasta</th>
                <th scope="col" rowSpan={2}>Observ.<br />(DNI Fliar.)</th>
                <th scope="col" rowSpan={2}>Nº de<br />Orden</th>
              </tr>
              <tr>{['C/A', 'S/A', 'Día', 'Mes', 'Año', 'Día', 'Mes', 'Año'].map((label, columna) => <th key={columna} scope="col">{label}</th>)}</tr>
            </thead>
            <tbody>
              {!indice ? <tr className={styles.note}><td colSpan={18}><strong>OBSERVACIÓN:</strong> Año {anio}. Cantidades del período completo. Las observaciones extensas continúan en los renglones siguientes.</td></tr> : null}
              {Array.from({ length: indice ? FILAS_CONTINUACION : FILAS_PRIMERA_HOJA }, (_, fila) => {
                const renglon = pagina[fila]
                return <tr key={fila} data-registro-id={renglon?.registroId} data-continuacion={renglon?.continuacion || undefined}>
                  {(renglon?.celdas ?? Array<string>(18).fill('')).map((valor, columna) => <td key={columna} className={columna === 16 ? styles.observation : undefined}>{valor}</td>)}
                </tr>
              })}
            </tbody>
          </table>
          <p className={styles.footer}>Año {anio} · Página {indice + 1} de {paginas.length}</p>
        </article>
      ))}
    </div>
  )
}
