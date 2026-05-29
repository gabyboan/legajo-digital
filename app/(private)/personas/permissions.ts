import type { createClient } from '@/utils/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const LEGAJO_EDIT_ROLE_IDS = [19, 20]

export async function canCurrentUserEditLegajo(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (usuarioError) {
    return false
  }

  const roleQuery = supabase
    .from('usuario_roles')
    .select('rol_id')
    .in('rol_id', LEGAJO_EDIT_ROLE_IDS)
    .limit(1)

  const { data: roles, error: rolesError } = usuario
    ? await roleQuery.or(`usuario_id.eq.${usuario.id},usuario_id.eq.${user.id}`)
    : await roleQuery.eq('usuario_id', user.id)

  if (rolesError) {
    return false
  }

  return (roles?.length ?? 0) > 0
}
