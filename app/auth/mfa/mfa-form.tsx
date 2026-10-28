'use client'

import { useActionState, useEffect, useRef } from 'react'
import type { MfaFactorOption, MfaFormState } from '@/lib/auth/mfa'

type Props = {
  factors: MfaFactorOption[]
  destination: string
  action: (state: MfaFormState, formData: FormData) => Promise<MfaFormState>
}
const initialState: MfaFormState = { status: 'idle' }
const inputClass = 'min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-60'

export function MfaForm({ factors, destination, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.status === 'error' && codeRef.current) {
      codeRef.current.value = ''
      codeRef.current.focus()
    }
  }, [state])

  return <form action={formAction} onReset={(event) => event.preventDefault()} aria-busy={pending} className="space-y-4">
    <input type="hidden" name="next" value={destination} />
    {state.status === 'error' ? <p id="mfa-error" role="alert" aria-label="Error de verificación" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{state.message}</p> : null}
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <legend className="sr-only">Verificar aplicación autenticadora</legend>
      {factors.length > 1 ? <div>
        <label htmlFor="factor_id" className="mb-2 block text-sm text-zinc-300">Aplicación autenticadora</label>
        <select id="factor_id" name="factor_id" defaultValue={factors[0].id} className={inputClass}>
          {factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.nombre}</option>)}
        </select>
      </div> : <input type="hidden" name="factor_id" value={factors[0]?.id ?? ''} />}
      <div>
        <label htmlFor="code" className="mb-2 block text-sm text-zinc-300">Código de 6 dígitos</label>
        <input ref={codeRef} id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
          required pattern="[0-9 ]{6,7}" maxLength={7} autoCapitalize="none" spellCheck={false}
          aria-invalid={state.status === 'error' ? true : undefined}
          aria-describedby={`mfa-help${state.status === 'error' ? ' mfa-error' : ''}`}
          className={`${inputClass} text-center text-xl tracking-widest`} />
        <p id="mfa-help" className="mt-2 text-xs leading-relaxed text-zinc-400">Abrí tu aplicación autenticadora e ingresá el código actual de esta cuenta. Si está por cambiar, esperá el siguiente.</p>
      </div>
      <button type="submit" disabled={pending || factors.length === 0} className="min-h-11 w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-60">
        {pending ? 'Verificando…' : 'Verificar y continuar'}
      </button>
    </fieldset>
  </form>
}
