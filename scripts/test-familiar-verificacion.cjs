/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression runner. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('app/api/validacion-dni/familiar/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function setup({ permiso = true, pendiente = true, saved = true, autenticado = true, titular = true, fallaConsulta = false } = {}) {
  const writes = []
  const checks = []
  const familiar = { id: 7, dni: 12345678, apellido: 'Lemos', nombre: 'Miguel', dni_validado_at: null, cuil: 99999999999 }
  const consulta = { dni: '12345678', nombre: 'LEMOS MIGUEL ANGEL', cuit: '20123456786', tipo: 'CUIT', comprobadoEn: '2026-09-07T12:00:00Z' }
  const client = {
    auth: { getUser: async () => ({ data: { user: autenticado ? { id: 'editor' } : null } }) },
    from(table) {
      let updated = false
      const query = {
        select() { return query }, eq() { return query }, is() { return query },
        update(value) { updated = true; writes.push(value); return query },
        async maybeSingle() {
          return { error: null, data: updated ? (saved ? { dni_validado_at: '2026-09-07T12:00:00Z' } : null) : table === 'personas' ? (titular ? { dni: 23456789 } : null) : familiar }
        },
      }
      return query
    },
  }
  class ConsultaNombreFamiliarError extends Error {}
  const dependencies = {
    '@/lib/dni': { dniDesdeRegistro: (value) => value == null ? '' : String(value).padStart(8, '0') },
    '@/app/(private)/personas/permissions': { canCurrentUserEditLegajo: async () => permiso },
    '@/lib/dni-comprobaciones': {
      comprobarDniParaUsuario: async (...args) => { checks.push(args); return consulta },
      obtenerComprobacionPendiente: () => pendiente ? consulta : null,
      consumirComprobacionPendiente: () => {},
    },
    '@/lib/consulta-nombre-familiar': {
      ConsultaNombreFamiliarError,
      consultarNombreFamiliar: async (dni, signal) => {
        checks.push([dni, signal])
        if (fallaConsulta) throw new ConsultaNombreFamiliarError('Fuente no disponible.')
        return { dni: dni.padStart(8, '0'), comprobadoEn: consulta.comprobadoEn, requiereRevision: false, intentos: [
          { fuente: 'nosis', estado: 'con_datos', detalle: null, resultados: [{ nombre: consulta.nombre, numero: consulta.cuit }] },
        ] }
      },
    },
    '@/lib/cuitonline': { ConsultaCuitOnlineError: class extends Error {} },
    '@/lib/validacion-dni-request': {
      esOrigenPermitido: (request) => request.headers.get('origin') === 'http://localhost:3000',
      dniDelPayload: (p) => /^\d{7,8}$/.test(String(p.dni)) ? String(p.dni) : null,
      respuestaDeError: (error, status) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } }),
    },
    '@/utils/supabase/server': { createClient: async () => client },
  }
  const testModule = { exports: {} }
  new Function('require', 'exports', 'module', source)((id) => {
    assert.ok(dependencies[id], `Unexpected dependency ${id}`)
    return dependencies[id]
  }, testModule.exports, testModule)
  return {
    writes, checks,
    post: (body, origin = 'http://localhost:3000') => testModule.exports.POST(new Request('http://localhost:3000/api/validacion-dni/familiar', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })),
  }
}

async function main() {
  const draft = { accion: 'comprobar-nombre', personaDni: 23456789, dni: '12345678' }
  let test = setup()
  let response = await test.post(draft)
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(data.intentos[0].resultados[0].nombre, 'LEMOS MIGUEL ANGEL')
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal('cuit' in data, false)
  assert.equal('tipo' in data, false)
  assert.equal(test.writes.length, 0)
  assert.equal(test.checks.length, 1)
  assert.ok(test.checks[0][1] instanceof AbortSignal)
  for (const dni of ['05956728', '5956728']) {
    test = setup()
    response = await test.post({ ...draft, dni })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).dni, '05956728')
    assert.equal(test.checks[0][0], dni)
    assert.equal(test.writes.length, 0)
  }
  test = setup()
  assert.equal((await test.post({ ...draft, dni: '123' })).status, 400)
  assert.equal(test.checks.length, 0)
  for (const [options, status] of [[{ permiso: false }, 403], [{ autenticado: false }, 401], [{ titular: false }, 404]]) {
    test = setup(options)
    assert.equal((await test.post(draft)).status, status)
    assert.equal(test.checks.length, 0)
    assert.equal(test.writes.length, 0)
  }
  assert.equal((await setup().post(draft, 'http://otro.test')).status, 403)
  assert.equal((await setup({ fallaConsulta: true }).post(draft)).status, 422)
  test = setup()
  response = await test.post({ accion: 'validar', id: 7 })
  assert.equal(response.status, 200)
  assert.equal('cuil' in test.writes[0], false)
  assert.equal('cuil' in await response.json(), false)
  test = setup()
  response = await test.post({ accion: 'comprobar', id: 7 })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).nombre, 'LEMOS MIGUEL ANGEL')
  assert.match(test.checks[0][0], /familiar:7:/)
  assert.equal((await setup({ pendiente: false }).post({ accion: 'validar', id: 7 })).status, 409)
  assert.equal((await setup({ saved: false }).post({ accion: 'validar', id: 7 })).status, 409)
  console.log('Familiares: consulta por DNI sin alta, permisos, cero inicial y validación existente: OK')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
