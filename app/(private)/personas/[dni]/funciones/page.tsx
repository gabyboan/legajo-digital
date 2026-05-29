import { ModulePlaceholder } from '../module-placeholder'

export default function FuncionesPage({
  params,
}: {
  params: Promise<{ dni: string }>
}) {
  return <ModulePlaceholder params={params} title="Funciones" />
}
