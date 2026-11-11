import Link from 'next/link'

export function ModuleMessage({ error = false, children }: { error?: boolean; children: React.ReactNode }) {
  return (
    <div role={error ? 'alert' : 'status'} className={`rounded-xl border p-5 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-100'}`}>
      <p>{children}</p>
      <Link href="/licencias" className="mt-3 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">Volver a Licencias</Link>
    </div>
  )
}
