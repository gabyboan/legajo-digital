'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { destinoMfa, type MfaFormState } from '@/lib/auth/mfa'
import { estadoMfa, factoresTotp } from '@/lib/auth/mfa-server'

function verificationError(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'Se hicieron demasiados intentos. Esperá unos minutos antes de volver a probar.'
  if (['mfa_verification_failed', 'mfa_verification_rejected', 'mfa_challenge_expired'].includes(error.code ?? '')) return 'El código es incorrecto o venció. Ingresá el código actual de tu aplicación autenticadora.'
  if (error.code === 'mfa_factor_not_found') return 'La aplicación seleccionada ya no está disponible. Volvé a cargar esta página.'
  return 'No se pudo verificar el código. Intentá nuevamente.'
}

export async function verificarMfa(_previousState: MfaFormState, formData: FormData): Promise<MfaFormState> {
  const fail = (message: string): MfaFormState => ({ status: 'error', message })
  const destination = destinoMfa(formData.get('next'))
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) redirect('/login')
  const status = await estadoMfa(client, user)
  if (status === 'verified') redirect(destination)
  if (status === 'error') return fail('No se pudo comprobar tu sesión. Intentá nuevamente o cerrá sesión para volver a ingresar.')

  const rawCode = formData.get('code')
  const factorId = formData.get('factor_id')
  const code = typeof rawCode === 'string' ? rawCode.replace(/\s/g, '') : ''
  if (!/^\d{6}$/.test(code) || formData.getAll('code').length !== 1) return fail('Ingresá los 6 dígitos del código de tu aplicación autenticadora.')
  if (typeof factorId !== 'string' || formData.getAll('factor_id').length !== 1) return fail('Seleccioná una aplicación autenticadora válida.')

  const { factors, error: factorError } = await factoresTotp(client)
  if (factorError) return fail('No se pudieron consultar tus aplicaciones autenticadoras. Intentá nuevamente.')
  // Never trust a submitted factor ID without checking ownership and verified status.
  if (!factors.some((factor) => factor.id === factorId)) return fail('La aplicación seleccionada no está disponible. Volvé a cargar esta página.')

  try {
    // On success, Supabase SSR persists the upgraded session in the response cookies.
    const result = await client.auth.mfa.challengeAndVerify({ factorId, code })
    if (result.error) return fail(verificationError(result.error))
    if (!result.data || await estadoMfa(client, user) !== 'verified') return fail('No se pudo confirmar la verificación. Volvé a intentarlo.')
  } catch {
    return fail('No se pudo conectar para verificar el código. Intentá nuevamente.')
  }

  revalidatePath('/', 'layout')
  redirect(destination)
}
