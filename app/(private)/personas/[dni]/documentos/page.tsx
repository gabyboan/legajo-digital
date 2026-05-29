import { ModulePlaceholder } from '../module-placeholder'

export default function DocumentosPage({
  params,
}: {
  params: Promise<{ dni: string }>
}) {
  return <ModulePlaceholder params={params} title="Documentos" />
}
