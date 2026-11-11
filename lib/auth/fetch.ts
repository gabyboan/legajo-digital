// A failed network request must settle so forms can leave their pending state.
// Never retry writes: a lost response does not prove that a write was rejected.
export const SUPABASE_TIMEOUT_MS = 20_000

export const fetchConLimite: typeof fetch = (input, init) => {
  const original = init?.signal ?? (input instanceof Request ? input.signal : null)
  const timeout = AbortSignal.timeout(SUPABASE_TIMEOUT_MS)
  return fetch(input, { ...init, signal: original ? AbortSignal.any([original, timeout]) : timeout })
}
