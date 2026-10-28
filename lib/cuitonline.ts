import 'server-only'

import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

const DEFAULT_PYTHON_COMMAND = 'python'
const DEFAULT_SCRAPER_CWD = join(/* turbopackIgnore: true */ process.cwd(), 'modules', 'validador-dni')
const DEFAULT_SCRAPER_SCRIPT = 'scraper.py'
const SCRAPER_TIMEOUT_MS = 50_000
const MAX_OUTPUT_LENGTH = 64_000
const MAX_CONCURRENT_SCRAPERS = 1
const MAX_QUEUED_SCRAPERS = 8

type TipoIdentificador = 'CUIT' | 'CUIL'

export type ConsultaCuitOnline = {
  dni: string
  nombre: string
  tipo: TipoIdentificador
  cuit: string
}

export class ConsultaCuitOnlineError extends Error {}

function normalizarDni(valor: string | number) {
  const dni = String(valor).replace(/\D/g, '')

  if (dni.length !== 7 && dni.length !== 8) {
    throw new ConsultaCuitOnlineError('El DNI debe tener 7 u 8 dígitos.')
  }

  return dni
}

function outputLimitado(actual: string, chunk: Buffer) {
  if (actual.length >= MAX_OUTPUT_LENGTH) {
    return actual
  }

  return (actual + chunk.toString('utf8')).slice(0, MAX_OUTPUT_LENGTH)
}

function mensajeDeError(salida: string) {
  const coincidencia = /^Consulta no realizada:\s*(.+)$/im.exec(salida)

  return coincidencia?.[1]?.trim() || 'El validador local no pudo completar la consulta.'
}

function identificadorDeSalida(salida: string): {
  tipo: TipoIdentificador
  cuit: string
} | null {
  const tipo = /^tipo:\s*(CUIT|CUIL)\s*$/im.exec(salida)?.[1]
  const cuit = /^numero:\s*(.+)$/im.exec(salida)?.[1]?.replace(/\D/g, '')

  if ((tipo !== 'CUIT' && tipo !== 'CUIL') || !cuit || !/^\d{11}$/.test(cuit)) {
    return null
  }

  return { tipo, cuit }
}

function configuracionDelScraper() {
  const python = process.env.DNI_VALIDATOR_PYTHON ?? DEFAULT_PYTHON_COMMAND
  const cwd = process.env.DNI_VALIDATOR_CWD ?? DEFAULT_SCRAPER_CWD
  const scraper = process.env.DNI_VALIDATOR_SCRIPT ?? DEFAULT_SCRAPER_SCRIPT

  return { cwd, python, scraper }
}

let scrapersActivos = 0
const colaDeScrapers: Array<() => void> = []

async function reservarScraper() {
  if (scrapersActivos < MAX_CONCURRENT_SCRAPERS) {
    scrapersActivos += 1
    return
  }

  if (colaDeScrapers.length >= MAX_QUEUED_SCRAPERS) {
    throw new ConsultaCuitOnlineError(
      'Hay demasiadas comprobaciones en curso. Intentá nuevamente en unos minutos.'
    )
  }

  await new Promise<void>((resolve) => {
    colaDeScrapers.push(resolve)
  })
  scrapersActivos += 1
}

function liberarScraper() {
  scrapersActivos = Math.max(0, scrapersActivos - 1)
  colaDeScrapers.shift()?.()
}

function detenerArbolDeProceso(proceso: ChildProcess) {
  if (proceso.exitCode !== null) {
    return
  }

  if (process.platform !== 'win32' || !proceso.pid) {
    proceso.kill()
    return
  }

  const terminador = spawn('taskkill', ['/pid', String(proceso.pid), '/t', '/f'], {
    windowsHide: true,
    stdio: 'ignore',
    shell: false,
  })

  terminador.once('error', () => {
    proceso.kill()
  })
  terminador.unref()
}

function ejecutarScraper(dni: string): Promise<ConsultaCuitOnline> {
  const { cwd, python, scraper } = configuracionDelScraper()

  return new Promise((resolve, reject) => {
    const proceso = spawn(/* turbopackIgnore: true */ python, [scraper, dni], {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })
    proceso.stdout.setEncoding('utf8')
    proceso.stderr.setEncoding('utf8')

    let salida = ''
    let errores = ''
    let finalizado = false

    function terminar(callback: () => void) {
      if (finalizado) {
        return
      }

      finalizado = true
      clearTimeout(timeout)
      callback()
    }

    const timeout = setTimeout(() => {
      detenerArbolDeProceso(proceso)
      terminar(() => {
        reject(
          new ConsultaCuitOnlineError(
            'El validador local tardó demasiado en responder. Intentá nuevamente.'
          )
        )
      })
    }, SCRAPER_TIMEOUT_MS)

    proceso.stdout.on('data', (chunk: Buffer) => {
      salida = outputLimitado(salida, chunk)
    })

    proceso.stderr.on('data', (chunk: Buffer) => {
      errores = outputLimitado(errores, chunk)
    })

    proceso.once('error', () => {
      terminar(() => {
        reject(
          new ConsultaCuitOnlineError(
            'No se pudo iniciar el validador local. Verificá Python y scraper.py.'
          )
        )
      })
    })

    proceso.once('close', (code) => {
      terminar(() => {
        if (code !== 0) {
          reject(new ConsultaCuitOnlineError(mensajeDeError(salida || errores)))
          return
        }

        const nombre = /^nombre:\s*(.+)$/im.exec(salida)?.[1]?.trim().normalize('NFC')

        if (!nombre) {
          reject(
            new ConsultaCuitOnlineError(
              'El validador local no devolvió un nombre para este DNI.'
            )
          )
          return
        }

        const identificador = identificadorDeSalida(salida)

        if (!identificador) {
          reject(
            new ConsultaCuitOnlineError(
              'El validador local no devolvió un CUIT/CUIL válido para este DNI.'
            )
          )
          return
        }

        resolve({ dni, nombre, ...identificador })
      })
    })
  })
}

export async function consultarNombrePorDni(
  dniBuscado: string | number
): Promise<ConsultaCuitOnline> {
  const dni = normalizarDni(dniBuscado)

  await reservarScraper()
  try {
    return await ejecutarScraper(dni)
  } finally {
    liberarScraper()
  }
}
