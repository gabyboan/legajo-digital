import 'server-only'

function originFromUrl(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

export function esOrigenPermitido(request: Request) {
  const origin = originFromUrl(request.headers.get('origin'))

  if (!origin) {
    return false
  }

  const origenesPermitidos = new Set<string>()
  const origenActual = originFromUrl(request.url)
  const origenConfigurado = originFromUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const hosts = [
    request.headers.get('host'),
    request.headers.get('x-forwarded-host'),
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase())

  if (origenActual) {
    origenesPermitidos.add(origenActual)
  }

  if (origenConfigurado) {
    origenesPermitidos.add(origenConfigurado)
  }

  if (origenesPermitidos.has(origin)) {
    return true
  }

  // Next can build request.url with 0.0.0.0 while the browser uses localhost
  // or the machine IP. The Host header identifies the origin actually used.
  try {
    const originUrl = new URL(origin)
    return hosts.includes(originUrl.host.toLowerCase())
  } catch {
    return false
  }
}

export function dniDelPayload(payload: unknown) {
  const dni =
    payload &&
    typeof payload === 'object' &&
    'dni' in payload &&
    (typeof payload.dni === 'string' || typeof payload.dni === 'number')
      ? String(payload.dni)
      : ''

  return /^\d{7,8}$/.test(dni) ? dni : null
}

export function respuestaDeError(error: string, status: number) {
  return Response.json(
    { error },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
