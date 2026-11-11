"""Actual session endpoint, expiry route and save action with synthetic Auth."""
from playwright.sync_api import sync_playwright, expect
from ui_preview import preview_server

CLIENT = '''import { cookies } from 'next/headers'
export async function createClient() {
  const jar = await cookies()
  return {
    auth: {
      async getUser() {
        if (jar.has('preview-offline')) return {data:{user:null},error:{status:503,name:'AuthRetryableFetchError'}}
        return {data:{user:jar.has('preview-logout') ? null : {id:'synthetic-user',email:'demo@example.invalid',factors:[]}},error:null}
      },
      async signOut({scope}:{scope:string}) {
        if (scope !== 'local') throw new Error('Do not close other computers')
        jar.set('preview-logout','1'); return {error:null}
      },
      mfa: {async getAuthenticatorAssuranceLevel() {return {data:{currentLevel:'aal1',nextLevel:'aal1'},error:null}}},
    },
    async rpc(name:string) {
      if (name !== 'verificar_mfa_opcional') throw new Error('No business reads or writes are allowed in this preview')
      return {data:null,error:Number(jar.get('preview-minutes')?.value || '0') >= 60 ? {code:'PT401',message:'La sesión llegó a su límite de tiempo.'} : null}
    },
  }
}
'''

FORM = ''''use client'
import { useActionState } from 'react'
import { SessionGuard } from '@/app/(private)/components/session-guard'
import { updatePersonaConEstado } from '@/app/(private)/personas/actions'
export default function Form() {
  const [state,action,pending] = useActionState(updatePersonaConEstado,{status:'idle' as const})
  return <main><SessionGuard /><h1>Ficha de prueba</h1><form action={action}>
    <input type="hidden" name="dni" value="12345678" />
    <label>Observación<input name="observacion" defaultValue="Borrador sintético" /></label>
    <button disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</button>
    {state.status === 'error' ? <p role="alert">{state.message}</p> : null}
  </form></main>
}
'''


def main():
    files = {
        'test-client.ts': CLIENT,
        'app/personas/12345678/editar/page.tsx': FORM,
        'app/api/auth/session/route.ts': "export {GET} from '@/app/api/auth/session/route'",
        'app/auth/expired/route.ts': "export {GET} from '@/app/auth/expired/route'",
        'app/login/page.tsx': "export {default} from '@/app/login/page'",
    }
    with preview_server('session-qa', 'export default function Home() { return <main>Prueba de sesiones</main> }', 3119,
                        extra_files=files, aliases={'@/utils/supabase/server': ['./test-client.ts']}) as (origin, artifacts):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context()
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                destination = origin + '/personas/12345678/editar'

                def cookie(name, value):
                    context.add_cookies([{'name': name, 'value': value, 'url': origin}])

                cookie('preview-minutes', '59')
                page.goto(destination, wait_until='networkidle')
                expect(page.get_by_role('heading', name='Ficha de prueba')).to_be_visible()
                assert context.request.get(origin + '/api/auth/session').status == 200
                expect(page).to_have_url(destination)

                # A temporary network error must leave the form and draft open.
                cookie('preview-offline', '1')
                with page.expect_response(lambda response: '/api/auth/session?' in response.url and response.status == 503):
                    page.evaluate("window.dispatchEvent(new Event('focus'))")
                expect(page).to_have_url(destination)
                expect(page.get_by_label('Observación')).to_have_value('Borrador sintético')
                context.clear_cookies(name='preview-offline')

                # No click or navigation: the open screen detects the database expiry.
                cookie('preview-minutes', '60')
                page.evaluate("window.dispatchEvent(new Event('focus'))")
                expect(page).to_have_url(__import__('re').compile(r'/login\?next=.*expired=1'), timeout=30000)
                expect(page.get_by_role('status')).to_contain_text('Tu sesión venció')
                expect(page.get_by_role('button', name='Ingresar', exact=True)).to_be_visible()
                page.screenshot(path=str(artifacts / 'sesion-vencida.png'), full_page=True)

                # Expiring between rendering and submitting must redirect through
                # the real Server Action, before permissions or any data write.
                context.clear_cookies()
                page.goto(destination, wait_until='networkidle')
                cookie('preview-minutes', '60')
                page.get_by_role('button', name='Guardar cambios').click()
                expect(page).to_have_url(__import__('re').compile(r'/login\?next=.*expired=1'), timeout=30000)
                expect(page.get_by_role('status')).to_contain_text('Tu sesión venció')
                expect(page.get_by_role('button', name='Guardando…')).to_have_count(0)
                assert not errors, errors
                print('Sesión en navegador: minuto 59 activo, falla de red, vencimiento automático, guardado vencido y login sin bucle: OK')
            finally:
                browser.close()


if __name__ == '__main__':
    main()
