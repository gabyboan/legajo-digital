/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic standalone regression tests. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, overrides = {}, cache = new Map()) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const m = { exports: {} }; cache.set(file, m.exports)
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', compiled)((id) => {
    if (id in overrides) return overrides[id]
    if (id === 'server-only') return {}
    if (id.startsWith('@/')) return load(id.slice(2) + '.ts', overrides, cache)
    if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id + '.ts'), overrides, cache)
    return require(id)
  }, m, m.exports)
  return m.exports
}
function form(changes = {}) {
  const f = new FormData()
  for (const [key, value] of Object.entries({ origen: 'franco', id: '101', version: 'a'.repeat(32), control_id: '0', calendario_version: 'b'.repeat(32), estado: 'confirmada', observacion: '', operacion: '00000000-0000-4000-8000-000000000001', corroborado: 'si', advertencias: 'si', ...changes })) f.set(key, value)
  return f
}
function setup(options = {}) {
  const writes = []; const invalidations = []
  const client = { async rpc(name, args) {
    if (name === 'can_novedades_read' || name === 'can_novedades_confirm') return { data: !options.denied, error: options.permissionError ?? null }
    assert.equal(name, 'rpc_novedades_controlar'); writes.push(args)
    return { data: options.noReceipt ? null : { id: 10 }, error: options.error ?? null }
  } }
  const actions = load('app/(private)/licencias/control-novedades/actions.ts', {
    '@/utils/supabase/server': { createClient: async () => client },
    '@/lib/auth/session-server': { exigirSesion: async () => { if (options.expired) throw new Error('NEXT_REDIRECT') }, redirigirSiSesionVencida: (e) => { if (e?.code === 'PT401') throw new Error('NEXT_REDIRECT') }, SesionNoDisponibleError: class extends Error {} },
    'next/cache': { revalidatePath: (url) => invalidations.push(url) },
  })
  return { actions, writes, invalidations }
}
async function main() {
  const domain = load('lib/novedades/domain.ts')
  assert.equal(domain.cantidadVisible({ minutos: 90, cantidad: null, unidad: 'minutos' }), '1 h 30 min')
  assert.equal(domain.cantidadVisible({ minutos: null, cantidad: 2, unidad: 'días aprobados' }), '2 días aprobados')
  assert.equal(domain.estadoTexto.confirmada, 'Confirmada')
  assert.equal(domain.filtrosNovedades({ desde: '2026-02-30', hasta: '2026-03-01' }).valid, false)
  assert.equal(domain.filtrosNovedades({ desde: '2026-01-01', hasta: '2028-01-01' }).valid, false)
  assert.equal(domain.filtrosNovedades({ pagina: '9007199254740999999' }).pagina, 1)
  for (const invalid of [form({ advertencias: '' }), form({ corroborado: '' }), form({ estado: 'observada' }), form({ id: '-1' }), form({ origen: 'otra' }), form({ version: 'inventada' }), form({ licencia: `501:${'c'.repeat(32)}` }), form({ operacion: 'no-uuid' })]) assert.equal(domain.datosControl(invalid), null)
  const duplicate = form(); duplicate.append('id', '202'); assert.equal(domain.datosControl(duplicate), null)
  const linked = domain.datosControl(form({ origen: 'medico', licencia: `501:${'c'.repeat(32)}` }))
  assert.equal(linked.p_licencia_id, 501)
  let test = setup({ denied: true })
  assert.equal((await test.actions.guardarControl({}, form())).status, 'error'); assert.equal(test.writes.length, 0)
  test = setup({ expired: true })
  await assert.rejects(test.actions.guardarControl({}, form()), /NEXT_REDIRECT/); assert.equal(test.writes.length, 0)
  test = setup({ error: { code: '40001', message: 'SQL_INTERNAL_DETAILS' } })
  const conflict = await test.actions.guardarControl({}, form()); assert.equal(conflict.status, 'error'); assert.match(conflict.message, /cambiaron/); assert.doesNotMatch(conflict.message, /SQL_INTERNAL/)
  test = setup({ noReceipt: true })
  assert.equal((await test.actions.guardarControl({}, form())).status, 'error'); assert.equal(test.invalidations.length, 0)
  test = setup()
  assert.equal((await test.actions.guardarControl({}, form())).status, 'success')
  assert.equal(test.writes.length, 1); assert.equal(test.writes[0].p_operacion, '00000000-0000-4000-8000-000000000001')
  assert.deepEqual(test.invalidations, ['/licencias/control-novedades'])
  console.log('Novedades: filtros, unidades, formularios, permisos, sesión, errores, vinculación, recibo e invalidación: OK')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
