"""Prueba la migracion real en un PostgreSQL local temporal, sin Supabase ni datos reales."""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import sys
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'supabase/migrations/20261028110057_preservar_casa_domicilio.sql'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', type=Path, help='Directorio de initdb, pg_ctl y psql')
    args = parser.parse_args()
    pg_bin = args.pg_bin
    if pg_bin is None:
        initdb = shutil.which('initdb')
        candidates = sorted(Path(os.environ.get('ProgramFiles', '/nonexistent')).glob('PostgreSQL/*/bin/initdb.exe'))
        if initdb:
            pg_bin = Path(initdb).parent
        elif candidates:
            pg_bin = candidates[-1].parent
        else:
            parser.error('Instala PostgreSQL o indica --pg-bin. No se conecta a una base existente.')
    pg_bin = pg_bin.resolve()
    suffix = '.exe' if os.name == 'nt' else ''
    runtime = (ROOT / '.runtime/domicilio-rpc-test').resolve()
    runtime.mkdir(parents=True, exist_ok=True)
    task = Path(tempfile.mkdtemp(prefix='pg-', dir=runtime)).resolve()
    data = task / 'data'
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    env['PGCLIENTENCODING'] = 'UTF8'
    initialized = False
    finished = False

    def run(tool, *arguments, expect_success=True):
        with (task / f'{tool}.log').open('ab') as output:
            result = subprocess.run([str(pg_bin / (tool + suffix)), *map(str, arguments)],
                                    cwd=task, env=env, stdout=output, stderr=subprocess.STDOUT,
                                    timeout=30, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        if expect_success and result.returncode:
            print((task / f'{tool}.log').read_text(encoding='utf-8', errors='replace')[-6000:], file=sys.stderr)
            if tool == 'pg_ctl' and (task / 'server.log').exists():
                print((task / 'server.log').read_text(encoding='utf-8', errors='replace')[-6000:], file=sys.stderr)
            raise RuntimeError(f'{tool} fallo. Revisar {task / (tool + ".log")}')
        return result.returncode

    try:
        run('initdb', '-D', data, '-U', 'legajo_test', '-A', 'trust', '--encoding=UTF8', '--locale=C')
        initialized = True
        # TCP local alcanza para estas pruebas. Los paquetes Linux pueden usar un
        # directorio de sockets del sistema donde el usuario runner no tiene permisos.
        run('pg_ctl', '-D', data, '-l', task / 'server.log', '-o',
            f'-h 127.0.0.1 -p {port} -c unix_socket_directories=', '-w', '-t', '15', 'start')
        connection = ['-X', '-h', '127.0.0.1', '-p', str(port), '-U', 'legajo_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
        run('psql', *connection, '-f', ROOT / 'scripts/fixtures/domicilio-rpc-schema.sql',
            '-f', ROOT / 'scripts/fixtures/rpc-persona-guardar-anterior.sql')
        # CREATE OR REPLACE debe conservar los permisos existentes, no abrir PUBLIC.
        run('psql', *connection, '-c', """
            create role legajo_lector;
            revoke all on function public.rpc_persona_guardar(bigint,text,text,date,text,text,integer,bigint,bigint,boolean,bigint,integer,text,bigint,bigint,text,date,text,text,text,date,text,jsonb) from public;
            create temp table before_rpc as select proowner, proacl, prosecdef, proconfig, proargtypes from pg_proc where proname='rpc_persona_guardar';
        """
            # El snapshot debe vivir en la misma sesion que la migracion.
            , '-f', MIGRATION, '-c', """
            do $$ begin
              if not exists(select 1 from pg_proc p join before_rpc b
                on (p.proowner,p.proacl,p.prosecdef,p.proconfig,p.proargtypes)
                is not distinct from (b.proowner,b.proacl,b.prosecdef,b.proconfig,b.proargtypes)
                where p.proname='rpc_persona_guardar' and not p.prosecdef) then
                raise exception 'Cambio el contrato o la seguridad de la funcion';
              end if;
            end $$;
        """, '-f', ROOT / 'scripts/fixtures/domicilio-rpc-regression.sql')
        # El guard debe rechazar una funcion distinta; tampoco se reaplica a ciegas.
        result = run('psql', *connection, '-f', MIGRATION, expect_success=False)
        if result == 0:
            raise AssertionError('La migracion no detecto que la funcion ya habia cambiado')
        run('psql', *connection, '-f', ROOT / 'scripts/fixtures/rpc-persona-guardar-escolaridad.sql',
            '-f', ROOT / 'supabase/migrations/20261028111643_proteger_edicion_simultanea_persona.sql')
        spec = spec_from_file_location('persona_concurrencia', ROOT / 'scripts/test-persona-concurrencia.py')
        module = module_from_spec(spec)
        spec.loader.exec_module(module)
        module.comprobar_concurrencia(pg_bin / ('psql' + suffix), connection, env, task)
        finished = True
        print(json.dumps({'rpc_casa_torre': 'OK', 'historial': 'OK', 'clientes_anteriores': 'OK',
                          'permisos_y_firma': 'OK', 'guard_de_migracion': 'OK', 'datos_reales': False}))
    finally:
        if initialized and run('pg_ctl', '-D', data, 'status', expect_success=False) == 0:
            run('pg_ctl', '-D', data, '-w', '-t', '15', '-m', 'fast', 'stop')
        # Solo se elimina el directorio temporal creado por esta prueba y ya detenido.
        if task.parent != runtime or not task.name.startswith('pg-'):
            raise RuntimeError('Directorio de prueba inesperado')
        if finished:
            shutil.rmtree(task)


if __name__ == '__main__':
    main()
