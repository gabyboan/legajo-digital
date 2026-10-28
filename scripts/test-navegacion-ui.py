"""Exercise the real navigation in an isolated local preview with synthetic content.

Requires Python Playwright and Chromium. Never connects to Supabase or starts
the application on its usual port. Preview files are removed after the test.
"""
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / '.runtime' / 'navigation'
PREVIEW = ARTIFACTS / 'preview'
ORIGIN = 'http://127.0.0.1:3109'


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def remove_preview():
    # Windows marks some Turbopack cache files read-only.
    assert PREVIEW.resolve() == ROOT / '.runtime' / 'navigation' / 'preview'

    def remove_readonly(function, filename, error):
        assert Path(filename).resolve().is_relative_to(PREVIEW.resolve())
        if not isinstance(error, PermissionError):
            raise error
        os.chmod(filename, stat.S_IWRITE | stat.S_IREAD)
        function(filename)

    if PREVIEW.exists():
        shutil.rmtree(PREVIEW, onexc=remove_readonly)


def main():
    if PREVIEW.exists():
        raise RuntimeError('La carpeta de preview ya existe; no se reemplaza automáticamente.')
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    process = None
    try:
        package = json.loads((ROOT / 'package.json').read_text())
        write(PREVIEW / 'package.json', json.dumps({
            'name': 'legajo-navigation-preview', 'private': True,
            'dependencies': {name: package['dependencies'][name] for name in ['next', 'react', 'react-dom']},
        }))
        write(PREVIEW / 'next.config.mjs', 'export default ' + json.dumps({
            'turbopack': {'root': ROOT.as_posix()},
            'experimental': {'turbopackFileSystemCacheForDev': False},
        }))
        shutil.copy2(ROOT / 'postcss.config.mjs', PREVIEW / 'postcss.config.mjs')
        app = PREVIEW / 'app'
        css = Path(os.path.relpath(ROOT / 'app/globals.css', app)).as_posix()
        components = Path(os.path.relpath(ROOT / 'app/(private)/components', app)).as_posix()
        write(app / 'globals.css', f'@import "{css}";\n@source "{components}";\n@source "./";\n')
        write(app / 'layout.tsx', '''import './globals.css'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>
}
''')
        route = app / '[[...route]]'
        shell = Path(os.path.relpath(ROOT / 'app/(private)/components/private-shell', route)).as_posix()
        write(route / 'page.tsx', f'''import {{ PrivateShell }} from '{shell}'
export default function Preview() {{
  return <PrivateShell account={{<div className="mt-6 break-all rounded-xl border border-zinc-700 p-4">persona@example.invalid</div>}}>
    <section className="space-y-6"><h1 className="text-2xl font-bold">Personas</h1>
      <p className="text-zinc-400">Vista de prueba con contenido ficticio.</p>
      <div role="region" aria-label="Tabla de demostración" tabIndex={{0}} className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-[920px] text-sm"><thead><tr>{{['DNI','Apellido','Nombre','Carrera','Estado','Acción'].map((label) => <th key={{label}} className="p-4 text-left">{{label}}</th>)}}</tr></thead>
          <tbody><tr>{{['12345678','Persona','Ficticia','Carrera de demostración','Activo','Ver ficha'].map((value) => <td key={{value}} className="p-4">{{value}}</td>)}}</tr></tbody>
        </table>
      </div>
    </section>
  </PrivateShell>
}}
''')
        env = dict(os.environ, NEXT_TELEMETRY_DISABLED='1')
        with (ARTIFACTS / 'preview.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(
                ['node', str(ROOT / 'node_modules/next/dist/bin/next'), 'dev', str(PREVIEW), '--hostname', '127.0.0.1', '--port', '3109'],
                cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                start_new_session=os.name != 'nt',
            )
            deadline = time.monotonic() + 60
            while True:
                if process.poll() is not None:
                    raise RuntimeError('No se inició el preview; revisar .runtime/navigation/preview.log')
                if 'Ready' not in (ARTIFACTS / 'preview.log').read_text(encoding='utf-8'):
                    if time.monotonic() > deadline:
                        raise TimeoutError('El preview no inició en 60 segundos.')
                    time.sleep(0.25)
                    continue
                try:
                    with urllib.request.urlopen(ORIGIN + '/personas', timeout=2) as response:
                        if response.status == 200:
                            break
                except (urllib.error.URLError, TimeoutError):
                    pass
                if time.monotonic() > deadline:
                    raise TimeoutError('El preview no inició en 60 segundos.')
                time.sleep(0.25)

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                try:
                    page = browser.new_page(viewport={'width': 390, 'height': 844})
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(ORIGIN + '/personas', wait_until='networkidle')
                    nav = page.get_by_role('navigation', name='Navegación principal')
                    expect(nav).to_be_hidden()
                    page.keyboard.press('Tab')
                    expect(page.get_by_role('link', name='Saltar al contenido')).to_be_focused()
                    page.keyboard.press('Enter')
                    expect(page.locator('#contenido-principal')).to_be_focused()
                    page.screenshot(path=str(ARTIFACTS / 'mobile.png'), full_page=True)

                    page.get_by_role('button', name='Abrir menú de navegación').click()
                    expect(nav).to_be_visible()
                    expect(nav.locator('[aria-current="page"]')).to_have_count(1)
                    expect(nav.get_by_role('link', name='Personas', exact=True)).to_have_attribute('aria-current', 'page')
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    page.screenshot(path=str(ARTIFACTS / 'mobile-menu.png'), full_page=True)
                    nav.get_by_role('link', name='Validación de familiares', exact=True).click()
                    expect(page).to_have_url(ORIGIN + '/personas/validacion-dni/familiares')
                    expect(nav).to_be_hidden()
                    page.get_by_role('button', name='Abrir menú de navegación').click()
                    expect(nav.locator('[aria-current="page"]')).to_have_count(1)
                    expect(nav.get_by_role('link', name='Validación de familiares', exact=True)).to_have_attribute('aria-current', 'page')
                    nav.get_by_role('link', name='Agenda', exact=True).focus()
                    page.keyboard.press('Escape')
                    expect(nav).to_be_hidden()
                    expect(page.get_by_role('button', name='Abrir menú de navegación')).to_be_focused()

                    page.get_by_role('button', name='Abrir menú de navegación').click()
                    page.evaluate("history.pushState(null, '', '/agenda')")
                    expect(nav).to_be_hidden()
                    page.go_back()
                    expect(nav).to_be_hidden()

                    for width in [320, 375, 390, 768, 1280]:
                        page.set_viewport_size({'width': width, 'height': 900})
                        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Desborde a {width}px'
                        table = page.get_by_role('region', name='Tabla de demostración')
                        if width < 1280:
                            assert table.evaluate('(element) => element.scrollWidth > element.clientWidth')
                        if width >= 768:
                            expect(nav).to_be_visible()
                            expect(page.get_by_role('button', name='Abrir menú de navegación')).to_be_hidden()
                    page.goto(ORIGIN + '/personas', wait_until='networkidle')
                    expect(nav.get_by_role('link', name='Personas', exact=True)).to_have_attribute('aria-current', 'page')
                    page.screenshot(path=str(ARTIFACTS / 'desktop.png'), full_page=True)
                    assert not errors, errors
                    print('Navegación: móvil/escritorio, sección anidada activa, Escape/foco, saltar al contenido, navegación y sin desbordes entre 320 y 1280px: OK')
                finally:
                    browser.close()
    finally:
        if process is not None and process.poll() is None:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=10)
        remove_preview()


if __name__ == '__main__':
    main()
