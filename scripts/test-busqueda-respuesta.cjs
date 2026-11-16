/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic network boundary regression. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file) {
  const testModule = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('require', 'module', 'exports', source)((id) => load(path.join(path.dirname(file), id + '.ts')), testModule, testModule.exports)
  return testModule.exports
}
const { personasDeRespuesta, enlaceSesionBusqueda } = load('lib/licencias/busqueda.ts')
const row = { dni: 12345678, apellido_nombre: 'PERSONA FICTICIA', legajo: null, carrera: '', situacion_revista: '', funcion: '', activo: false }
assert.deepEqual(personasDeRespuesta({ personas: [row] }), [row])
assert.deepEqual(personasDeRespuesta({ personas: [] }), [])
for (const payload of [null, [], {}, { personas: null }, { personas: [null] }, { personas: [{ ...row, dni: '12345678' }] },
  { personas: [{ ...row, apellido_nombre: {} }] }, { personas: [{ ...row, activo: 'false' }] }, { personas: [row, row] }]) {
  assert.equal(personasDeRespuesta(payload), null)
}
assert.equal(personasDeRespuesta({ personas: Array.from({ length: 101 }, (_, i) => ({ ...row, dni: i+1 })) }), null)
assert.deepEqual(personasDeRespuesta({ personas: [{ ...row, telefono: 'PRIVATE_DETAIL', domicilio: 'PRIVATE_DETAIL' }] }), [row])
for (const href of ['https://example.invalid', '//example.invalid', 'javascript:alert(1)', '/personas', null]) assert.equal(enlaceSesionBusqueda(href), undefined)
for (const href of ['/login?next=%2Flicencias', '/auth/mfa?next=%2Flicencias', '/auth/expired?next=%2Flicencias']) assert.equal(enlaceSesionBusqueda(href), href)
console.log('Búsqueda: contrato JSON, identidades únicas, datos mínimos y enlaces de sesión locales: OK')
