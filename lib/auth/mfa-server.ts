import 'server-only'
import type { User } from '@supabase/supabase-js'
import type { createClient } from '@/utils/supabase/server'
import type { MfaFactorOption } from './mfa'

type Client = Awaited<ReturnType<typeof createClient>>
export type MfaStatus = 'verified' | 'required' | 'none' | 'error'

// Call only after getUser() has validated the session with Supabase Auth.
export async function estadoMfa(client: Client, user: Pick<User, 'factors'>): Promise<MfaStatus> {
  try {
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data?.currentLevel || !data.nextLevel) return 'error'
    if (data.currentLevel === 'aal2') return 'verified'
    // getUser factors also cover a session whose stored factor list is stale.
    return data.nextLevel === 'aal2' || user.factors?.some((factor) => factor.status === 'verified')
      ? 'required' : 'none'
  } catch {
    return 'error'
  }
}

export async function factoresTotp(client: Client): Promise<{ factors: MfaFactorOption[]; error: boolean }> {
  try {
    const { data, error } = await client.auth.mfa.listFactors()
    if (error || !data) return { factors: [], error: true }
    return {
      factors: data.totp.filter((factor) => factor.status === 'verified').map((factor, index) => ({
        id: factor.id, nombre: factor.friendly_name || `Aplicación autenticadora ${index + 1}`,
      })),
      error: false,
    }
  } catch {
    return { factors: [], error: true }
  }
}
