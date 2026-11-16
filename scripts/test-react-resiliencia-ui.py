"""Exercise actual Next loading/error boundaries with synthetic, read-only pages."""
from playwright.sync_api import sync_playwright, expect
from ui_preview import preview_server

SOURCE = '''import Link from 'next/link'
export default function Page(){return <main><h1>Prueba de recuperación</h1><Link href="/resumen">Abrir resumen</Link><Link href="/fallo">Abrir vista</Link></main>}
'''


def main():
    expect.set_options(timeout=15000)
    files = {
        'app/error.tsx': "'use client'\nexport { ErrorPantalla as default } from '@/app/components/error-pantalla'\n",
        'app/loading.tsx': "export { default } from '@/app/(private)/loading'\n",
        'app/resumen/page.tsx': '''export default async function Page(){await new Promise(r=>setTimeout(r,1200));return <h1>Resumen cargado</h1>}''',
        'app/fallo/page.tsx': '''import {cookies} from 'next/headers'
export default async function Page(){if((await cookies()).get('demo-fail')?.value==='1')throw new Error('SYNTHETIC_INTERNAL_DETAIL');return <h1>Vista recuperada</h1>}''',
    }
    with preview_server('react-resiliencia', SOURCE, 3116, extra_files=files) as (origin, artifacts):
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page()
                page.goto(origin, wait_until='networkidle')
                page.get_by_role('link', name='Abrir resumen', exact=True).click()
                expect(page.get_by_role('status', name='Cargando página')).to_be_visible()
                expect(page.get_by_role('heading', name='Resumen cargado')).to_be_visible()
                page.context.add_cookies([{'name':'demo-fail','value':'1','url':origin}])
                page.goto(origin+'/fallo', wait_until='networkidle')
                alert = page.get_by_role('alert').filter(has_text='No se pudo cargar esta página')
                expect(alert).to_be_visible()
                assert 'SYNTHETIC_INTERNAL_DETAIL' not in alert.inner_text()
                page.context.add_cookies([{'name':'demo-fail','value':'0','url':origin}])
                # Dev's error overlay is independent of the application's boundary.
                page.add_style_tag(content='nextjs-portal { display:none !important }')
                alert.get_by_role('button', name='Volver a cargar').click()
                expect(page.get_by_role('heading', name='Vista recuperada')).to_be_visible()
                expect(alert).to_have_count(0)
                page.screenshot(path=str(artifacts/'vista-recuperada.png'))
                print('React UI: navegación con estado de carga, error sin detalles internos y recuperación con lectura nueva: OK')
            finally:
                browser.close()


if __name__ == '__main__':
    main()
