"""Real MFA page and action, with a synthetic Auth client isolated from Supabase."""
from playwright.sync_api import sync_playwright, expect
from ui_preview import preview_server

CLIENT = '''import { cookies } from 'next/headers'
const user = { id: 'synthetic-user', factors: [{ id:'demo-factor-1', factor_type:'totp', status:'verified' }, { id:'demo-factor-2', factor_type:'totp', status:'verified' }] }
export async function createClient() {
  const jar = await cookies()
  return { auth: {
    async getUser() { return { data: { user: jar.has('preview-logout') ? null : user }, error: null } },
    async signOut() { jar.set('preview-logout','1'); jar.delete('preview-aal'); return {error:null} },
    async signInWithPassword() { jar.delete('preview-logout'); return { data: {user}, error:null } },
    mfa: {
      async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: jar.get('preview-aal')?.value || 'aal1', nextLevel:'aal2' }, error:null } },
      async listFactors() { return { data: {totp: user.factors.map((factor,index) => ({ ...factor, friendly_name: 'Autenticador de prueba '+(index+1) }))}, error:null } },
      async challengeAndVerify({code}:{code:string}) {
        await new Promise((resolve) => setTimeout(resolve,500))
        if (code !== '000123') return {data:null,error:{code:code==='222222'?'over_request_rate_limit':'mfa_verification_failed'}}
        jar.set('preview-aal','aal2'); return {data:{user},error:null}
      },
    },
  } }
}
'''


def main():
    files = {
        'test-client.ts': CLIENT,
        'app/auth/mfa/page.tsx': "export {default} from '@/app/auth/mfa/page'",
        'app/login/page.tsx': "export {default} from '@/app/login/page'",
        'app/personas/page.tsx': '''import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
export default async function Personas() {
  if ((await cookies()).get('preview-aal')?.value !== 'aal2') redirect('/auth/mfa?next=%2Fpersonas')
  return <main><h1>Personas de prueba: acceso verificado</h1></main>
}''',
    }
    with preview_server('mfa', "export {default} from '@/app/auth/mfa/page'", 3113,
                        extra_files=files, aliases={'@/utils/supabase/server':['./test-client.ts']}) as (origin, artifacts):
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page(viewport={'width':390,'height':844})
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(origin+'/auth/mfa?next=%2Fpersonas%3Fq%3D12345678', wait_until='networkidle')
                expect(page.get_by_role('heading',name='Verificá tu acceso')).to_be_visible()
                code = page.get_by_label('Código de 6 dígitos',exact=True)
                expect(code).to_have_attribute('autocomplete','one-time-code')
                page.get_by_label('Aplicación autenticadora',exact=True).select_option('demo-factor-2')
                code.fill('111111')
                page.get_by_role('button',name='Verificar y continuar').click()
                expect(page.get_by_role('button',name='Verificando…')).to_be_disabled()
                alert = page.get_by_role('alert',name='Error de verificación')
                expect(alert).to_contain_text('incorrecto o venció')
                expect(code).to_be_focused()
                expect(code).to_have_value('')
                expect(page.get_by_label('Aplicación autenticadora',exact=True)).to_have_value('demo-factor-2')
                expect(page.get_by_role('heading',name='Personas de prueba: acceso verificado')).to_have_count(0)
                code.fill('222222')
                page.get_by_role('button',name='Verificar y continuar').click()
                expect(alert).to_contain_text('demasiados intentos')
                page.screenshot(path=str(artifacts/'verificacion.png'), full_page=True)
                for width in [320,390,768,1280]:
                    page.set_viewport_size({'width':width,'height':900})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
                code.fill('000123')
                page.get_by_role('button',name='Verificar y continuar').click()
                expect(page).to_have_url(origin+'/personas?q=12345678')
                expect(page.get_by_role('heading',name='Personas de prueba: acceso verificado')).to_be_visible()
                page.reload(wait_until='networkidle')
                expect(page.get_by_role('heading',name='Personas de prueba: acceso verificado')).to_be_visible()
                page.goto(origin+'/auth/mfa?next=%2Fpersonas',wait_until='networkidle')
                expect(page).to_have_url(origin+'/personas')
                browser_context = page.context
                browser_context.clear_cookies()
                page.goto(origin+'/auth/mfa',wait_until='networkidle')
                page.get_by_role('button',name='Cerrar sesión').click()
                expect(page).to_have_url(origin+'/login')
                expect(page.get_by_role('button',name='Ingresar',exact=True)).to_be_visible()
                assert not errors,errors
                print('MFA en navegador: error y foco, carga, varios factores, reintento, retorno con filtros, sesión persistida y cierre: OK')
            finally:
                browser.close()


if __name__ == '__main__':
    main()
