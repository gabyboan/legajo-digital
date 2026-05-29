import { ModulePlaceholder } from '../module-placeholder'

export default function CargosPage({
  params,
}: {
  params: Promise<{ dni: string }>
}) {
  return <ModulePlaceholder params={params} title="Cargos" />
}
