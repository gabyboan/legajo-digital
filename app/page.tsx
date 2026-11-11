import type { Metadata } from "next";
import Link from "next/link";
import { ModuleSelection } from './(private)/components/module-selection';

export const metadata: Metadata = {
  title: "Legajo Digital",
  description:
    "Sistema institucional para administrar legajos, licencias e historial del personal.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Legajo Digital",
    description:
      "Sistema institucional para administrar legajos, licencias e historial del personal.",
    type: "website",
    locale: "es_AR",
    siteName: "Legajo Digital",
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#070807] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3" aria-label="Legajo Digital inicio">
            <span className="grid size-9 place-items-center rounded-md border border-emerald-300/30 bg-emerald-300/10 text-sm font-black text-emerald-100">
              LD
            </span>
            <span className="text-sm font-semibold tracking-[0.16em] uppercase">
              Legajo Digital
            </span>
          </Link>

          <Link
            href="/login"
            className="rounded-md border border-white/16 px-4 py-2 text-sm font-medium transition hover:border-emerald-300/45 hover:bg-emerald-300/10"
          >
            Ingresar
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-10 py-14">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold tracking-[0.18em] text-[#63d6b0] uppercase">
              Gestión institucional del personal
            </p>
            <h1 className="text-5xl font-semibold leading-[1.02] text-balance sm:text-6xl lg:text-7xl">
              Seleccioná tu módulo de trabajo.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/62">
              Accedé a Legajo Digital para administrar los datos del personal,
              o a Licencias para cargar licencias y consultar las fichas.
            </p>
          </div>

          <ModuleSelection />
        </div>

        <footer className="border-t border-white/10 py-5 text-sm text-white/54">
          Legajo Digital
        </footer>
      </section>
    </main>
  );
}
