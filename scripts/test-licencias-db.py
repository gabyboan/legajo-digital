"""Ejecuta la migración real y regresiones en un PostgreSQL temporal local."""
import os
import argparse
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', type=Path, help='Directorio de binarios de PostgreSQL para la prueba temporal')
    args = parser.parse_args()
    candidates = sorted(Path(os.environ.get('ProgramFiles', '/nonexistent')).glob('PostgreSQL/*/bin/initdb.exe'))
    initdb = shutil.which('initdb')
    pg_bin = args.pg_bin or (Path(initdb).parent if initdb else candidates[-1].parent if candidates else None)
    if pg_bin is None:
        raise RuntimeError('Se necesitan los binarios de PostgreSQL. No se usa una base existente.')
    runtime = (ROOT / '.runtime/licencias-db').resolve()
    runtime.mkdir(parents=True, exist_ok=True)
    task = Path(tempfile.mkdtemp(prefix='pg-', dir=runtime)).resolve()
    data = task / 'data'
    suffix = '.exe' if os.name == 'nt' else ''
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    env['PGCLIENTENCODING'] = 'UTF8'
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    started = finished = False

    def run(tool, *args):
        with (task / f'{tool}.log').open('ab') as output:
            result = subprocess.run([str(pg_bin / (tool + suffix)), *map(str, args)], cwd=task, env=env,
                                    stdout=output, stderr=subprocess.STDOUT, timeout=45,
                                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode:
            raise RuntimeError((task / f'{tool}.log').read_text(encoding='utf-8', errors='replace')[-5000:])

    try:
        run('initdb', '-D', data, '-U', 'licencias_test', '-A', 'trust', '--encoding=UTF8', '--locale=C')
        run('pg_ctl', '-D', data, '-l', task / 'server.log', '-o', f'-h 127.0.0.1 -p {port} -c unix_socket_directories=', '-w', '-t', '15', 'start')
        started = True
        run('psql', '-X', '-h', '127.0.0.1', '-p', port, '-U', 'licencias_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', ROOT / 'scripts/fixtures/licencias-administracion.sql')
        finished = True
        print('Licencias SQL: migración real, permisos, sesión, autores, fechas, paginación, edición, versiones y borrado con historial: OK')
    finally:
        if started:
            run('pg_ctl', '-D', data, '-w', '-t', '15', '-m', 'fast', 'stop')
        assert task.parent == runtime and task.name.startswith('pg-')
        if finished:
            shutil.rmtree(task)


if __name__ == '__main__':
    main()
