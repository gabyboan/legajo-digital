import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseConfig } from './config'
import { fetchConLimite } from '@/lib/auth/fetch'

export async function createClient() {
  const cookieStore = await cookies()

  const { url, key } = getSupabaseConfig()

  return createServerClient(url, key, {
    global: { fetch: fetchConLimite },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {}
      },
    },
  })
}
