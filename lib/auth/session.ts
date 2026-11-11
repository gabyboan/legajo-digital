import { destinoMfa } from './mfa'

export function esSesionVencida(error: { code?: string; status?: number } | null | undefined) {
  return Boolean(error && (error.status === 401 || ['PT401', 'PGRST301', 'PGRST302', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error.code ?? '')))
}

export function enlaceSesionVencida(destination: string) {
  return `/auth/expired?${new URLSearchParams({ next: destinoMfa(destination) })}`
}

export function enlaceLoginVencido(destination: string) {
  return `/login?${new URLSearchParams({ next: destinoMfa(destination), expired: '1' })}`
}
