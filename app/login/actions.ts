'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { destinoMfa, enlaceMfa } from '@/lib/auth/mfa'
import { estadoMfa } from '@/lib/auth/mfa-server'

export async function login(formData: FormData) {
  const destination = destinoMfa(formData.get('next'))
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect(`/login?${new URLSearchParams({ next: destination, error: 'Completá email y contraseña' })}`)
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    redirect(`/login?${new URLSearchParams({ next: destination, error: 'Credenciales inválidas o usuario inexistente' })}`)
  }

  const status = await estadoMfa(supabase, data.user)
  redirect(status === 'required' || status === 'error' ? enlaceMfa(destination) : destination)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
