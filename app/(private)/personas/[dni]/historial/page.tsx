import { ModulePlaceholder } from '../module-placeholder'

export default function HistorialPage({
  params,
}: {
  params: Promise<{ dni: string }>
}) {
  return <ModulePlaceholder params={params} title="Historial" />
}
