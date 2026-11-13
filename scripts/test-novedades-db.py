"""Control de novedades con datos ficticios en PostgreSQL temporal, sin conexión remota."""
from pathlib import Path
import runpy
import subprocess
import re


def concurrentes(pg_bin, suffix, env, port, task):
    # Dos conexiones reales contra el clúster temporal recién creado.
    # UUID y datos fijos permiten comprobar el reenvío incluso si una conexión
    # empieza después de que la otra confirmó.
    sql = """begin;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
set test.read='on'; set test.nov_read='on'; set test.nov_write='on';
set role authenticated;
select 'CONTROL:'||(public.rpc_novedades_controlar('hora',201,n->>'version',1,
n->>'calendario_version','confirmada',null,'00000000-0000-4000-8000-000000000099')->>'id')
from (select public.rpc_novedades_detalle('hora',201) n) d;
select pg_sleep(0.5);
commit;"""
    # El fixture deja un control previo para Horas; obtener su ID con el
    # administrador ficticio local, sin credenciales ni URL externas.
    args = [str(pg_bin / ('psql' + suffix)), '-X', '-h', '127.0.0.1', '-p', str(port), '-U', 'licencias_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t']
    previous = subprocess.check_output(args + ['-c', "select max(id) from private.novedades_controles where origen='hora' and origen_id=201"], env=env).decode().strip()
    sql = sql.replace("n->>'version',1,", f"n->>'version',{int(previous)},")
    processes = [subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0)) for _ in range(2)]
    for process in processes:
        process.stdin.write(sql.encode()); process.stdin.close(); process.stdin = None
    ids=[]
    for process in processes:
        output,error=process.communicate(timeout=20)
        if process.returncode: raise RuntimeError(error.decode(errors='replace'))
        ids.append(re.search(rb'CONTROL:(\d+)',output).group(1))
    if len(set(ids))!=1: raise RuntimeError('Se duplicó el control ante un reenvío simultáneo.')
    print('Dos conexiones y un mismo UUID: mismo control, sin duplicados: OK')
    latest = subprocess.check_output(args + ['-c', "select max(id) from private.novedades_controles where origen='hora' and origen_id=201"], env=env).decode().strip()
    competing = sql.replace(f"n->>'version',{int(previous)},",f"n->>'version',{int(latest)},")
    competing = '\\set VERBOSITY verbose\n' + competing
    processes=[]
    for number in (100,101):
        process=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        payload=competing.replace('00000000-0000-4000-8000-000000000099',f'00000000-0000-4000-8000-{number:012}')
        process.stdin.write(payload.encode());process.stdin.close();process.stdin=None;processes.append(process)
    winners=0
    for process in processes:
        _,error=process.communicate(timeout=20)
        if process.returncode==0:winners+=1
        elif b'40001' not in error:raise RuntimeError(error.decode(errors='replace'))
    if winners!=1:raise RuntimeError('Dos controles distintos sobrescribieron la misma version.')
    print('Dos controles distintos simultáneos: uno confirma y el otro debe actualizar: OK')

if __name__ == '__main__':
    runner = runpy.run_path(str(Path(__file__).with_name('test-licencias-db.py')))
    runner['main']('control-novedades.sql', concurrentes)
