import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./check-repository.mjs', import.meta.url))
const tempRoot = resolve(tmpdir())
const fixture = mkdtempSync(join(tempRoot, 'legajo-repo-check-'))

function write(path, content) {
  const target = join(fixture, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function check() {
  const result = spawnSync(process.execPath, [script], { cwd: fixture, encoding: 'utf8' })
  assert.ifError(result.error)
  return { status: result.status, output: result.stdout + result.stderr }
}

try {
  execFileSync('git', ['init', '--quiet'], { cwd: fixture })
  write('.gitignore', '.env.local\nsupabase/imports/*.csv\n')
  write('.env.example', 'NEXT_PUBLIC_SITE_URL=http://localhost:3000\n')
  write('.env.local', 'LOCAL_ONLY=value\n')
  write('supabase/imports/personal.csv', 'dato ficticio\n')
  assert.equal(check().status, 0, 'Los archivos locales ignorados quedan fuera de la revisión')

  execFileSync('git', ['add', '--force', '.env.local', 'supabase/imports/personal.csv'], { cwd: fixture })
  let result = check()
  assert.equal(result.status, 1, 'Un archivo ya versionado debe detectarse aunque esté ignorado')
  assert.match(result.output, /\.env\.local/)
  assert.match(result.output, /supabase\/imports\/personal\.csv/)
  execFileSync('git', ['rm', '--cached', '--quiet', '.env.local', 'supabase/imports/personal.csv'], { cwd: fixture })

  const jwt = (role) => [
    Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'),
    Buffer.from(JSON.stringify({ role })).toString('base64url'),
    'synthetic-signature',
  ].join('.')
  write('public-key.txt', jwt('anon'))
  assert.equal(check().status, 0, 'Las claves JWT públicas anon son admisibles')

  const privateToken = ['sb', 'secret', 'x'.repeat(24)].join('_')
  const privateJwt = jwt('service_role')
  write('private-key.txt', privateToken + '\n' + privateJwt)
  result = check()
  assert.equal(result.status, 1, 'Los secretos nuevos también deben detectarse sin git add')
  assert.match(result.output, /private-key\.txt:1/)
  assert.match(result.output, /private-key\.txt:2/)
  assert.equal(result.output.includes(privateToken), false, 'No se debe imprimir el secreto')
  assert.equal(result.output.includes(privateJwt), false, 'No se debe imprimir el JWT')
  rmSync(join(fixture, 'private-key.txt'))

  write('.wrangler/tmp/local.txt', 'temporal\n')
  assert.equal(check().status, 1, 'Los temporales sin ignorar deben bloquear la revisión')
  console.log('Repositorio: archivos ignorados/versionados, secretos nuevos y salida sin credenciales: OK')
} finally {
  // Sólo borrar el directorio temporal creado por esta prueba.
  if (!resolve(fixture).startsWith(tempRoot + sep) ||
      !resolve(fixture).startsWith(join(tempRoot, 'legajo-repo-check-'))) {
    throw new Error('Directorio temporal fuera de la ubicación esperada')
  }
  rmSync(fixture, { recursive: true, force: true })
}
