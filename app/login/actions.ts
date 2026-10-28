'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { enlaceMfa } from '@/lib/auth/mfa'
import { estadoMfa } from '@/lib/auth/mfa-server'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=Completá%20email%20y%20contraseña')
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    redirect('/login?error=Credenciales%20inválidas%20o%20usuario%20inexistente')
  }

  const status = await estadoMfa(supabase, data.user)
  redirect(status === 'required' || status === 'error' ? enlaceMfa('/dashboard') : '/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
