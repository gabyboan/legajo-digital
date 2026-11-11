'use client'

import { useEffect } from 'react'
import { destinoMfa } from '@/lib/auth/mfa'

export function SessionGuard() {
  useEffect(() => {
    let checking = false
    let leaving = false
    let controller: AbortController | null = null
    async function check() {
      if (checking || leaving || document.visibilityState === 'hidden') return
      checking = true
      controller = new AbortController()
      try {
        const next = destinoMfa(window.location.pathname + window.location.search)
        const response = await fetch(`/api/auth/session?${new URLSearchParams({ next })}`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        })
        if (response.status !== 401 && response.status !== 403) return
        const { href } = await response.json()
        if (!controller.signal.aborted && typeof href === 'string' && (href.startsWith('/auth/expired?') || href.startsWith('/auth/mfa?'))) {
          leaving = true
          window.location.replace(href)
        }
      } catch {
        // Losing the network does not mean that the user has lost their session.
      } finally {
        checking = false
      }
    }
    void check()
    const timer = window.setInterval(() => { void check() }, 30_000)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
      controller?.abort()
    }
  }, [])
  return null
}
