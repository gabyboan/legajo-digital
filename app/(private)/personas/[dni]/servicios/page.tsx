import { ModulePlaceholder } from '../module-placeholder'

export default function ServiciosPage({
  params,
}: {
  params: Promise<{ dni: string }>
}) {
  return <ModulePlaceholder params={params} title="Servicios" />
}
