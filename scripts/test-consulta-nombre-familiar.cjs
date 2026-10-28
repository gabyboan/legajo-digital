/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const ts = require('typescript')

function load(file, overrides = {}) {
  const testModule = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('require', 'module', 'exports', code)((id) => {
    if (id in overrides) return overrides[id]
    if (id === 'server-only') return {}
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'), overrides)
    return require(id)
  }, testModule, testModule.exports)
  return testModule.exports
}

function numero(dni = '12345678', prefijo = '20') {
  const base = prefijo + dni.padStart(8, '0')
  const resto = 11 - [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((n, p, i) => n + p * Number(base[i]), 0) % 11
  return base + (resto === 11 ? 0 : resto === 10 ? 9 : resto)
}
function dato(nombre = 'PERSONA DE PRUEBA', dni = '12345678', prefijo = '20') {
  return { nombre, numero: numero(dni, prefijo), domicilio_declarado: { calle: 'NO EXPONER' } }
}
function informe(dni = '12345678') {
  return { consulta: dni, tipo_consulta: 'dni', intentos: ['cuitonline', 'nosis', 'dateas'].map((fuente) => ({
    fuente, estado: 'sin_resultados', resultados: [], detalle: null,
  })) }
}
const { interpretarConsultaFamiliar, ConsultaNombreFamiliarError } = load('lib/consulta-nombre-familiar.ts')
const parse = (raw, dni = raw.consulta) => interpretarConsultaFamiliar(JSON.stringify(raw), dni)
let raw = informe()
raw.intentos[0] = { fuente: 'cuitonline', estado: 'bloqueado', resultados: [], detalle: 'C:/private/path' }
raw.intentos[1].estado = 'con_datos'
raw.intentos[1].resultados = [dato()]
let result = parse(raw)
assert.equal(result.intentos[0].estado, 'bloqueado')
assert.equal(result.intentos[1].resultados[0].nombre, 'PERSONA DE PRUEBA')
assert.equal(JSON.stringify(result).includes('NO EXPONER'), false)
assert.equal(JSON.stringify(result).includes('private/path'), false)
assert.equal(result.requiereRevision, false)
raw.intentos[2].estado = 'con_datos'
raw.intentos[2].resultados = [dato('OTRA PERSONA', '12345678', '27')]
assert.equal(parse(raw).requiereRevision, true)
raw.intentos[2].resultados = [dato('NOMBRE DISTINTO')]
assert.equal(parse(raw).requiereRevision, true)
raw.intentos[2].resultados = [dato('persona de prueba')]
assert.equal(parse(raw).requiereRevision, false)
raw.intentos[1].resultados.push(dato('AJENA', '87654321'), dato('EMPRESA', '12345678', '30'), { nombre: 'INVALIDA', numero: '20123456789' })
result = parse(raw)
assert.equal(result.intentos[1].resultados.length, 1)
assert.match(result.intentos[1].detalle, /descartaron/)
raw.intentos[1].resultados = [dato('AJENA', '87654321')]
assert.equal(parse(raw).intentos[1].estado, 'error')
assert.equal(parse(informe()).intentos.every((i) => i.estado === 'sin_resultados'), true)
raw = informe('05956728')
raw.intentos[1].estado = 'con_datos'
raw.intentos[1].resultados = [dato('CERO INICIAL', '05956728')]
assert.equal(parse(raw).intentos[1].resultados[0].nombre, 'CERO INICIAL')
assert.throws(() => parse(raw, '12345678'), ConsultaNombreFamiliarError)
assert.throws(() => interpretarConsultaFamiliar('not JSON', '12345678'), ConsultaNombreFamiliarError)
raw = informe()
raw.intentos.pop()
assert.throws(() => parse(raw), ConsultaNombreFamiliarError)
raw = informe()
raw.intentos[1].estado = 'con_datos'
assert.throws(() => parse(raw), ConsultaNombreFamiliarError)

async function procesos() {
  const spawns = []
  let actual
  const mocked = load('lib/consulta-nombre-familiar.ts', {
    'node:child_process': {
      spawn(command, args, options) {
        spawns.push({ command, args, options })
        const child = new EventEmitter()
        child.stdout = new PassThrough()
        child.stderr = new PassThrough()
        child.exitCode = null
        child.kill = () => { child.killed = true; return true }
        actual = child
        return child
      },
    },
  })
  const pending = mocked.consultarNombreFamiliar('5956728')
  assert.deepEqual(spawns[0].args, ['scraper.py', '05956728', '--fuente', 'todas', '--formato', 'json', '--navegador', 'firefox', '--timeout', '15'])
  assert.equal(spawns[0].options.shell, false)
  assert.equal(spawns[0].options.windowsHide, true)
  await assert.rejects(mocked.consultarNombreFamiliar('12345678'), /en curso/)
  actual.stdout.write(JSON.stringify(informe('05956728')))
  actual.exitCode = 0
  actual.emit('close', 0)
  assert.equal((await pending).dni, '05956728')
  const allFailed = mocked.consultarNombreFamiliar('12345678')
  const blocked = informe()
  blocked.intentos.forEach((i) => { i.estado = 'bloqueado' })
  actual.stdout.write(JSON.stringify(blocked))
  actual.exitCode = 1
  actual.emit('close', 1)
  assert.equal((await allFailed).intentos.every((i) => i.estado === 'bloqueado'), true)
  const abort = new AbortController()
  const canceled = mocked.consultarNombreFamiliar('12345678', abort.signal)
  abort.abort()
  await assert.rejects(canceled, /cancelada/)
  assert.equal(actual.killed, true)
  const invalid = mocked.consultarNombreFamiliar('12345678')
  actual.emit('error', new Error('ENOENT'))
  await assert.rejects(invalid, /No se pudo iniciar/)
  await assert.rejects(mocked.consultarNombreFamiliar('123'), /7 u 8/)
}
procesos().then(() => console.log('Scraper de familiares: múltiples candidatos, fallos parciales, identidad, JSON, concurrencia y cancelación: OK'))
  .catch((error) => { console.error(error); process.exitCode = 1 })
