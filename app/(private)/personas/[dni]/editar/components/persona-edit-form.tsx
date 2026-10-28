import { updatePersonaConEstado } from '../../../actions'
import { PersonaForm } from '../../../components/persona-form'
import type { PersonaEditFormProps } from '@/lib/personas/types'

export function PersonaEditForm(props: PersonaEditFormProps) {
  return <PersonaForm key={props.persona.dni} {...props} action={updatePersonaConEstado} />
}
