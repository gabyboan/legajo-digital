export default function CargandoPagina() {
  return <section role="status" aria-live="polite" aria-label="Cargando página" className="space-y-5">
    <p className="text-sm text-zinc-400">Cargando página…</p>
    <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
      <div className="h-8 w-52 rounded-lg bg-zinc-800" />
      <div className="h-24 rounded-xl bg-zinc-900" />
      <div className="h-64 rounded-xl bg-zinc-900" />
    </div>
  </section>
}
