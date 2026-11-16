import 'server-only'
import { revalidatePath } from 'next/cache'

// Identity, career and activity changes also appear in license searches/sheets.
// Call only after the database confirms the mutation (including partial saves).
export function revalidarPersona(dni: number) {
  revalidatePath('/personas')
  revalidatePath(`/personas/${dni}`)
  revalidatePath(`/personas/${dni}/editar`)
  revalidatePath('/licencias', 'layout')
}
