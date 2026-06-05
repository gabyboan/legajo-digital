import type { Metadata } from "next";
import Link from "next/link";
import { BSoftwareLogo } from "@/app/components/b-software-logo";

export const metadata: Metadata = {
  title: "B Software | Productos web y software de gestion",
  description:
    "Productos de B Software para gestion institucional, portales de consulta, aplicaciones internas y sitios con foco SEO.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "B Software | Productos web y software de gestion",
    description:
      "Sistemas de gestion, aplicaciones internas y portales de consulta desarrollados por B Software.",
    type: "website",
    locale: "es_AR",
    siteName: "B Software",
  },
};

const modules = [
  "Legajos personales",
  "Cargos y servicios",
  "Situacion de revista",
  "Asistencia y francos",
  "Historial institucional",
  "Documentacion digital",
];

const products = [
  {
    name: "Legajo Digital",
    type: "Sistema institucional",
    href: "https://github.com/gabyboan/legajo-digital",
    description:
      "Software web para administrar legajos, cargos, servicios, asistencia e historial de personal con acceso protegido.",
    tags: ["Next.js", "Supabase", "RRHH"],
  },
  {
    name: "Consulta de Horas",
    type: "Portal publico",
    href: "https://github.com/gabyboan/consulta-horas",
    description:
      "Consulta online de horas disponibles con validacion Turnstile, Worker server-side y datos controlados desde Supabase.",
    tags: ["Cloudflare", "Turnstile", "Supabase"],
  },
  {
    name: "Suplencias Propuesta",
    type: "App operativa",
    href: "https://github.com/gabyboan/app-suplencias-propuesta",
    description:
      "Aplicacion Flutter para cargar y consultar propuestas de suplencias por usuario, rol y permisos de gestion.",
    tags: ["Flutter", "Dart", "PostgreSQL"],
  },
  {
    name: "Hogar Ancianos",
    type: "Sitio presentacion",
    href: "https://github.com/gabyboan/hogar-ancianos",
    description:
      "Sitio estatico orientado a presencia digital, contenido institucional y comunicacion clara de servicios.",
    tags: ["Astro", "Tailwind", "CMS"],
  },
];

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "B Software",
    url: "https://bsoftware.pages.dev",
    description:
      "B Software desarrolla productos web, aplicaciones internas y portales de consulta para gestion institucional, RRHH y procesos administrativos.",
    makesOffer: products.map((product) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "SoftwareApplication",
        name: product.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: product.description,
      },
    })),
    sameAs: ["https://github.com/gabyboan"],
    founder: {
      "@type": "Organization",
      name: "B Software",
    },
  };

  return (
    <main className="min-h-screen bg-[#070807] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="mx-auto flex min-h-[84vh] w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3" aria-label="B Software inicio">
            <span className="grid size-9 place-items-center rounded-md border border-emerald-300/30 bg-emerald-300/10 text-sm font-black text-emerald-100 shadow-[0_0_24px_rgba(99,214,176,0.16)]">
              B
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-[0.16em] uppercase text-white">
                B Software
              </span>
              <span className="block text-xs text-white/56">Productos digitales</span>
            </span>
          </Link>

          <Link
            href="/login"
            className="rounded-md border border-white/16 px-4 py-2 text-sm font-medium text-white/84 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-300/10 hover:text-white hover:shadow-[0_10px_24px_rgba(16,185,129,0.16)]"
          >
            Ingresar
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold tracking-[0.18em] text-[#63d6b0] uppercase">
              Software a medida para gestion y consultas online
            </p>
            <h1 className="text-5xl font-semibold leading-[1.02] text-balance sm:text-6xl lg:text-7xl">
              Productos web para ordenar datos, procesos y atencion institucional.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/62">
              B Software desarrolla sistemas de gestion, portales de consulta y
              aplicaciones internas para equipos que necesitan datos confiables,
              accesos seguros y mejores resultados en buscadores.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-md bg-white px-5 py-3 text-sm font-semibold text-black transition duration-200 hover:-translate-y-0.5 hover:bg-[#d8fff0] hover:shadow-[0_16px_34px_rgba(99,214,176,0.22)]"
              >
                Acceder al panel
              </Link>
              <a
                href="#productos"
                className="rounded-md border border-white/16 px-5 py-3 text-sm font-semibold text-white/82 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/45 hover:bg-emerald-300/10 hover:text-white"
              >
                Ver productos
              </a>
            </div>
          </div>

          <div className="border-y border-white/10 py-6 lg:border-x lg:border-y-0 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-4xl font-semibold">4</p>
                <p className="mt-2 text-sm leading-6 text-white/56">productos publicados y listos para presentar</p>
              </div>
              <div>
                <p className="text-4xl font-semibold">SEO</p>
                <p className="mt-2 text-sm leading-6 text-white/56">contenido preparado para posicionar soluciones</p>
              </div>
              <div>
                <p className="text-4xl font-semibold">Auth</p>
                <p className="mt-2 text-sm leading-6 text-white/56">sistemas con accesos y roles cuando el proceso lo requiere</p>
              </div>
              <div>
                <p className="text-4xl font-semibold">Web</p>
                <p className="mt-2 text-sm leading-6 text-white/56">portales y aplicaciones para operar desde cualquier lugar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="productos" className="border-t border-white/10 bg-[#0b100e]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[#63d6b0] uppercase">
                Productos
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-balance">
                Soluciones publicadas para gestion, consultas y comunicacion.
              </h2>
            </div>
            <p className="text-sm leading-7 text-white/62 lg:max-w-2xl">
              Cada producto se presenta con nombre claro, palabras clave y un
              enlace directo al repositorio para que Google y potenciales
              clientes entiendan que hace B Software.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {products.map((product) => (
              <a
                key={product.name}
                href={product.href}
                className="group rounded-md border border-white/10 bg-white/[0.035] p-5 transition duration-200 hover:-translate-y-1 hover:border-emerald-300/38 hover:bg-[#102018] hover:shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-emerald-200/80 uppercase">
                      {product.type}
                    </p>
                    <h3 className="mt-3 text-xl font-semibold text-white group-hover:text-[#d8fff0]">
                      {product.name}
                    </h3>
                  </div>
                  <span className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-semibold text-white/70 transition group-hover:border-emerald-300/40 group-hover:text-emerald-100">
                    GitHub
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-white/62">
                  {product.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/64"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="modulos" className="border-t border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-[#63d6b0] uppercase">
              Legajo Digital
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-balance">
              Una base administrativa preparada para crecer.
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((module) => (
              <div
                key={module}
                className="rounded-md border border-white/10 bg-black/22 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/30 hover:bg-emerald-300/[0.06]"
              >
                <p className="text-sm font-medium text-white/88">{module}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 sm:px-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:px-10">
          <BSoftwareLogo className="size-14 cursor-pointer overflow-visible" />

          <div>
            <p className="text-base font-semibold">B Software</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/54">
              Productos web, sistemas internos y portales de consulta con foco
              en gestion, seguridad y SEO.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-white/58 lg:justify-end">
            <Link href="/login" className="rounded-md px-2 py-1 transition hover:bg-white/[0.08] hover:text-white">
              Ingresar
            </Link>
            <a href="/sitemap.xml" className="rounded-md px-2 py-1 transition hover:bg-white/[0.08] hover:text-white">
              Sitemap
            </a>
            <a href="/robots.txt" className="rounded-md px-2 py-1 transition hover:bg-white/[0.08] hover:text-white">
              Robots
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
