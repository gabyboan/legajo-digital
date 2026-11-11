import { ModuleSelection } from '../components/module-selection'

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inicio</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Seleccioná el módulo en el que querés trabajar.
        </p>
      </div>

      <ModuleSelection />
    </section>
  )
}
