/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression runner. */
// Synthetic sessions only. No real Auth service, users, tokens or data are used.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { NextRequest } = require('next/server')
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

const routing = load('lib/auth/mfa.ts')
const { estadoMfa } = load('lib/auth/mfa-server.ts')
const user = { id: 'synthetic-user', factors: [{ id: 'factor-1', status: 'verified', factor_type: 'totp' }] }
class Redirect extends Error { constructor(url) { super(url); this.url = url } }
const navigation = { redirect(url) { throw new Redirect(url) } }
const idle = { status: 'idle' }

function setup(options = {}) {
  const calls = []
  const authenticatedUser = options.noVerifiedFactors ? { ...user, factors: [] } : user
  let level = options.verified ? 'aal2' : 'aal1'
  const client = {
    auth: {
      async getUser() { calls.push('user'); return { data: { user: options.anonymous ? null : authenticatedUser }, error: null } },
      async signInWithPassword() { return { data: { user: authenticatedUser }, error: null } },
      mfa: {
        async getAuthenticatorAssuranceLevel() {
          return options.assuranceError ? { data: null, error: { message: 'INTERNAL' } }
            : { data: { currentLevel: level, nextLevel: options.noFactor ? 'aal1' : 'aal2' }, error: null }
        },
        async listFactors() {
          calls.push('factors')
          return { data: { totp: options.noFactor ? [] : options.unverifiedFactor ? [{ ...user.factors[0], status: 'unverified' }] : user.factors }, error: null }
        },
        async challengeAndVerify(args) {
          calls.push(args)
          if (options.throwNetwork) throw new Error('INTERNAL')
          if (options.verifyError) return { data: null, error: options.verifyError }
          if (!options.noUpgrade) level = 'aal2'
          return { data: { user }, error: null }
        },
      },
    },
  }
  const overrides = {
    'next/navigation': navigation,
    'next/cache': { revalidatePath: (...args) => calls.push(['revalidate', ...args]) },
    '@/utils/supabase/server': { createClient: async () => client },
  }
  return { calls, client, action: load('app/auth/mfa/actions.ts', overrides).verificarMfa, login: load('app/login/actions.ts', overrides).login }
}

function form(changes = {}) {
  const result = new FormData()
  for (const [key, value] of Object.entries({ code: '000 123', factor_id: 'factor-1', next: '/personas?q=12345678', ...changes })) result.set(key, value)
  return result
}
const redirects = (url) => (error) => error instanceof Redirect && error.url === url

async function main() {
  for (const unsafe of ['https://example.invalid', '//example.invalid', '/\\example.invalid', '/login', '/auth/mfa', '/api/personas/exportar', '/personas/../../login', '/personas\n', null, ['personas']]) {
    assert.equal(routing.destinoMfa(unsafe), '/dashboard')
  }
  assert.equal(routing.destinoMfa('/personas/12345678/editar?seccion=contacto'), '/personas/12345678/editar?seccion=contacto')
  assert.equal(await estadoMfa(setup({ noFactor: true }).client, user), 'required', 'Fresh verified factors must override stale session metadata')
  assert.equal(await estadoMfa(setup({ noFactor: true }).client, { factors: [] }), 'none')
  const anonymous = setup({ anonymous: true })
  await assert.rejects(anonymous.action(idle, form()), redirects('/login'))
  assert.deepEqual(anonymous.calls, ['user'])
  const already = setup({ verified: true })
  await assert.rejects(already.action(idle, form()), redirects('/personas?q=12345678'))
  assert.deepEqual(already.calls, ['user'])

  for (const changes of [{ code: '123' }, { code: 'abcdef' }, { code: new File(['123456'], 'code.txt') }, { factor_id: 'somebody-elses-factor' }]) {
    const test = setup()
    assert.equal((await test.action(idle, form(changes))).status, 'error')
    assert.equal(test.calls.some((call) => typeof call === 'object'), false, 'Invalid inputs must not create challenges')
  }
  const repeated = form()
  repeated.append('code', '123456')
  assert.equal((await setup().action(idle, repeated)).status, 'error')
  const noFactor = setup({ noFactor: true })
  assert.equal((await noFactor.action(idle, form())).status, 'error')
  assert.equal(noFactor.calls.some((call) => typeof call === 'object'), false)
  const unverified = setup({ unverifiedFactor: true })
  assert.equal((await unverified.action(idle, form())).status, 'error')
  assert.equal(unverified.calls.some((call) => typeof call === 'object'), false)

  for (const [options, expected] of [
    [{ verifyError: { code: 'mfa_verification_failed', message: 'INTERNAL' } }, /incorrecto o venció/],
    [{ verifyError: { code: 'mfa_challenge_expired' } }, /incorrecto o venció/],
    [{ verifyError: { status: 429 } }, /demasiados intentos/],
    [{ verifyError: { code: 'mfa_factor_not_found' } }, /no está disponible/],
    [{ verifyError: { code: 'unknown', message: 'INTERNAL' } }, /No se pudo verificar/],
    [{ throwNetwork: true }, /No se pudo conectar/],
    [{ assuranceError: true }, /No se pudo comprobar/],
    [{ noUpgrade: true }, /No se pudo confirmar/],
  ]) {
    const result = await setup(options).action(idle, form())
    assert.equal(result.status, 'error')
    assert.match(result.message, expected)
    assert.equal(JSON.stringify(result).includes('INTERNAL'), false)
    assert.equal(JSON.stringify(result).includes('000123'), false, 'Never return the OTP to the client')
  }
  const success = setup()
  await assert.rejects(success.action(idle, form()), redirects('/personas?q=12345678'))
  assert.deepEqual(success.calls.find((call) => call?.factorId), { factorId: 'factor-1', code: '000123' })
  assert.deepEqual(success.calls.at(-1), ['revalidate', '/', 'layout'])
  await assert.rejects(setup().action(idle, form({ next: '//example.invalid' })), redirects('/dashboard'))
  const credentials = new FormData()
  credentials.set('email', 'demo@example.invalid')
  credentials.set('password', 'synthetic-password')
  await assert.rejects(setup().login(credentials), redirects('/auth/mfa?next=%2Fdashboard'))
  await assert.rejects(setup({ noFactor: true, noVerifiedFactors: true }).login(credentials), redirects('/dashboard'))

  await testProxy()
  await testSsrCookies()
  console.log('MFA: navegación, autenticación, factores propios, códigos inválidos/vencidos, límites, sesión SSR y retorno seguro: OK')
}

async function testProxy() {
  for (const { url = '/personas?q=texto', method = 'GET', options = {}, expected } of [
    { expected: '/auth/mfa?next=%2Fpersonas%3Fq%3Dtexto' },
    { url: '/agenda', expected: '/auth/mfa?next=%2Fagenda' },
    { options: { verified: true }, expected: null },
    { options: { assuranceError: true }, expected: '/auth/mfa?next=%2Fpersonas%3Fq%3Dtexto' },
    { options: { anonymous: true }, expected: null },
    { url: '/auth/mfa', expected: null },
    { url: '/api/personas/exportar', expected: null },
    { url: '/login', expected: null },
    { method: 'POST', expected: null },
  ]) {
    const { client } = setup(options)
    const originalGetUser = client.auth.getUser
    const middleware = load('utils/supabase/middleware.ts', {
      '@supabase/ssr': { createServerClient(_url, _key, config) {
        client.auth.getUser = async () => {
          config.cookies.setAll([{ name: 'synthetic-refresh', value: 'rotated', options: { path: '/', httpOnly: true } }])
          return originalGetUser()
        }
        return client
      } },
      './config': { getSupabaseConfig: () => ({ url: 'https://example.supabase.co', key: 'synthetic' }) },
    })
    const result = await middleware.updateSession(new NextRequest('https://legajo.invalid' + url, { method }))
    assert.equal(result.headers.get('location'), expected ? 'https://legajo.invalid' + expected : null)
    assert.equal(result.cookies.get('synthetic-refresh')?.value, 'rotated', 'Redirects must keep refreshed session cookies')
    if (expected) assert.equal(result.headers.get('cache-control'), 'private, no-store')
  }
}

async function testSsrCookies() {
  // Use the installed Supabase SSR/Auth SDK against an in-memory Auth API.
  // This verifies that MFA upgrades really reach setAll(), beyond the action stub.
  const jar = new Map(), writes = [], requests = []
  const session = (aal) => {
    const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const access_token = `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ sub: user.id, aal, exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic-signature`
    return { access_token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user }
  }
  const client = createServerClient('https://example.supabase.co', 'synthetic-publishable', {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll(items) { writes.push(items); for (const item of items) jar.set(item.name, item.value) },
    },
    global: { fetch: async (url, init) => {
      const pathname = new URL(url).pathname
      requests.push(pathname)
      let body
      if (pathname === '/auth/v1/token') body = session('aal1')
      else if (pathname === '/auth/v1/user') body = user
      else if (pathname === '/auth/v1/factors/factor-1/challenge') body = { id: 'synthetic-challenge', expires_at: Date.now() / 1000 + 300 }
      else if (pathname === '/auth/v1/factors/factor-1/verify') {
        assert.equal(JSON.parse(init.body).code, '000123')
        body = session('aal2')
      } else throw new Error(`Unexpected Auth request: ${pathname}`)
      return Response.json(body)
    } },
  })
  assert.equal((await client.auth.signInWithPassword({ email: 'demo@example.invalid', password: 'synthetic' })).error, null)
  const initialWrites = writes.length
  const action = load('app/auth/mfa/actions.ts', {
    'next/navigation': navigation, 'next/cache': { revalidatePath() {} },
    '@/utils/supabase/server': { createClient: async () => client },
  }).verificarMfa
  await assert.rejects(action(idle, form()), redirects('/personas?q=12345678'))
  assert.ok(writes.length > initialWrites, 'AAL2 session must be written to response cookies')
  assert.ok(requests.includes('/auth/v1/factors/factor-1/verify'))
  const restored = createServerClient('https://example.supabase.co', 'synthetic-publishable', {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll() {} },
    global: { fetch: async () => Response.json(user) },
  })
  await restored.auth.getUser()
  assert.equal((await restored.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel, 'aal2', 'Next request must recover the verified session from cookies')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
