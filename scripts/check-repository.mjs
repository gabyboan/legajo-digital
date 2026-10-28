import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

// Revisa archivos versionados y nuevos que Git incluiría; nunca imprime secretos.
const paths = execFileSync('git', [
  'ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z',
], { encoding: 'utf8' }).split('\0').filter(Boolean)

const findings = []
const blockedPath = /^(?:\.env(?:\..+)?$|(?:\.wrangler|\.runtime|\.venv|venv)\/)|(?:^|\/)__pycache__\/|\.py[co]$/
const dataPath = /^(?:supabase\/imports|exportaciones)\//
const secretPatterns = [
  ['clave privada', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['token de GitHub', /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['clave secreta de Supabase', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['conexión de base con contraseña', /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/i],
]

for (const path of paths) {
  // Git también lista archivos borrados hasta que se registra su eliminación.
  if (!existsSync(path)) continue
  if ((blockedPath.test(path) && path !== '.env.example') ||
      (dataPath.test(path) && !path.endsWith('/.gitignore'))) {
    findings.push(`${path}: archivo local o importación que debe quedar fuera de Git`)
    continue
  }

  const buffer = readFileSync(path)
  if (buffer.subarray(0, 8192).includes(0)) continue
  const lines = buffer.toString('utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const [label, pattern] of secretPatterns) {
      if (pattern.test(line)) findings.push(`${path}:${index + 1}: posible ${label}`)
    }
    // Las claves JWT legacy públicas son válidas; service_role es privada.
    for (const token of line.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      try {
        const payload = JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url').toString())
        if (payload.role === 'service_role') {
          findings.push(`${path}:${index + 1}: clave service_role de Supabase`)
        }
      } catch {
        // Un texto parecido a un JWT no siempre es un token válido.
      }
    }
  })
}

if (findings.length) {
  console.error('Revisar antes de publicar:\n' + findings.map((item) => `- ${item}`).join('\n'))
  process.exitCode = 1
} else {
  console.log('Archivos revisados: sin importaciones locales ni secretos reconocidos por estas reglas.')
}
