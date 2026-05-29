import { ModulePlaceholder } from '../module-placeholder'

export default function SituacionPage({
  params,
}: {
  params: Promise<{ dni: string }>
}) {
  return <ModulePlaceholder params={params} title="Situacion de revista" />
}
