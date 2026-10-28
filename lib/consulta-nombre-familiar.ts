import 'server-only'

import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { cuitCorrespondeAlDni } from './cuit'
import { nombresCoinciden } from './nombres'
import type { ConsultaNombreFamiliar, FuenteFamiliar, IntentoFamiliar } from './consulta-familiar-types'

const FUENTES: FuenteFamiliar[] = ['cuitonline', 'nosis', 'dateas']
const TIMEOUT_MS = 240_000
const MAX_OUTPUT_LENGTH = 512_000
let consultaEnCurso = false

export class ConsultaNombreFamiliarError extends Error {}

function esObjeto(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function interpretarConsultaFamiliar(salida: string, dni: string): ConsultaNombreFamiliar {
  let informe: unknown
  try { informe = JSON.parse(salida) } catch {
    throw new ConsultaNombreFamiliarError('El validador no devolvió una respuesta válida.')
  }
  if (!esObjeto(informe) || informe.consulta !== dni || informe.tipo_consulta !== 'dni' ||
      !Array.isArray(informe.intentos) || informe.intentos.length !== FUENTES.length) {
    throw new ConsultaNombreFamiliarError('La respuesta del validador no corresponde al DNI consultado.')
  }

  const intentos = FUENTES.map((fuente): IntentoFamiliar => {
    const intento: unknown = (informe.intentos as unknown[]).find((item) => esObjeto(item) && item.fuente === fuente)
    if (!esObjeto(intento) || !Array.isArray(intento.resultados) ||
        !['con_datos', 'sin_resultados', 'bloqueado', 'error'].includes(String(intento.estado))) {
      throw new ConsultaNombreFamiliarError('El validador devolvió un estado de fuente inválido.')
    }
    const estado = intento.estado as IntentoFamiliar['estado']
    if (estado === 'bloqueado' || estado === 'error') {
      // Do not expose Python tracebacks, local paths or unrelated scraped fields.
      return { fuente, estado, resultados: [], detalle: estado === 'bloqueado'
        ? 'La fuente restringió el acceso o solicitó un CAPTCHA.'
        : 'No se pudo completar la consulta en esta fuente.' }
    }
    const resultados: IntentoFamiliar['resultados'] = []
    let descartados = 0
    for (const raw of intento.resultados) {
      const numero = esObjeto(raw) && typeof raw.numero === 'string' ? raw.numero.replace(/[-\s]/g, '') : ''
      if (!esObjeto(raw) || typeof raw.nombre !== 'string' || !raw.nombre.trim() ||
          !/^(20|23|24|27)/.test(numero) || !cuitCorrespondeAlDni(numero, dni)) {
        descartados += 1
        continue
      }
      const nombre = raw.nombre.trim().normalize('NFC')
      if (!resultados.some((r) => r.numero === numero && r.nombre === nombre)) resultados.push({ nombre, numero })
    }
    if ((estado === 'con_datos' && intento.resultados.length === 0) ||
        (estado === 'sin_resultados' && intento.resultados.length > 0)) {
      throw new ConsultaNombreFamiliarError('El validador devolvió resultados inconsistentes.')
    }
    return {
      fuente,
      estado: resultados.length ? 'con_datos' : descartados ? 'error' : 'sin_resultados',
      resultados,
      detalle: descartados ? 'Se descartaron resultados con un CUIT/CUIL inválido o ajeno al DNI consultado.' : null,
    }
  })
  const resultados = intentos.flatMap((intento) => intento.resultados)
  const requiereRevision = new Set(resultados.map((r) => r.numero)).size > 1 ||
    resultados.some((r, i) => resultados.slice(i + 1).some((otro) =>
      r.numero === otro.numero && !nombresCoinciden('', r.nombre, otro.nombre)))

  return { dni, comprobadoEn: new Date().toISOString(), requiereRevision, intentos }
}

function detenerProceso(proceso: ChildProcess) {
  if (proceso.exitCode !== null) return
  if (process.platform !== 'win32' || !proceso.pid) {
    proceso.kill('SIGKILL')
    return
  }
  const terminador = spawn('taskkill', ['/pid', String(proceso.pid), '/t', '/f'], {
    windowsHide: true, shell: false, stdio: 'ignore',
  })
  terminador.once('error', () => proceso.kill())
  terminador.unref()
}

function configuracionDelScraper() {
  const cwd = process.env.DNI_FAMILIARES_CWD ??
    join(/* turbopackIgnore: true */ process.cwd(), 'modules', 'validador-familiares')
  const python = process.env.DNI_VALIDATOR_PYTHON ?? 'python'
  return { cwd, python, scraper: 'scraper.py' }
}

function ejecutar(dni: string, signal?: AbortSignal): Promise<ConsultaNombreFamiliar> {
  const { cwd, python, scraper } = configuracionDelScraper()
  return new Promise((resolve, reject) => {
    const proceso = spawn(/* turbopackIgnore: true */ python, [
      scraper, dni, '--fuente', 'todas', '--formato', 'json', '--navegador', 'firefox', '--timeout', '15',
    ], {
      cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' },
    })
    proceso.stdout.setEncoding('utf8')
    proceso.stderr.setEncoding('utf8')
    let salida = ''
    let finalizado = false

    function terminar(callback: () => void) {
      if (finalizado) return
      finalizado = true
      clearTimeout(timeout)
      signal?.removeEventListener('abort', cancelar)
      callback()
    }
    function cancelar() {
      detenerProceso(proceso)
      terminar(() => reject(new ConsultaNombreFamiliarError('Consulta cancelada.')))
    }
    const timeout = setTimeout(() => {
      detenerProceso(proceso)
      terminar(() => reject(new ConsultaNombreFamiliarError('La consulta tardó demasiado. Intentá nuevamente.')))
    }, TIMEOUT_MS)
    signal?.addEventListener('abort', cancelar, { once: true })
    if (signal?.aborted) cancelar()

    proceso.stdout.on('data', (chunk: string) => {
      if (finalizado) return
      salida += chunk
      if (salida.length > MAX_OUTPUT_LENGTH) {
        detenerProceso(proceso)
        terminar(() => reject(new ConsultaNombreFamiliarError('La respuesta del validador excedió el tamaño permitido.')))
      }
    })
    // Drain progress output without logging personal data.
    proceso.stderr.on('data', () => {})
    proceso.once('error', () => terminar(() => reject(new ConsultaNombreFamiliarError(
      'No se pudo iniciar el validador. Verificá Python, Playwright y Firefox en el servidor.'
    ))))
    proceso.once('close', (code) => terminar(() => {
      // "todas" returns a report even with exit 1 when all sources fail.
      if ((code !== 0 && code !== 1) || !salida.trim()) {
        reject(new ConsultaNombreFamiliarError('No se pudo ejecutar el validador. Verificá su instalación en el servidor.'))
        return
      }
      try { resolve(interpretarConsultaFamiliar(salida, dni)) } catch (error) { reject(error) }
    }))
  })
}

export async function consultarNombreFamiliar(dniIngresado: string, signal?: AbortSignal) {
  if (!/^\d{7,8}$/.test(dniIngresado)) throw new ConsultaNombreFamiliarError('El DNI debe tener 7 u 8 dígitos.')
  if (signal?.aborted) throw new ConsultaNombreFamiliarError('Consulta cancelada.')
  if (consultaEnCurso) throw new ConsultaNombreFamiliarError('Hay una consulta de familiares en curso. Esperá a que termine e intentá nuevamente.')
  consultaEnCurso = true
  try {
    return await ejecutar(dniIngresado.padStart(8, '0'), signal)
  } finally {
    consultaEnCurso = false
  }
}
