'use client'

import { useState } from 'react'

export function PasswordField() {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id="password"
        name="password"
        type={visible ? 'text' : 'password'}
        placeholder="********"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 pr-12 text-sm outline-none transition focus:border-zinc-500"
        required
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-white"
      >
        {visible ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.7a2 2 0 002.7 2.7" />
            <path d="M9.9 4.3A10.8 10.8 0 0112 4c5 0 8.7 4 10 8a15.7 15.7 0 01-3.1 5.1M6.2 6.2C4.5 7.4 3.3 9.3 2 12c1.3 4 5 8 10 8a10.8 10.8 0 004.1-.8" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        )}
      </button>
    </div>
  )
}