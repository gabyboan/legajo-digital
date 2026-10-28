"""Regresion con dos conexiones PostgreSQL reales; solo fixtures sinteticos."""
import json
import subprocess
import time


def comprobar_concurrencia(psql, connection, env, task):
    config = dict(env, PGOPTIONS='-c legajo_test.auth=on -c legajo_test.edit=on')

    def query(sql, expected=0, role=False):
        command = ('set role authenticated; ' if role else '') + sql
        result = subprocess.run([str(psql), *connection, '-At', '--set=VERBOSITY=verbose', '-c', command],
                                env=config, capture_output=True, text=True, timeout=15)
        if result.returncode != expected:
            raise AssertionError(f'Consulta de prueba inesperada: {result.stderr}')
        return result.stdout.strip(), result.stderr

    def literal(value):
        return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"

    payload = {'p_dni': 12345680, 'p_apellido': 'Persona', 'p_nombre': 'Concurrente',
               'p_carrera_id': 1, 'p_situacion_id': 1, 'p_email': 'inicial@example.invalid'}
    query("select public.rpc_persona_guardar_con_escolaridad(p_dni=>12345680,p_apellido=>'Persona',p_nombre=>'Concurrente',p_fecha_nacimiento=>null,p_email=>'inicial@example.invalid',p_telefono=>null,p_legajo=>null,p_carrera_id=>1,p_situacion_id=>1)")
    # Permisos minimos del esquema de prueba; las politicas reales se auditan aparte.
    query("""
      grant usage on schema public,private,auth to authenticated;
      grant select,insert,update,delete on all tables in schema public to authenticated;
      grant execute on all functions in schema auth to authenticated;
      grant execute on function public.rpc_persona_guardar(bigint,text,text,date,text,text,integer,bigint,bigint,boolean,bigint,integer,text,bigint,bigint,text,date,text,text,text,date,text,jsonb) to authenticated;
      alter table public.personas enable row level security;
      create policy prueba_personas on public.personas to authenticated using (dni=12345680) with check (dni=12345680);
    """)
    token, _ = query("select public.rpc_persona_ficha_edicion(12345680)->>'version'", role=True)
    token = token.splitlines()[-1]
    assert len(token) == 32
    before, _ = query("select md5(jsonb_agg(to_jsonb(p) order by dni)::text) from public.personas p")
    first = dict(payload, p_email='primera@example.invalid')
    sql_a = f"begin; set role authenticated; select public.rpc_persona_editar_versionada({literal(first)},'{token}'); select pg_sleep(2); commit;"
    first_env = dict(config, PGAPPNAME='legajo_test_writer_a')
    with (task / 'writer-a.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen([str(psql), *connection, '-At', '-c', sql_a], env=first_env, stdout=log, stderr=log)
        try:
            deadline = time.monotonic() + 10
            while True:
                waiting, _ = query("select count(*) from pg_stat_activity where application_name='legajo_test_writer_a' and wait_event='PgSleep'")
                if waiting == '1':
                    break
                if time.monotonic() > deadline or process.poll() is not None:
                    raise AssertionError('La primera transaccion no llego a la espera controlada')
                time.sleep(0.05)
            second = dict(payload, p_email='segunda@example.invalid')
            _, error = query(f"select public.rpc_persona_editar_versionada({literal(second)},'{token}')", expected=1, role=True)
            assert 'P4090' in error, error
            assert process.wait(timeout=10) == 0
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
    saved, _ = query("select email from public.personas where dni=12345680")
    assert saved == 'primera@example.invalid', saved
    after_first, _ = query("select md5(jsonb_agg(to_jsonb(p) order by dni)::text) from public.personas p")
    assert before != after_first
    # Reintentar con el token viejo tampoco modifica ninguna tabla.
    _, error = query(f"select public.rpc_persona_editar_versionada({literal(payload)},'{token}')", expected=1, role=True)
    assert 'P4090' in error
    # Los cambios de carrera y situacion tambien invalidan el formulario.
    for table, column in [('persona_carreras', 'carrera_id'), ('persona_situacion_revista', 'situacion_id')]:
        fresh, _ = query("select public.rpc_persona_ficha_edicion(12345680)->>'version'", role=True)
        fresh = fresh.splitlines()[-1]
        query(f'update public.{table} set {column}=2 where dni=12345680')
        _, error = query(f"select public.rpc_persona_editar_versionada({literal(payload)},'{fresh}')", expected=1, role=True)
        assert 'P4090' in error
        query(f'update public.{table} set {column}=1 where dni=12345680')
    after_rejected, _ = query("select md5(jsonb_agg(to_jsonb(p) order by dni)::text) from public.personas p")
    assert after_first == after_rejected
    # Un token nuevo permite guardar, incluyendo Casa/Torre.
    fresh, _ = query("select public.rpc_persona_ficha_edicion(12345680)->>'version'", role=True)
    fresh = fresh.splitlines()[-1]
    current = dict(payload, p_domicilio={'calle': 'Direccion ficticia', 'casa': 'A', 'torre': '02'})
    query(f"select public.rpc_persona_editar_versionada({literal(current)},'{fresh}')", role=True)
    # Un cambio directo de domicilio invalida la ficha aunque no cambie personas.updated_at.
    fresh, _ = query("select public.rpc_persona_ficha_edicion(12345680)->>'version'", role=True)
    fresh = fresh.splitlines()[-1]
    query("update public.persona_domicilios set casa='B' where persona_dni=12345680 and vigente_hasta is null")
    _, error = query(f"select public.rpc_persona_editar_versionada({literal(payload)},'{fresh}')", expected=1, role=True)
    assert 'P4090' in error
    # Otro DNI oculto por RLS no es visible ni editable por poseer un token.
    hidden, _ = query("select public.rpc_persona_ficha_edicion(12345678) is null", role=True)
    assert hidden.splitlines()[-1] == 't'
    _, error = query(f"select public.rpc_persona_editar_versionada({literal(dict(payload,p_dni=12345678))},'{fresh}')", expected=1, role=True)
    assert 'P0002' in error
    anon, _ = query("select has_function_privilege('anon','public.rpc_persona_editar_versionada(jsonb,text)','EXECUTE') or has_function_privilege('anon','public.rpc_persona_ficha_edicion(bigint)','EXECUTE')")
    assert anon == 'f'
    print('Concurrencia: dos conexiones, rechazo sin escritura, recarga, domicilio, RLS y acceso anonimo: OK')
