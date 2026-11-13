import Link from 'next/link'
import { permisosLicencias, sesionLicencias } from '@/lib/licencias/server'
import { permisosNovedades } from '@/lib/novedades/server'

export default async function LicenciasPage() {
  const supabase = await sesionLicencias('/licencias')
  const permisos = await permisosLicencias(supabase)
  const novedades = await permisosNovedades(supabase)
  return (
    <section className="space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-400 underline underline-offset-4 hover:text-white">← Volver al inicio</Link>
        <h1 className="mt-4 text-2xl font-bold">Licencias</h1>
        <p className="mt-1 text-sm text-zinc-400">Cargá licencias, revisá las últimas cargas y consultá las fichas del personal.</p>
      </div>
      {permisos.error ? <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">No se pudieron comprobar todos los permisos. Volvé a intentarlo o consultá al administrador.</p> : null}
      <div className="grid gap-4 xl:grid-cols-3">
        {[
          { href: '/licencias/cargar', title: 'Cargar licencias', description: 'Seleccioná un agente y registrá el tipo de licencia, las fechas y las observaciones.', enabled: permisos.leer && permisos.cargar, permission: 'Requiere permiso de carga de licencias.' },
          { href: '/licencias/ultimas', title: 'Últimas cargas', description: 'Revisá quién cargó cada licencia, su fecha y hora. Corregí o borrá una carga equivocada con permiso de administración.', enabled: permisos.leer, permission: 'Requiere permiso de lectura de licencias.' },
          { href: '/licencias/control-novedades', title: 'Control de novedades', description: 'Corroborá francos tomados, revisá Horas y partes médicos, y consultá avisos de feriados y coincidencias.', enabled: novedades.leer, permission: novedades.error ? 'Requiere actualizar el módulo o comprobar la conexión.' : 'Requiere permiso de consulta o confirmación de novedades.' },
          { href: '/licencias/fichas', title: 'Ver fichas', description: 'Buscá por apellido, nombre, DNI o legajo y consultá los datos y el historial anual de licencias.', enabled: permisos.ficha, permission: 'Requiere permiso de lectura de fichas.' },
        ].map(({ href, title, description, enabled, permission }) => (
          <div key={href} className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">{description}</p>
            {enabled ? <Link href={href} className="mt-6 inline-flex min-h-11 w-fit items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400">{title} →</Link> : <p className="mt-6 text-sm text-amber-200">{permisos.error ? 'Permiso pendiente de verificación.' : permission}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
