"""Búsqueda de Personas compartida con Cargar licencias, sin datos operativos."""
from playwright.sync_api import sync_playwright, expect
from ui_preview import preview_server

SOURCE = '''import { PersonasPanel } from '@/app/(private)/personas/personas-panel'
const personas = [
 {dni:12345678,apellido:'ÁLVAREZ',nombre:'ANA',legajo:10,activo:true,carreras:[{id:1,nombre:'Enfermería'},{id:2,nombre:'Administración'}]},
 {dni:87654321,apellido:'BENÍTEZ',nombre:'BRUNO',legajo:20,activo:false,carreras:[{id:2,nombre:'Administración'}]},
]
export default function Page(){return <main className="p-5"><h1>Personas</h1><PersonasPanel personas={personas} carreras={[{id:1,nombre:'Enfermería'},{id:2,nombre:'Administración'}]} q="" carrera="" estado="todos" /></main>}
'''


def main():
    expect.set_options(timeout=15000)
    extra = {'app/personas/page.tsx': SOURCE,
             'app/personas/[dni]/page.tsx': '''export default async function Page({params}:{params:Promise<{dni:string}>}){const {dni}=await params;return <h1>Legajo {dni}</h1>}'''}
    with preview_server('personas-busqueda', SOURCE, 3113, extra_files=extra) as (origin, artifacts):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                page = browser.new_page(viewport={'width': 1440, 'height': 1000})
                errors, documents = [], []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('request', lambda request: documents.append(request.url) if request.resource_type == 'document' else None)
                page.goto(origin + '/personas', wait_until='networkidle')
                initial = len(documents)
                field = page.get_by_label('Buscar agente', exact=True)
                ana = page.get_by_role('row').filter(has_text='ÁLVAREZ ANA')
                bruno = page.get_by_role('row').filter(has_text='BENÍTEZ BRUNO')
                for query in ['ana alvarez', 'alvarez 10', '12.345.678', '3456', '10']:
                    field.fill(query)
                    expect(ana).to_be_visible()
                    expect(bruno).to_have_count(0)
                    expect(field).to_be_focused()
                page.get_by_role('button', name='Limpiar', exact=True).click()
                expect(ana).to_be_visible()
                expect(bruno).to_be_visible()
                page.get_by_label('Carrera', exact=True).select_option('2')
                expect(ana).to_be_visible()  # También coincide la segunda carrera.
                page.get_by_label('Estado', exact=True).select_option('inactivos')
                expect(ana).to_have_count(0)
                expect(bruno).to_be_visible()
                expect(page.get_by_role('link', name='Exportar XLSX', exact=True)).to_have_attribute('href', '/api/personas/exportar?carrera=2&estado=inactivos')
                page.get_by_label('Estado', exact=True).select_option('todos')
                field.fill('nadie')
                expect(page.get_by_text('No se encontraron personas. Probá con otro nombre, DNI o legajo.', exact=True)).to_be_visible()
                field.fill('bruno')
                field.press('ArrowDown')
                expect(bruno).to_be_focused()
                bruno.press('ArrowUp')
                expect(field).to_be_focused()
                assert len(documents) == initial, 'Buscar y filtrar no debe recargar la página'
                for width in [320, 390, 768, 1440]:
                    page.set_viewport_size({'width': width, 'height': 1000})
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), f'Desborde a {width}'
                page.screenshot(path=str(artifacts / 'busqueda-personas.png'), full_page=True)
                field.press('ArrowDown')
                bruno.press('Enter')
                expect(page.get_by_role('heading', name='Legajo 87654321', exact=True)).to_be_visible()
                assert len(documents) == initial, 'Abrir la ficha debe mantener la navegación interna'
                assert not errors, errors
                print('Personas UI: búsqueda al escribir, acentos, palabras combinadas, DNI parcial/formateado, legajo, carreras, estados, exportación, teclado y móvil: OK')
            finally:
                browser.close()


if __name__ == '__main__':
    main()
