/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression runner. */
// Synthetic sessions only; never signs into or writes to the production project.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { createServerClient } = require('@supabase/ssr')

function load(file, overrides = {}, cache = new Map()) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const testModule = { exports: {} }
  cache.set(file, testModule.exports)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
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
const navigation = { redirect(url) { throw new Redirect(url) } }
const destination = '/personas/12345678/editar'
const expiredHref = '/auth/expired?next=%2Fpersonas%2F12345678%2Feditar'
const request = () => new Request(`http://pc-04:3000/api/auth/session?${new URLSearchParams({ next: destination })}`)

function setup({ user = { id: 'synthetic-user' }, authError = null, dataError = null, signOutThrows = false } = {}) {
  const calls = []
  const client = {
    auth: {
      async getUser() { calls.push('auth'); return { data: { user }, error: authError } },
      async signOut(options) { calls.push({ signOut: options }); if (signOutThrows) throw new Error('OFFLINE'); return { error: null } },
    },
    async rpc(name) { calls.push(name); assert.equal(name, 'verificar_mfa_opcional'); return { data: null, error: dataError } },
  }
  const overrides = {
    'next/navigation': navigation,
    'next/cache': { revalidatePath() {} },
    '@/utils/supabase/server': { createClient: async () => client },
    '@/lib/auth/mfa-server': { estadoMfa: async () => 'none' },
    '@/lib/persona-comprobaciones': {},
    './permissions': { async canCurrentUserEditLegajo() { calls.push('permissions'); return false } },
  }
  return { client, calls, overrides, GET: load('app/api/auth/session/route.ts', overrides).GET }
}

async function main() {
  for (const [options, status] of [
    [{}, 200],
    [{ user: null }, 401],
    // Auth still accepts the user but the database has reached its one-hour limit.
    [{ dataError: { code: 'PT401', message: 'La sesión llegó a su límite de tiempo.' } }, 401],
    [{ dataError: { code: 'PGRST301' } }, 401],
    [{ dataError: { code: '42501', message: 'Verificá el código de tu autenticadora.' } }, 403],
    [{ dataError: { code: '42501', message: 'Permiso denegado.' } }, 503],
    [{ dataError: { code: 'PT409' } }, 409],
    [{ dataError: { code: 'NETWORK', message: 'INTERNAL_DETAIL' } }, 503],
    [{ user: null, authError: { status: 503, name: 'AuthRetryableFetchError' } }, 503],
  ]) {
    const test = setup(options)
    const response = await test.GET(request())
    assert.equal(response.status, status)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const body = await response.json()
    if (status === 401) assert.equal(body.href, expiredHref)
    if (status === 200) assert.deepEqual(body, { active: true })
    assert.equal(JSON.stringify(body).includes('INTERNAL_DETAIL'), false)
    assert.equal(test.calls.some((call) => typeof call === 'object'), false, 'Checking must never sign anyone out')
  }

  let test = setup({ dataError: { code: 'PT401' } })
  const data = new FormData()
  data.set('dni', '12345678')
  await assert.rejects(load('app/(private)/personas/actions.ts', test.overrides).updatePersonaConEstado({ status: 'idle' }, data),
    (error) => error instanceof Redirect && error.url === expiredHref)
  assert.deepEqual(test.calls, ['auth', 'verificar_mfa_opcional'], 'An expired session must redirect before checking business permissions or saving')
  test = setup({ dataError: { code: 'PT401' } })
  await assert.rejects(load('app/(private)/licencias/cargar/actions.ts', test.overrides).guardarLicencia({ status: 'idle' }, data),
    (error) => error instanceof Redirect && error.url === '/auth/expired?next=%2Flicencias%2Fcargar')
  assert.deepEqual(test.calls, ['auth', 'verificar_mfa_opcional'])

  for (const action of ['personas', 'licencias']) {
    test = setup({ dataError: { code: 'NETWORK' } })
    const save = action === 'personas'
      ? load('app/(private)/personas/actions.ts', test.overrides).updatePersonaConEstado
      : load('app/(private)/licencias/cargar/actions.ts', test.overrides).guardarLicencia
    const result = await save({ status: 'idle' }, data)
    assert.equal(result.status, 'error', 'A temporary failure must settle the form rather than leave it pending')
    assert.match(result.message, /comprobar la sesión/)
    assert.deepEqual(test.calls, ['auth', 'verificar_mfa_opcional'])
  }

  for (const signOutThrows of [false, true]) {
    test = setup({ signOutThrows })
    const route = load('app/auth/expired/route.ts', test.overrides).GET
    const internal = await route(new Request('http://localhost:3000' + expiredHref, { headers: { rsc: '1' } }))
    assert.equal(internal.status, 204)
    assert.deepEqual(test.calls, [], 'An internal render must not consume the browser cookie cleanup')
    const response = await route(new Request('http://localhost:3000' + expiredHref))
    assert.equal(response.headers.get('location'), 'http://localhost:3000/login?next=%2Fpersonas%2F12345678%2Feditar&expired=1')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(test.calls, [{ signOut: { scope: 'local' } }], 'Expiry must not sign out other computers')
    const unsafe = await route(new Request('http://localhost:3000/auth/expired?next=https://example.invalid'))
    assert.equal(new URL(unsafe.headers.get('location')).searchParams.get('next'), '/dashboard')
  }
  await testTokenRefresh()
  await testNetworkDeadline()
  console.log('Sesión: vencimiento de base con Auth válido, guardado sin permisos falsos, redirección, otras computadoras, renovación y límite de espera: OK')
}

async function testTokenRefresh() {
  const jar = new Map(), calls = []
  const now = Math.floor(Date.now() / 1000)
  const user = { id: '00000000-0000-4000-8000-000000000001', factors: [] }
  const session = (expired) => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
    return {
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aal: 'aal1', exp: now + (expired ? -60 : 3600) })}.synthetic`,
      refresh_token: expired ? 'synthetic-old' : 'synthetic-new', token_type: 'bearer', expires_in: expired ? -60 : 3600, user,
    }
  }
  const client = createServerClient('https://example.supabase.co', 'synthetic', {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll(items) { items.forEach(({ name, value }) => jar.set(name, value)) } },
    global: { fetch: async (url) => {
      const target = new URL(url)
      calls.push(target.pathname + target.search)
      if (target.pathname === '/auth/v1/token') return Response.json(session(target.searchParams.get('grant_type') === 'password'))
      if (target.pathname === '/auth/v1/user') return Response.json(user)
      if (target.pathname === '/rest/v1/rpc/verificar_mfa_opcional') return Response.json(null)
      throw new Error(`Unexpected request: ${target.pathname}`)
    } },
  })
  assert.equal((await client.auth.signInWithPassword({ email: 'demo@example.invalid', password: 'synthetic' })).error, null)
  const server = load('lib/auth/session-server.ts', { 'next/navigation': navigation })
  await server.exigirSesion(client, destination)
  assert.ok(calls.includes('/auth/v1/token?grant_type=refresh_token'), 'A short-lived token must refresh before deciding that the session expired')
  assert.ok(calls.includes('/rest/v1/rpc/verificar_mfa_opcional'))
  assert.ok(jar.size > 0, 'The refreshed session must reach response cookies')
}

async function testNetworkDeadline() {
  const originalFetch = global.fetch, originalTimeout = AbortSignal.timeout
  const { fetchConLimite, SUPABASE_TIMEOUT_MS } = load('lib/auth/fetch.ts')
  let attempts = 0
  try {
    AbortSignal.timeout = (duration) => {
      assert.equal(duration, SUPABASE_TIMEOUT_MS)
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), 5)
      return controller.signal
    }
    global.fetch = (_input, init) => new Promise((_resolve, reject) => {
      attempts++
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })
    await assert.rejects(fetchConLimite('https://example.invalid', { method: 'POST', body: 'synthetic' }), { name: 'TimeoutError' })
    assert.equal(attempts, 1, 'A timed-out save must never be retried automatically')
  } finally {
    global.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
