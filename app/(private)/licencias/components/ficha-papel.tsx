'use client'

import Link from 'next/link'
import { useState } from 'react'
import { fechaVisible, type LicenciaPersona, type LicenciaRegistro } from '@/lib/licencias/domain'
import { ANCHOS_FICHA, FILAS_CONTINUACION, FILAS_PRIMERA_HOJA, paginarFicha } from '@/lib/licencias/ficha-papel'
import styles from './ficha-papel.module.css'

export function FichaPapel({ persona, registros, anio, puedeCargar = false, puedeAdministrar = false }: { persona: LicenciaPersona; registros: LicenciaRegistro[]; anio: number; puedeCargar?: boolean; puedeAdministrar?: boolean }) {
  const paginas = paginarFicha(registros, persona.dni, anio)
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const registro = registros.find((item) => item.id === seleccion && !item.anulado_at)
  const editar = puedeAdministrar && registro && !registro.imprevisto_id
  const parametros = new URLSearchParams({ anio: String(anio), ...(registro ? { referencia: String(registro.id) } : {}) })
  const agregar = `/licencias/fichas/${persona.dni}/agregar?${parametros}`
  const anchoTotal = ANCHOS_FICHA.reduce((total, ancho) => total + ancho, 0)
  return (
    <div role="region" aria-label="Ficha en formato papel" tabIndex={0} className={styles.root}>
      {puedeCargar || puedeAdministrar ? <div className={styles.tools} role="toolbar" aria-label="Editar filas de la planilla">
        <p aria-live="polite">{registro ? `Fila seleccionada: ${registro.tipo.codigo ?? ''} ${registro.tipo.nombre} · ${fechaVisible(registro.desde)}` : 'Seleccioná una fila de la planilla para editarla o insertar una licencia.'}</p>
        <div>
          {puedeCargar ? <><Link href={`${agregar}&lado=arriba`}>{registro ? 'Añadir fila arriba' : 'Añadir fila'}</Link>{registro ? <Link href={`${agregar}&lado=abajo`}>Añadir fila abajo</Link> : null}</> : null}
          {editar ? <><Link href={`/licencias/ultimas/${registro.id}/editar?ficha=${anio}&vista=ficha`}>Editar fila</Link><Link href={`/licencias/ultimas/${registro.id}/borrar?ficha=${anio}&vista=ficha`}>Borrar fila</Link></> : null}
          {registro?.imprevisto_id ? <span>Esta fila se modifica desde Imprevistos en Gestión.</span> : null}
        </div>
      </div> : null}
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
                const interactiva = (puedeCargar || puedeAdministrar) && !!renglon
                return <tr key={fila} data-registro-id={renglon?.registroId} data-continuacion={renglon?.continuacion || undefined}
                  tabIndex={interactiva ? 0 : undefined} aria-selected={interactiva ? seleccion === renglon.registroId : undefined}
                  onClick={interactiva ? () => setSeleccion(renglon.registroId) : undefined}
                  onKeyDown={interactiva ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSeleccion(renglon.registroId) } } : undefined}
                  className={interactiva ? seleccion === renglon.registroId ? styles.selected : styles.editable : undefined}>
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
