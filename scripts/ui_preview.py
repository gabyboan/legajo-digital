"""Isolated Next.js preview for browser tests, with no production routes or data."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


@contextmanager
def preview_server(name, source, port, *, extra_files=None, aliases=None):
    if not re.fullmatch('[a-z0-9-]+', name):
        raise ValueError('Invalid preview name')
    artifacts = ROOT / '.runtime' / name
    preview = artifacts / 'preview'
    if preview.exists():
        raise RuntimeError(f'El preview ya existe: {preview}')
    artifacts.mkdir(parents=True, exist_ok=True)
    process = None

    def write(path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')

    try:
        package = json.loads((ROOT / 'package.json').read_text())
        write(preview / 'package.json', json.dumps({
            'name': f'legajo-{name}-preview', 'private': True,
            'dependencies': {key: package['dependencies'][key] for key in ['next','react','react-dom']},
        }))
        write(preview / 'next.config.mjs', 'export default ' + json.dumps({
            'turbopack': {'root': ROOT.as_posix()},
            'experimental': {'turbopackFileSystemCacheForDev': False},
        }))
        write(preview / 'tsconfig.json', json.dumps({'compilerOptions': {
            'target':'ES2017', 'lib':['dom','esnext'], 'strict':True,
            'skipLibCheck':True, 'esModuleInterop':True, 'module':'esnext',
            'moduleResolution':'bundler', 'jsx':'react-jsx', 'allowJs':True,
            'baseUrl':'.', 'paths':{'@/*':[Path(os.path.relpath(ROOT,preview)).as_posix()+'/*'], **(aliases or {})},
        }}))
        shutil.copy2(ROOT / 'postcss.config.mjs', preview / 'postcss.config.mjs')
        app = preview / 'app'
        css = Path(os.path.relpath(ROOT / 'app/globals.css', app)).as_posix()
        sources = Path(os.path.relpath(ROOT / 'app', app)).as_posix()
        write(app / 'globals.css', f'@import "{css}";\n@source "{sources}";\n@source "./";\n')
        write(app / 'layout.tsx', "import './globals.css'\nexport default function Layout({ children }: { children: React.ReactNode }) { return <html lang=\"es\"><body className=\"bg-zinc-950 text-white\">{children}</body></html> }")
        write(app / 'page.tsx', source)
        for filename, content in (extra_files or {}).items():
            target = (preview / filename).resolve()
            if not target.is_relative_to(preview.resolve()):
                raise ValueError('Preview file is outside its directory')
            write(target, content)
        origin = f'http://127.0.0.1:{port}'
        with (artifacts / 'preview.log').open('w',encoding='utf-8') as log:
            process = subprocess.Popen(
                ['node', str(ROOT / 'node_modules/next/dist/bin/next'), 'dev', str(preview), '--hostname','127.0.0.1','--port',str(port)],
                cwd=ROOT, env=dict(os.environ, NEXT_TELEMETRY_DISABLED='1'),
                stdout=log, stderr=subprocess.STDOUT,
                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0), start_new_session=os.name!='nt',
            )
            deadline=time.monotonic()+60
            while True:
                if process.poll() is not None:
                    raise RuntimeError(f'No se inició el preview; revisar {artifacts / "preview.log"}')
                if time.monotonic()>deadline:
                    raise TimeoutError('El preview no inició en 60 segundos.')
                if 'Ready' in (artifacts/'preview.log').read_text(encoding='utf-8'):
                    try:
                        with urllib.request.urlopen(origin,timeout=2) as response:
                            if response.status==200:
                                break
                    except urllib.error.HTTPError as error:
                        raise RuntimeError(f'El preview respondió {error.code}; revisar {artifacts / "preview.log"}') from error
                    except (urllib.error.URLError,TimeoutError):
                        pass
                time.sleep(0.25)
            yield origin, artifacts
    finally:
        if process is not None and process.poll() is None:
            if os.name=='nt':
                subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            else:
                os.killpg(process.pid,signal.SIGTERM)
            process.wait(timeout=10)
        assert preview.resolve()==ROOT/'.runtime'/name/'preview'

        def remove_readonly(function, filename, error):
            assert Path(filename).resolve().is_relative_to(preview.resolve())
            if not isinstance(error,PermissionError):
                raise error
            os.chmod(filename,stat.S_IWRITE|stat.S_IREAD)
            function(filename)

        if preview.exists():
            shutil.rmtree(preview,onexc=remove_readonly)
