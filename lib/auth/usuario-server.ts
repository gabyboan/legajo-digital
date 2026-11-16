import 'server-only'
import { cache } from 'react'
import type { createClient } from '@/utils/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

// Share Auth's verified response between Server Components in one render.
// Actions and Route Handlers still run this check on every invocation.
export const usuarioVerificado = cache((client: Client) => client.auth.getUser())
