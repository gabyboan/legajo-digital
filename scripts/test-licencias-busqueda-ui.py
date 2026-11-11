"""Live agent search and selection with synthetic data; no real Auth or database."""
import json
import unicodedata
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright, expect, Error as PlaywrightError
from ui_preview import preview_server


AGENTES = [
    {"dni": 12345678, "apellido_nombre": "ÁLVAREZ ANA", "legajo": 10, "carrera": "Enfermería", "situacion_revista": "", "funcion": "", "activo": True},
    {"dni": 87654321, "apellido_nombre": "BENÍTEZ BRUNO", "legajo": 20, "carrera": "Administración", "situacion_revista": "", "funcion": "", "activo": True},
]
TIPOS = [{"id": 104, "nombre": "Licencia anual ordinaria", "codigo": "01", "columna_ficha": "ANUAL", "descripcion": "Descanso anual", "habilitado_para_carga": True}]
FIXTURE = """import { PrivateShell } from '@/app/(private)/components/private-shell'
import { CargarLicenciasPanel } from '@/app/(private)/licencias/cargar/cargar-licencias-panel'
const agentes = __AGENTES__
const tipos = __TIPOS__
export default async function Demo({ searchParams }: { searchParams: Promise<{ dni?: string }> }) {
  const params = await searchParams
  const initialPersona = agentes.find((persona) => String(persona.dni) === params.dni) ?? null
  return <PrivateShell account={<p className="mt-6 text-sm">Prueba con datos ficticios</p>}>
    <section className="space-y-6"><h1 className="text-2xl font-bold">Cargar licencias</h1>
      <CargarLicenciasPanel initialPersona={initialPersona} personas={agentes} q="" tipos={tipos} hoy="2026-11-10" puedeVerFicha={__PERMISO__} />
    </section>
  </PrivateShell>
}
""".replace("__AGENTES__", json.dumps(AGENTES, ensure_ascii=False)).replace("__TIPOS__", json.dumps(TIPOS, ensure_ascii=False))
FICHAS = """import { PersonasSelector } from '@/app/(private)/licencias/components/personas-selector'
export default function Demo() { return <main className="p-5"><h1>Ver fichas</h1><PersonasSelector personas={__AGENTES__} q="" ficha /></main> }
""".replace("__AGENTES__", json.dumps(AGENTES, ensure_ascii=False))


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFD', value) if not unicodedata.combining(c)).lower()


def main():
    source = FIXTURE.replace('__PERMISO__', 'true')
    extra = {
        'app/licencias/cargar/page.tsx': source,
        'app/licencias/fichas/page.tsx': FICHAS,
        'app/licencias/fichas/[dni]/page.tsx': '''export default async function Demo({ params }: { params: Promise<{ dni: string }> }) {
  const { dni } = await params
  return <main><h1>Ficha del agente {dni}</h1></main>
}''',
        'app/sin-permiso-ficha/page.tsx': FIXTURE.replace('__PERMISO__', 'false'),
    }
    with preview_server('licencias-busqueda', source, 3111, extra_files=extra) as (origin, artifacts):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                page = browser.new_page(viewport={'width': 1440, 'height': 1000})
                errors, documents, calls = [], [], []
                state = {'held': None, 'fail': True}
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('request', lambda request: documents.append(request.url) if request.resource_type == 'document' else None)

                def search(route):
                    params = parse_qs(urlparse(route.request.url).query)
                    q = params.get('q', [''])[0]
                    calls.append({'q': q, 'contexto': params.get('contexto', [''])[0]})
                    if q == 'vieja':
                        state['held'] = route
                        return
                    if q == 'error' and state['fail']:
                        route.fulfill(status=503, json={'error': 'Búsqueda temporalmente no disponible.'})
                        return
                    terms = normalized(q).split()
                    rows = [persona for persona in AGENTES if all(term in normalized(f"{persona['apellido_nombre']} {persona['dni']} {persona['legajo']}") for term in terms)]
                    route.fulfill(json={'personas': AGENTES if q == 'error' else rows})

                page.route('**/api/licencias/personas?*', search)
                page.goto(origin + '/licencias/cargar', wait_until='networkidle')
                page.evaluate("window.marcaBusqueda = 'mismo-documento'")
                initial_documents = len(documents)
                field = page.get_by_label('Buscar agente', exact=True)
                # No search-button click: every typed prefix changes the results.
                field.fill('b')
                expect(page.get_by_role('button', name='Seleccionar a BENÍTEZ BRUNO', exact=True)).to_be_visible()
                expect(page.get_by_role('button', name='Seleccionar a ÁLVAREZ ANA', exact=True)).to_have_count(0)
                field.type('runo', delay=230)
                expect(field).to_have_value('bruno')
                expect(field).to_be_focused()
                expect(page.get_by_role('button', name='Seleccionar a BENÍTEZ BRUNO', exact=True)).to_be_visible()
                bruno_row = page.get_by_role('row').filter(has_text='BENÍTEZ BRUNO')
                bruno_row.hover()
                assert bruno_row.evaluate("row => getComputedStyle(row).cursor") == 'pointer'
                bruno_row.get_by_text('BENÍTEZ BRUNO', exact=True).click()
                selected = page.locator('[data-agente-seleccionado]')
                expect(selected).to_have_attribute('data-agente-seleccionado', '87654321')
                expect(selected.get_by_role('link', name='Ver ficha de BENÍTEZ BRUNO', exact=True)).to_have_attribute('href', '/licencias/fichas/87654321')
                expect(page.locator('input[name="dni"]')).to_have_value('87654321')
                page.get_by_label('Tipo de licencia', exact=True).select_option('104')
                page.get_by_label('Observación (opcional)', exact=True).fill('Borrador de Bruno')
                page.get_by_role('button', name='Cambiar agente', exact=True).click()
                expect(field).to_be_focused()
                field.fill('alvarez')
                ana_row = page.get_by_role('row').filter(has_text='ÁLVAREZ ANA')
                expect(ana_row).to_be_visible()
                field.press('ArrowDown')
                expect(ana_row).to_be_focused()
                ana_row.press('Enter')
                expect(selected).to_have_attribute('data-agente-seleccionado', '12345678')
                expect(page.locator('input[name="dni"]')).to_have_value('12345678')
                expect(page.get_by_label('Observación (opcional)', exact=True)).to_have_value('')
                expect(page.get_by_label('Tipo de licencia', exact=True)).to_have_value('')
                expect(selected.get_by_role('link', name='Ver ficha de ÁLVAREZ ANA', exact=True)).to_have_attribute('href', '/licencias/fichas/12345678')
                assert page.evaluate("window.marcaBusqueda === 'mismo-documento'")
                assert len(documents) == initial_documents, documents
                page.screenshot(path=str(artifacts / 'agente-seleccionado.png'), full_page=True)
                page.get_by_role('button', name='Cancelar', exact=True).click()
                expect(selected).to_have_count(0)
                expect(field).to_be_focused()
                with page.expect_request('**/api/licencias/personas?*'):
                    field.fill('vieja')
                field.fill('bruno')
                expect(page.get_by_role('button', name='Seleccionar a BENÍTEZ BRUNO', exact=True)).to_be_visible()
                if state['held']:
                    try:
                        state['held'].fulfill(json={'personas': [AGENTES[0]]})
                    except PlaywrightError:
                        pass  # The browser already canceled the superseded request.
                expect(page.get_by_role('button', name='Seleccionar a ÁLVAREZ ANA', exact=True)).to_have_count(0)
                field.fill('error')
                expect(page.get_by_text('Búsqueda temporalmente no disponible.', exact=True)).to_be_visible()
                state['fail'] = False
                page.get_by_role('button', name='Reintentar búsqueda', exact=True).click()
                expect(page.get_by_role('button', name='Seleccionar a ÁLVAREZ ANA', exact=True)).to_be_visible()
                field.fill('no existe')
                expect(page.get_by_text('No se encontraron agentes. Probá con otro nombre o DNI.', exact=True)).to_be_visible()
                page.get_by_role('button', name='Limpiar', exact=True).click()
                expect(page.get_by_role('button', name='Seleccionar a BENÍTEZ BRUNO', exact=True)).to_be_visible()
                page.get_by_role('button', name='Seleccionar a BENÍTEZ BRUNO', exact=True).click()
                for width in [320, 390, 768, 1440]:
                    page.set_viewport_size({'width': width, 'height': 900})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Desborde a {width}px'
                assert page.evaluate("window.marcaBusqueda === 'mismo-documento'")
                assert len(documents) == initial_documents
                selected.get_by_role('link', name='Ver ficha de BENÍTEZ BRUNO', exact=True).click()
                expect(page.get_by_role('heading', name='Ficha del agente 87654321', exact=True)).to_be_visible()
                assert len(documents) == initial_documents, 'La ficha debe abrir con navegación interna'
                page.goto(origin + '/licencias/cargar?dni=12345678')
                expect(selected).to_have_attribute('data-agente-seleccionado', '12345678')
                expect(selected.get_by_role('link', name='Ver ficha de ÁLVAREZ ANA', exact=True)).to_be_visible()
                page.get_by_role('button', name='Cambiar agente', exact=True).click()
                expect(page.get_by_role('button', name='Seleccionar a BENÍTEZ BRUNO', exact=True)).to_be_visible()
                page.goto(origin + '/sin-permiso-ficha')
                expect(page.get_by_role('link', name='Ver ficha de ÁLVAREZ ANA', exact=True)).to_have_count(0)
                page.get_by_role('button', name='Seleccionar a ÁLVAREZ ANA', exact=True).click()
                expect(selected.get_by_role('link')).to_have_count(0)
                page.goto(origin + '/licencias/fichas')
                field.fill('bruno')
                expect(page.get_by_role('link', name='Ver ficha de BENÍTEZ BRUNO', exact=True)).to_be_visible()
                expect(page.get_by_role('link', name='Ver ficha de ÁLVAREZ ANA', exact=True)).to_have_count(0)
                assert calls[-1] == {'q': 'bruno', 'contexto': 'fichas'}
                ficha_documents = len(documents)
                bruno_row.get_by_role('cell', name='87654321', exact=True).click()
                expect(page.get_by_role('heading', name='Ficha del agente 87654321', exact=True)).to_be_visible()
                assert len(documents) == ficha_documents, 'La fila debe abrir la ficha sin recargar'
                page.goto(origin + '/licencias/fichas')
                field.press('ArrowDown')
                expect(ana_row).to_be_focused()
                ana_row.press('ArrowDown')
                expect(bruno_row).to_be_focused()
                bruno_row.press('ArrowUp')
                expect(ana_row).to_be_focused()
                ana_row.press('ArrowUp')
                expect(field).to_be_focused()
                field.press('ArrowDown')
                ana_row.press('Space')
                expect(page.get_by_role('heading', name='Ficha del agente 12345678', exact=True)).to_be_visible()
                page.goto(origin + '/licencias/cargar')
                ficha_documents = len(documents)
                # Nested ficha links keep their own action rather than selecting the row.
                page.get_by_role('link', name='Ver ficha de BENÍTEZ BRUNO', exact=True).press('Enter')
                expect(page.get_by_role('heading', name='Ficha del agente 87654321', exact=True)).to_be_visible()
                assert len(documents) == ficha_documents
                assert not errors, errors
                print('Licencias: clic en toda la fila, flechas y Enter/Espacio, búsqueda al escribir, selección sin recarga, formulario del agente correcto, ficha directa, cancelación, respuestas atrasadas, errores, permisos y móvil: OK')
            finally:
                browser.close()


if __name__ == '__main__':
    main()
