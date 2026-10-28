import { dniDesdeRegistro, formatearDni } from '@/lib/dni'
import { formatDate } from '../../format'
import type { Familiar } from '../editar/components/familiares-edit-form'

export function FamiliaresCard({ familiares }: { familiares: Familiar[] }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Familiares</h2>
      {familiares.length === 0 ? <p className="mt-4 text-sm text-zinc-400">No hay familiares cargados.</p> : (
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500"><tr><th>Apellido y nombre</th><th>DNI</th><th>Nacimiento</th><th>Parentesco</th><th>Estado</th></tr></thead>
          <tbody className="divide-y divide-zinc-800">{familiares.map((f) => <tr key={f.id}><td className="py-3">{f.apellido}, {f.nombre}</td><td>{formatearDni(dniDesdeRegistro(f.dni)) || '-'}</td><td>{formatDate(f.fecha_nacimiento)}</td><td>{f.parentesco}</td><td>{f.fallecido ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300">Fallecido</span> : '-'}</td></tr>)}</tbody>
        </table></div>
      )}
    </div>
  )
}
