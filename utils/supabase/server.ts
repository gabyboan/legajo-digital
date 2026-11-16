import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { getSupabaseConfig } from './config'
import { fetchConLimite } from '@/lib/auth/fetch'

// React owns this cache: one client per render request, never a process singleton.
export const createClient = cache(async () => {
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
})
