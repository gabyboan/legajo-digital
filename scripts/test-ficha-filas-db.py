"""Contrato de inserción de filas sobre una base temporal, sin datos operativos."""
import runpy
import subprocess
from pathlib import Path


def concurrentes(pg_bin, suffix, env, port, task):
    command = [str(pg_bin / ('psql' + suffix)), '-X', '-A', '-t', '-h', '127.0.0.1', '-p', str(port), '-U', 'licencias_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    setup = "select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false),set_config('test.read','on',false),set_config('test.ficha','on',false),set_config('test.create','on',false); set role authenticated;"
    workers = [subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env) for _ in range(2)]
    for index, worker in enumerate(workers):
        worker.stdin.write((setup + 'begin; select public.rpc_licencias_insertar_en_ficha(\'{"p_dni":12345678,"p_tipo_id":101,"p_desde":"2026-09-0' + str(index + 1) + '","p_hasta":"2026-09-0' + str(index + 1) + '"}\',2026,10,\'abajo\'); select pg_sleep(0.2); commit;').encode())
        worker.stdin.close()
        worker.stdin = None
    for worker in workers:
        output, error = worker.communicate(timeout=20)
        if worker.returncode:
            raise AssertionError(error.decode('utf-8', errors='replace'))
    verify = subprocess.run(command, input=b"select cardinality(registros)=7 and (select count(distinct n)=7 from unnest(registros) n) and not exists(select 1 from public.licencias_registros l where l.dni=12345678 and l.anulado_at is null and not(l.id=any(o.registros))) from private.licencias_ficha_orden o where dni=12345678;", stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, timeout=15, check=True)
    assert verify.stdout.strip() == b't', 'La inserción concurrente perdió una fila o su posición'

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('test-licencias-db.py')))['main']('ficha-filas.sql', concurrentes)
