/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const testModule = { exports: {} }
  new Function('module', 'exports', output)(testModule, testModule.exports)
  return testModule.exports
}
const { capitalizarNombre } = load('lib/nombres.ts')
assert.equal(capitalizarNombre('GIMENEZ VALENTINA'), 'Gimenez Valentina')
assert.equal(capitalizarNombre('GIMÉNEZ MARÍA JOSÉ'), 'Giménez María José')
assert.equal(capitalizarNombre('MUÑOZ'), 'Muñoz')
assert.equal(capitalizarNombre('ANA-MARÍA'), 'Ana-María')
assert.equal(capitalizarNombre('VALENTINA '), 'Valentina ')
const { cuitCorrespondeAlDni } = load('lib/cuit.ts')
assert.equal(cuitCorrespondeAlDni('20123456786', '12345678'), true)
assert.equal(cuitCorrespondeAlDni('20123456780', '12345678'), false)
assert.equal(cuitCorrespondeAlDni('20123456786', '12345679'), false)
assert.equal(cuitCorrespondeAlDni('', '12345678'), false)
console.log('Pruebas de nombres, correspondencia DNI y dígito verificador: OK')

const { nombresCoinciden } = load('lib/nombres.ts')
assert.equal(nombresCoinciden('Ficticio', 'Ejemplares Agente', 'FICTICIO, EJEMPLARES AGENTE'), true)
assert.equal(nombresCoinciden('Ficticio', 'Ejemplares', 'FICTICIO EJEMPLARES AGENTE'), false)
assert.equal(nombresCoinciden('Giménez', 'María', 'GIMENEZ MARIA'), true)
assert.equal(nombresCoinciden('Peña', 'Ana', 'PENA ANA'), false)
assert.equal(nombresCoinciden('Ficticio', 'Ejemplares Agente', 'EJEMPLARES AGENTE FICTICIO'), false)
console.log('Comparación de nombres de familiares: OK')

const { formatearDni, dniDesdeRegistro } = load('lib/dni.ts')
assert.equal(formatearDni('0'), '0')
assert.equal(formatearDni('05'), '05')
assert.equal(formatearDni('01234567'), '01.234.567')
assert.equal(formatearDni('01.234.567'), '01.234.567')
assert.equal(formatearDni(''), '')
assert.equal(dniDesdeRegistro(null), '')
assert.equal(dniDesdeRegistro(1234567), '01234567')
assert.equal(dniDesdeRegistro(23456789), '23456789')
let escrito = ''
for (const digit of '01234567') escrito = formatearDni(escrito + digit)
const enviado = escrito.replace(/\D/g, '')
assert.equal(enviado, '01234567')
assert.equal(dniDesdeRegistro(Number(enviado)), enviado)
console.log('DNI con cero inicial: escritura, pegado y recuperación tras guardar: OK')
