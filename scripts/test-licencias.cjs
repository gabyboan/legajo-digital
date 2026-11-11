/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression runner. */
// Only synthetic users, records and RPC responses. Never writes to a real database.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, overrides = {}, cache = new Map()) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const testModule = { exports: {} }
  cache.set(file, testModule.exports)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', source)((id) => {
    if (id in overrides) return overrides[id]
    if (id === 'server-only') return {}
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts', overrides, cache)
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'), overrides, cache)
    return require(id)
  }, testModule, testModule.exports)
  return testModule.exports
}

class Redirect extends Error { constructor(url) { super(url); this.url = url } }
function setup(options = {}) {
  const calls = []
  const client = {
    auth: { async getUser() { calls.push('user'); return { data: { user: options.anonymous ? null : { id: 'synthetic-user', factors: [] } } } } },
    async rpc(name, args) {
      calls.push({ name, args })
      if (name === 'verificar_mfa_opcional') return { data: null, error: options.sessionError ?? null }
      if (name.startsWith('can_')) return { data: options.denied !== name, error: options.permissionError ? { code: 'NETWORK' } : null }
      if (name === 'rpc_licencias_estudio_hasta') return { data: options.invalidDate ? null : '2026-11-17', error: null }
      if (name === 'rpc_licencias_guardar_con_datos') return { data: 101, error: options.saveError ?? null }
      if (name === 'rpc_licencias_ultimas') return { data: options.recordMissing ? [] : [{ id: 101, dni: 12345678, tipo_id: 129, version: 'a'.repeat(32), anulado_at: options.deleted ? '2026-11-11T12:00:00Z' : null }], error: options.recentError ?? null }
      if (name === 'rpc_licencias_editar_versionada' || name === 'rpc_licencias_borrar_versionada') return { data: options.unconfirmed ? null : 101, error: options.correctError ?? null }
      if (name === 'rpc_licencias_historial') return options.historyError && args.p_offset ? { error: { code: 'NETWORK' } } : { data: args.p_offset ? [{ id: 501 }] : Array.from({ length: 500 }, (_, id) => ({ id: id + 1 })), error: null }
      if (name === 'rpc_ficha_personas' || name === 'rpc_licencias_personas') {
        if (options.searchThrow) throw new Error('INTERNAL_NETWORK_DETAIL')
        return { data: [{ dni: 12345678, apellido_nombre: 'PERSONA FICTICIA', legajo: 1, carrera: 'Carrera ficticia', situacion_revista: '', funcion: '', activo: true, domicilio: 'Domicilio que no necesita el buscador', telefono: 'Dato privado', fecha_nacimiento: '1990-01-01' }], error: options.searchError ? { code: 'XX000', message: 'INTERNAL_SQL_DETAIL' } : null }
      }
      throw new Error(`Unexpected RPC: ${name}`)
    },
    from(table) {
      assert.equal(table, 'licencias_tipos_excel')
      return { select() { return this }, eq() { return this }, async maybeSingle() { return { data: options.noType ? null : { id: 129, codigo: options.codigo ?? '01', habilitado_para_carga: !options.disabledType }, error: null } } }
    },
  }
  const overrides = {
    'next/navigation': { redirect(url) { throw new Redirect(url) }, unstable_rethrow(error) { if (error instanceof Redirect) throw error } },
    'next/cache': { revalidatePath: (...args) => calls.push({ revalidate: args }) },
    '@/utils/supabase/server': { createClient: async () => client },
    '@/lib/auth/mfa-server': { estadoMfa: async () => options.mfaError ? 'error' : options.mfa ? 'required' : 'none' },
  }
  return { client, calls, actions: load('app/(private)/licencias/cargar/actions.ts', overrides), corrections: load('app/(private)/licencias/ultimas/actions.ts', overrides), server: load('lib/licencias/server.ts', overrides), search: load('app/api/licencias/personas/route.ts', overrides).GET }
}

function form(changes = {}) {
  const data = new FormData()
  for (const [name, value] of Object.entries({ dni: '12345678', tipo_id: '129', desde: '2026-11-10', dias: '3', ...changes })) data.set(name, value)
  return data
}

async function main() {
  const domain = load('lib/licencias/domain.ts')
  testFormatoFicha()
  await testCorrecciones()
  assert.match(domain.fechaHoraCarga('2026-11-11T12:04:05Z'), /09:04:05/)
  assert.equal(domain.fechaHoraCarga('inválida'), 'Sin fecha registrada')
  const expired = setup({ saveError: { code: 'PT401' } })
  await assert.rejects(expired.actions.guardarLicencia({ status: 'idle' }, form()),
    (error) => error instanceof Redirect && error.url === '/auth/expired?next=%2Flicencias%2Fcargar')
  assert.equal(expired.calls.filter((call) => call.name === 'rpc_licencias_guardar_con_datos').length, 1)
  await testBusquedaAgentes()
  assert.equal(domain.fechaValida('2026-02-30'), false)
  assert.equal(domain.fechaValida('2028-02-29'), true)
  assert.equal(domain.hastaLicencia('2026-12-30', 4), '2027-01-02')
  assert.equal(domain.hastaLicencia('2026-11-10', 1), '2026-11-10')
  assert.equal(domain.hastaLicencia('2026-11-10', 0), null)
  assert.equal(domain.diasEnAnio({ desde: '2026-12-30', hasta: '2027-01-03' }, 2026), 2)
  assert.equal(domain.diasEnAnio({ desde: '2026-12-30', hasta: '2027-01-03', dias_por_anio: { 2026: 1, 2027: 1 } }, 2027), 1)
  assert.equal(domain.diasEnAnio({ desde: '2026-11-10', hasta: '2026-11-12', anulado_at: '2026-11-11' }, 2026), 0)
  const idle = { status: 'idle' }
  const anonymous = setup({ anonymous: true })
  const expiredSession = setup({ sessionError: { code: 'PT401' } })
  const expiredResponse = await expiredSession.search(new Request('https://legajo.invalid/api/licencias/personas?contexto=cargar'))
  assert.equal(expiredResponse.status, 401)
  assert.match((await expiredResponse.json()).href, /^\/auth\/expired\?next=/)
  assert.equal(expiredSession.calls.some((call) => call.name === 'rpc_licencias_personas'), false)
  await assert.rejects(anonymous.actions.guardarLicencia(idle, form()), (error) => error instanceof Redirect && error.url.startsWith('/login?next='))
  assert.deepEqual(anonymous.calls, ['user'])
  const mfa = setup({ mfa: true })
  await assert.rejects(mfa.actions.guardarLicencia(idle, form()), (error) => error instanceof Redirect && error.url === '/auth/mfa?next=%2Flicencias%2Fcargar')
  assert.deepEqual(mfa.calls, ['user'])
  for (const options of [{ denied: 'can_licencias_create' }, { denied: 'can_licencias_read' }, { permissionError: true }]) {
    const test = setup(options)
    assert.equal((await test.actions.guardarLicencia(idle, form())).status, 'error')
    assert.ok(!test.calls.some((call) => call.name?.startsWith('rpc_')))
  }
  const repeated = form()
  repeated.append('dni', '87654321')
  for (const invalid of [repeated, form({ dni: '123x' }), form({ desde: '2026-02-30' }), form({ desde: '2025-12-31' }), form({ dias: '1.5' }), form({ dias: '0' }), form({ dni_familiar: '-1' }), form({ numero_orden: '2147483648' }), form({ observacion: 'x'.repeat(2001) }), form({ cantidad_ficha: 'x'.repeat(13) }), form({ dni: new File(['12345678'], 'dni.txt') })]) {
    const test = setup()
    assert.equal((await test.actions.guardarLicencia(idle, invalid)).status, 'error')
    assert.ok(!test.calls.some((call) => call.name === 'rpc_licencias_guardar_con_datos'))
  }
  for (const options of [{ noType: true }, { codigo: '43' }, { codigo: '98' }]) {
    const test = setup(options)
    assert.equal((await test.actions.guardarLicencia(idle, form())).status, 'error')
    assert.ok(!test.calls.some((call) => call.name === 'rpc_licencias_guardar_con_datos'))
  }
  const ordinary = setup()
  assert.equal((await ordinary.actions.guardarLicencia(idle, form({ dni_familiar: '87654321', numero_orden: '12', cantidad_ficha: '20/23', observacion: ' Prueba ficticia ' }))).status, 'success')
  assert.deepEqual(ordinary.calls.find((call) => call.name === 'rpc_licencias_guardar_con_datos').args, {
    p_id: null, p_dni: 12345678, p_tipo_id: 129, p_desde: '2026-11-10', p_hasta: '2026-11-12', p_observacion: 'Prueba ficticia', p_dni_familiar: 87654321, p_numero_orden: 12, p_cantidad_ficha: '20/23',
  })
  const study = setup({ codigo: '29' })
  assert.equal((await study.actions.guardarLicencia(idle, form({ dias: '5' }))).status, 'success')
  assert.equal(study.calls.find((call) => call.name === 'rpc_licencias_guardar_con_datos').args.p_hasta, '2026-11-17')
  const overLimit = setup({ codigo: '29' })
  assert.equal((await overLimit.actions.guardarLicencia(idle, form({ dias: '6' }))).status, 'error')
  assert.ok(!overLimit.calls.some((call) => call.name === 'rpc_licencias_guardar_con_datos'))
  const invalidCalculation = setup({ codigo: '29', invalidDate: true })
  assert.equal((await invalidCalculation.actions.guardarLicencia(idle, form())).status, 'error')
  assert.ok(!invalidCalculation.calls.some((call) => call.name === 'rpc_licencias_guardar_con_datos'))
  const failed = setup({ saveError: { code: 'XX000', message: 'INTERNAL_SQL_DETAIL' } })
  const error = await failed.actions.guardarLicencia(idle, form())
  assert.equal(error.status, 'error')
  assert.equal(error.message.includes('INTERNAL_SQL_DETAIL'), false)
  assert.ok(!failed.calls.some((call) => call.revalidate))
  const readOnly = setup({ denied: 'can_licencias_create' })
  assert.equal((await readOnly.server.permisosLicencias(readOnly.client)).ficha, true)
  assert.equal((await readOnly.server.personasLicencias(readOnly.client, '12345678', true)).personas[0].dni, 12345678)
  const pages = setup()
  assert.equal((await pages.server.historialLicencias(pages.client, 2026, 12345678)).registros.length, 501)
  assert.deepEqual(pages.calls.filter((call) => call.name === 'rpc_licencias_historial').map((call) => call.args.p_offset), [0, 500])
  const partial = setup({ historyError: true })
  assert.equal((await partial.server.historialLicencias(partial.client, 2026, 12345678)).registros.length, 0)
  console.log('Licencias: sesión, MFA, permisos, datos inválidos, catálogo, días hábiles, guardado, últimas cargas, edición y borrado versionados, fichas, formato papel y paginación: OK')
}

async function testCorrecciones() {
  const idle = { status: 'idle' }
  const correctedForm = (changes = {}) => form({ id: '101', version: 'a'.repeat(32), motivo: 'Carga equivocada', confirmar: 'si', ...changes })
  for (const action of ['editarLicencia', 'borrarLicencia']) {
    for (const options of [{ anonymous: true }, { mfa: true }, { sessionError: { code: 'PT401' } }]) {
      const test = setup(options)
      await assert.rejects(test.corrections[action](idle, correctedForm()), (error) => error instanceof Redirect)
      assert.equal(test.calls.some((call) => call.name?.startsWith('rpc_licencias_')), false)
    }
    for (const options of [{ denied: 'can_licencias_read' }, { denied: 'can_licencias_admin' }, { permissionError: true }, { deleted: true }, { recordMissing: true }, { recentError: { code: 'XX000' } }]) {
      const test = setup(options)
      assert.equal((await test.corrections[action](idle, correctedForm())).status, 'error')
      assert.equal(test.calls.some((call) => /rpc_licencias_(editar|borrar)_versionada/.test(call.name ?? '')), false)
    }
    const duplicate = correctedForm()
    duplicate.append('version', 'b'.repeat(32))
    for (const invalid of [duplicate, correctedForm({ id: '1e2' }), correctedForm({ id: '9007199254740993' }), correctedForm({ version: 'bad' }), correctedForm({ version: 'b'.repeat(32) })]) {
      const test = setup()
      assert.equal((await test.corrections[action](idle, invalid)).status, 'error')
      assert.equal(test.calls.some((call) => /rpc_licencias_(editar|borrar)_versionada/.test(call.name ?? '')), false)
    }
    for (const options of [{ correctError: { code: '40001' } }, { correctError: { code: 'XX000', message: 'INTERNAL_SQL_DETAIL' } }, { unconfirmed: true }]) {
      const test = setup(options)
      const result = await test.corrections[action](idle, correctedForm())
      assert.equal(result.status, 'error')
      assert.equal(result.message.includes('INTERNAL_SQL_DETAIL'), false)
      assert.equal(test.calls.some((call) => call.revalidate), false)
    }
  }
  const edit = setup({ denied: 'can_licencias_create' })
  assert.equal((await edit.corrections.editarLicencia(idle, correctedForm({ observacion: ' Corregida ' }))).status, 'success', 'Administrar no exige permiso de alta')
  assert.deepEqual(edit.calls.find((call) => call.name === 'rpc_licencias_editar_versionada').args, {
    p_id: 101, p_version: 'a'.repeat(32), p_datos: { p_dni: 12345678, p_tipo_id: 129, p_desde: '2026-11-10', p_hasta: '2026-11-12', p_observacion: 'Corregida', p_dni_familiar: null, p_numero_orden: null, p_cantidad_ficha: null },
  })
  const wrongAgent = setup()
  assert.equal((await wrongAgent.corrections.editarLicencia(idle, correctedForm({ dni: '87654321' }))).status, 'error')
  assert.equal(wrongAgent.calls.some((call) => call.name === 'rpc_licencias_editar_versionada'), false)
  for (const changes of [{ motivo: 'a' }, { motivo: 'a'.repeat(501) }, { confirmar: '' }]) {
    const test = setup()
    assert.equal((await test.corrections.borrarLicencia(idle, correctedForm(changes))).status, 'error')
    assert.equal(test.calls.some((call) => call.name === 'rpc_licencias_borrar_versionada'), false)
  }
  const remove = setup()
  assert.equal((await remove.corrections.borrarLicencia(idle, correctedForm())).status, 'success')
  assert.deepEqual(remove.calls.find((call) => call.name === 'rpc_licencias_borrar_versionada').args, { p_id: 101, p_version: 'a'.repeat(32), p_motivo: 'Carga equivocada' })
  assert.ok(remove.calls.some((call) => call.revalidate))
  const history = setup()
  await history.server.ultimasLicencias(history.client, { q: 'Ana', estado: 'borradas', offset: 25 })
  assert.deepEqual(history.calls.find((call) => call.name === 'rpc_licencias_ultimas').args, { p_buscar: 'Ana', p_estado: 'borradas', p_offset: 25, p_limite: 26, p_id: null })
}

async function testBusquedaAgentes() {
  const request = (query = 'q=Ana&contexto=cargar') => new Request(`https://legajo.invalid/api/licencias/personas?${query}`)
  const anonymous = setup({ anonymous: true })
  const deniedSession = await anonymous.search(request())
  assert.equal(deniedSession.status, 401)
  assert.deepEqual(anonymous.calls, ['user'])
  assert.match((await deniedSession.json()).href, /^\/login\?next=/)
  for (const [options, query, status] of [
    [{ mfa: true }, undefined, 403],
    [{ mfaError: true }, undefined, 503],
    [{ denied: 'can_licencias_read' }, undefined, 403],
    [{ denied: 'can_licencias_create' }, undefined, 403],
    [{ denied: 'can_ficha_read' }, 'contexto=fichas&q=Ana', 403],
    [{ permissionError: true }, undefined, 503],
  ]) {
    const test = setup(options)
    const response = await test.search(request(query))
    assert.equal(response.status, status)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(test.calls.some((call) => call.name?.startsWith('rpc_')), false, 'Autorizar antes de consultar agentes')
    assert.equal('personas' in await response.json(), false)
  }
  for (const query of ['q=Ana&q=Otra&contexto=cargar', 'q=Ana&contexto=cargar&contexto=fichas', 'contexto=personas', `contexto=cargar&q=${'x'.repeat(151)}`]) {
    const test = setup()
    assert.equal((await test.search(request(query))).status, 400)
    assert.deepEqual(test.calls, [])
  }
  const success = setup()
  const response = await success.search(request('contexto=cargar&q=%20Garc%C3%ADa%20'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json()
  assert.equal(body.personas[0].dni, 12345678)
  assert.deepEqual(Object.keys(body.personas[0]).sort(), ['activo', 'apellido_nombre', 'carrera', 'dni', 'funcion', 'legajo', 'situacion_revista'])
  assert.deepEqual(success.calls.find((call) => call.name === 'rpc_licencias_personas').args, { p_buscar: 'García' })
  const readOnly = setup({ denied: 'can_licencias_create' })
  assert.equal((await readOnly.search(request('contexto=fichas&q=12345678'))).status, 200)
  assert.ok(readOnly.calls.some((call) => call.name === 'rpc_ficha_personas'))
  assert.equal(readOnly.calls.some((call) => call.name === 'rpc_licencias_personas'), false)
  for (const options of [{ searchError: true }, { searchThrow: true }]) {
    const failed = await setup(options).search(request())
    assert.equal(failed.status, 503)
    const result = await failed.json()
    assert.equal('personas' in result, false)
    assert.equal(JSON.stringify(result).includes('INTERNAL'), false)
  }
}

function testFormatoFicha() {
  const { paginarFicha } = load('lib/licencias/ficha-papel.ts')
  const registro = (id, changes = {}) => ({ id, dni: 12345678, tipo: { nombre: 'Licencia de prueba', codigo: '01', columna_ficha: 'ANUAL' }, desde: '2026-11-10', hasta: '2026-11-12', dias: 3, ...changes })
  for (const [cantidad, tamanios] of [[0, [0]], [19, [19]], [20, [19, 1]], [40, [19, 21]], [41, [19, 21, 1]], [85, [19, 21, 21, 21, 3]]]) {
    const registros = Array.from({ length: cantidad }, (_, i) => registro(cantidad - i))
    const paginas = paginarFicha(registros, 12345678, 2026)
    assert.deepEqual(paginas.map((pagina) => pagina.length), tamanios)
    assert.deepEqual(paginas.flat().map((fila) => fila.registroId), Array.from({ length: cantidad }, (_, i) => i + 1))
    assert.equal(registros[0]?.id, cantidad || undefined, 'La presentación no debe reordenar el historial recibido')
  }
  const columnas = ['ANUAL', 'ENFERMEDAD', 'PROFILACTICA', 'FRANCO', 'MATERNIDAD', 'ESTUDIO', 'ART8', 'FALTA_CA', 'FALTA_SA']
  columnas.forEach((columna, i) => {
    const [fila] = paginarFicha([registro(1, { tipo: { nombre: 'Prueba', codigo: '03', columna_ficha: columna }, cantidad_ficha: '20/23', numero_orden: 123 })], 12345678, 2026).flat()
    assert.equal(fila.celdas[0], '03')
    assert.equal(fila.celdas[i + 1], '20/23')
    assert.equal(fila.celdas[17], '123')
    assert.deepEqual(fila.celdas.slice(10, 16), ['10', '11', '2026', '12', '11', '2026'])
    assert.equal(fila.celdas.filter((value) => value === '20/23').length, 1)
  })
  const [unDia, estudio] = paginarFicha([
    registro(1, { hasta: '2026-11-10', cantidad_dias_ficha: 2 }),
    registro(2, { desde: '2026-11-14', hasta: '2026-11-16', dias: 1, tipo: { codigo: '29', nombre: 'Estudio', columna_ficha: 'ESTUDIO' } }),
  ], 12345678, 2026).flat()
  assert.deepEqual(unDia.celdas.slice(13, 16), ['/', '/', '/'])
  assert.equal(unDia.celdas[1], '2', 'Conservar la cantidad de ficha aunque difiera de la duración calendario')
  assert.deepEqual(estudio.celdas.slice(13, 16), ['16', '11', '2026'])
  const observacion = 'Observación áéíóú 😀 '.repeat(100).trim()
  const paginas = paginarFicha([registro(1, { observacion, dni_familiar: 87654321 })], 12345678, 2026)
  const filas = paginas.flat()
  assert.ok(paginas.length > 1)
  assert.equal(filas.map((fila) => fila.celdas[16].replaceAll('\n', '')).join(''), `DNI: 87654321 / ${observacion}`)
  assert.equal(filas[0].continuacion, false)
  assert.ok(filas.slice(1).every((fila) => fila.continuacion && fila.celdas[1] === '' && fila.celdas[10] === ''))
  const desconocido = paginarFicha([registro(1, { tipo: { codigo: '26', nombre: 'Otra licencia' }, cantidad_ficha: '2/3' })], 12345678, 2026).flat()
  assert.equal(desconocido.map((fila) => fila.celdas[16].replaceAll('\n', '')).join(''), 'Otra licencia: 2/3 días')
  assert.deepEqual(paginarFicha([registro(1, { anulado_at: '2026-11-10' }), registro(2, { desde: '2027-01-01', hasta: '2027-01-03' })], 12345678, 2026), [[]])
  assert.equal(paginarFicha([registro(1, { desde: '2026-12-30', hasta: '2027-01-03', dias: 5 })], 12345678, 2027).flat()[0].celdas[1], '5', 'La planilla conserva las cantidades completas del registro, como Gestión')
  assert.throws(() => paginarFicha([registro(1, { dni: 87654321 })], 12345678, 2026), /corresponder/)
  assert.throws(() => paginarFicha([], 12345678, 2025), /Año/)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
