export type MfaFactorOption = { id: string; nombre: string }
export type MfaFormState = { status: 'idle' | 'error'; message?: string }

export function esRutaPrivada(pathname: string) {
  return ['/dashboard', '/personas', '/agenda'].some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

// Only return to a known application page, never to an external URL or auth loop.
export function destinoMfa(value: unknown) {
  const fallback = '/dashboard'
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || /[\\\s\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://legajo.invalid')
    if (url.origin !== 'https://legajo.invalid' || !esRutaPrivada(url.pathname)) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}

export function enlaceMfa(destination: string) {
  return `/auth/mfa?next=${encodeURIComponent(destinoMfa(destination))}`
}
