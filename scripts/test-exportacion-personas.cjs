/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression runner. */
// Sólo usa personas sintéticas y un cliente de datos simulado.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const XLSX = require('xlsx')

function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const testModule = { exports: {} }
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in dependencies) return dependencies[id]
    assert.equal(id, 'xlsx', `Unexpected dependency ${id}`)
    return XLSX
  }, testModule, testModule.exports)
  return testModule.exports
}

const personas = [
  { dni: 12345678, apellido: 'Ejemplo', nombre: 'Ángela', persona_carreras: [
    { carrera_id: 1, carreras: { nombre: 'Enfermería' } },
  ] },
  { dni: 23456789, apellido: 'Prueba', nombre: 'Benito', persona_carreras:
    { carrera_id: 2, carreras: [{ nombre: 'Administración' }] },
  },
  { dni: 34567890, apellido: 'Sintética', nombre: '=EJEMPLO()', persona_carreras: null },
]

function setup({ authenticated = true, failed = false, inactiveFailed = false, rows = personas, inactiveRows = [{ dni: 23456789 }] } = {}) {
  const calls = []
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'synthetic-user' } : null } }) },
    from(table) {
      calls.push(table)
      let dni
      let start = 0, end = 499
      const query = {
        select() { return query }, order() { return query }, limit() { return query },
        range(first, last) { start = first; end = last; assert.equal(last - first, 499); return query },
        eq(column, value) { assert.equal(column, 'dni'); dni = value; return query },
        then(resolve, reject) {
          const result = table === 'personas'
            ? { data: failed ? null : rows.filter((row) => dni === undefined || row.dni === dni).slice(start, end + 1), error: failed ? { message: 'INTERNAL_DETAIL' } : null }
            : { data: inactiveFailed ? null : inactiveRows.slice(start, end + 1), error: inactiveFailed ? { message: 'INTERNAL_DETAIL' } : null }
          return Promise.resolve(result).then(resolve, reject)
        },
      }
      return query
    },
  }
  const route = load('app/api/personas/exportar/route.ts', {
    '@/utils/supabase/server': { createClient: async () => client },
    '@/lib/personas/listado': load('lib/personas/listado.ts', { '@/lib/buscar-personas': load('lib/buscar-personas.ts') }),
    '@/lib/personas/listado-server': load('lib/personas/listado-server.ts', { 'server-only': {} }),
  })
  return { calls, get: (query = '') => route.GET(new Request(`http://localhost/api/personas/exportar${query}`)) }
}

async function read(response) {
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Content-Type'), /spreadsheetml/)
  assert.match(response.headers.get('Content-Disposition'), /personas\.xlsx/)
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(bytes.subarray(0, 2).toString(), 'PK', 'La descarga debe ser un archivo XLSX ZIP válido')
  const workbook = XLSX.read(bytes, { type: 'buffer' })
  assert.deepEqual(workbook.SheetNames, ['Personas'])
  return workbook.Sheets.Personas
}

async function main() {
  const blocked = setup({ authenticated: false })
  assert.equal((await blocked.get()).status, 401)
  assert.deepEqual(blocked.calls, [])
  const failure = await setup({ failed: true }).get()
  assert.equal(failure.status, 500)
  assert.equal((await failure.text()).includes('INTERNAL_DETAIL'), false)
  const inactiveFailure = await setup({ inactiveFailed: true }).get()
  assert.equal(inactiveFailure.status, 500, 'No presentar como activos a los agentes cuando falla la consulta de inactivos')

  const sheet = await read(await setup().get())
  assert.deepEqual(XLSX.utils.sheet_to_json(sheet), [
    { DNI: 12345678, Apellido: 'Ejemplo', Nombre: 'Ángela', Carrera: 'Enfermería', Estado: 'Activo' },
    { DNI: 23456789, Apellido: 'Prueba', Nombre: 'Benito', Carrera: 'Administración', Estado: 'Inactivo' },
    { DNI: 34567890, Apellido: 'Sintética', Nombre: '=EJEMPLO()', Carrera: 'Sin carrera', Estado: 'Activo' },
  ])
  assert.equal(sheet.C4.t, 's', 'Un nombre que empieza por = debe seguir siendo texto')
  assert.equal(sheet.C4.f, undefined, 'Los nombres no deben convertirse en fórmulas')

  for (const query of ['?q=12345678', '?q=ANGELA']) {
    const result = XLSX.utils.sheet_to_json(await read(await setup().get(query)))
    assert.deepEqual(result.map((row) => row.DNI), [12345678])
  }
  const inactive = XLSX.utils.sheet_to_json(await read(await setup().get('?estado=inactivos&carrera=2')))
  assert.deepEqual(inactive.map((row) => row.DNI), [23456789])
  const empty = await read(await setup({ rows: [] }).get())
  assert.deepEqual(XLSX.utils.sheet_to_json(empty), [])
  const extra = { dni: 45678901, apellido: 'Última', nombre: 'Persona', legajo: 42,
    persona_carreras: [{ carrera_id: 1, carreras: { nombre: 'Enfermería' } }, { carrera_id: 2, carreras: { nombre: 'Administración' } }] }
  const many = [...Array.from({length: 1200}, (_, index) => ({ ...personas[0], dni: 10000000 + index })), extra]
  for (const query of ['?q=ultima+persona+42', '?q=45.678.901', '?q=42&carrera=2']) {
    const exported = XLSX.utils.sheet_to_json(await read(await setup({ rows: many }).get(query)))
    assert.deepEqual(exported.map((row) => row.DNI), [45678901])
    assert.equal(exported[0].Legajo, 42)
    assert.equal(exported[0].Carrera, 'Enfermería, Administración')
  }
  const complete = setup({ rows: many })
  assert.equal(XLSX.utils.sheet_to_json(await read(await complete.get())).length, 1201)
  assert.equal(complete.calls.filter((table) => table === 'personas').length, 3)
  assert.equal(complete.calls.filter((table) => table === 'persona_inactivo').length, 1, 'No volver a consultar una lista ya agotada')
  const longInactive = setup({ inactiveRows: [
    ...Array.from({length: 1000}, (_, index) => ({ dni: 10000000 + index })), { dni: 23456789 },
  ] })
  assert.deepEqual(XLSX.utils.sheet_to_json(await read(await longInactive.get('?estado=inactivos'))).map((row) => row.DNI), [23456789])
  assert.equal(longInactive.calls.filter((table) => table === 'personas').length, 1, 'El listado corto de personas no se repite')
  assert.equal(longInactive.calls.filter((table) => table === 'persona_inactivo').length, 3, 'Recorrer todos los inactivos aunque haya menos personas')
  console.log('Exportación XLSX: autenticación, columnas, acentos, filtros, texto sin fórmulas y listado vacío: OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
