import { ModulePlaceholder } from '../module-placeholder'

export default function CarrerasPage({
  params,
}: {
  params: Promise<{ dni: string }>
}) {
  return <ModulePlaceholder params={params} title="Carreras" />
}
