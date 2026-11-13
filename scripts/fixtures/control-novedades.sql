\set ON_ERROR_STOP on
\encoding UTF8
-- Base temporal, datos ficticios; reutiliza las dependencias ya verificadas.
\ir licencias-administracion.sql
reset role;
create role service_role;
set test.read='on'; set test.expired='off'; set test.mfa='off'; set test.conflict='off';
create table public.roles(id bigint generated always as identity,codigo text unique,nombre text);
create function public.has_role_code(code text) returns boolean language sql stable as $$
 select case when code='NOVEDADES_LECTURA' then current_setting('test.nov_read',true)='on'
 when code='NOVEDADES_CONFIRMAR' then current_setting('test.nov_write',true)='on' else false end;
$$;
alter table public.personas add column apellido text default 'FICTICIA',add column nombre text default 'Persona';
alter table public.licencias_registros add column cantidad_dias_ficha integer,add column documentacion_pendiente boolean default false;
create table public.francos_movimientos(id bigint primary key,dni bigint,carrera_id bigint,fecha date,minutos integer,usuario_carga uuid,usuario_modifica uuid,created_at timestamp default now(),updated_at timestamp default now(),anulado boolean default false);
create table public.horas_registros(id bigint primary key,dni bigint,carrera_id integer,fecha date,minutos integer,tipo text,usuario_carga uuid,created_at timestamp default now());
create table public.imprevistos_registros(id bigint primary key,dni integer,carrera_id integer,fecha date,numero_orden integer,usuario_carga uuid,created_at timestamptz default now(),deleted_at timestamptz);
create table public.partes_medicos(id bigint primary key,dni bigint,fecha date,tipo text,es_art boolean default false,usuario_carga uuid,created_at timestamptz default now(),anulado_at timestamptz,codigo_qr text,domicilio_emision jsonb);
create table public.partes_medicos_controles(id bigint primary key,parte_id bigint references public.partes_medicos(id),fecha_desde date,fecha_hasta date,dias_aprobados integer,usuario_registro uuid,version integer,medico_nombre text);
create table public.feriados(fecha date primary key,nombre text);
insert into public.francos_movimientos(id,dni,carrera_id,fecha,minutos,usuario_carga) values
 (101,12345678,1,'2026-11-12',-120,'11111111-1111-4111-8111-111111111111'),
 (102,12345678,1,'2026-11-12',120,'11111111-1111-4111-8111-111111111111'),
 (103,12345678,1,'2026-11-12',-30,'22222222-2222-4222-8222-222222222222'),
 (104,12345678,1,(now() at time zone 'America/Argentina/Buenos_Aires')::date+1,-30,'11111111-1111-4111-8111-111111111111');
insert into public.horas_registros values(201,12345678,1,'2026-11-12',90,'GREMIAL','11111111-1111-4111-8111-111111111111',now());
insert into public.partes_medicos(id,dni,fecha,tipo,usuario_carga,codigo_qr,domicilio_emision) values
 (301,12345678,'2026-11-12','CONSULTORIO','11111111-1111-4111-8111-111111111111','00003011','{"calle":"DATOS_MEDICOS_PRIVADOS"}'),
 (302,12345678,'2026-11-12','DOMICILIO','11111111-1111-4111-8111-111111111111','00003029',null);
insert into public.partes_medicos_controles values(401,301,'2026-11-12','2026-11-13',2,'11111111-1111-4111-8111-111111111111',1,'MEDICO_PRIVADO');
insert into public.feriados values('2026-11-12','Feriado ficticio de prueba');
insert into public.licencias_registros(id,dni,persona_dni,apellido_nombre,tipo_id,desde,hasta,dias,created_by,updated_by,created_at) values
 (501,12345678,12345678,'Persona Ficticia',101,'2026-11-12','2026-11-13',2,'11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',now());

\ir ../../supabase/migrations/20261113105527_control_novedades.sql
create function pg_temp.guardar(origen text,id bigint,estado text,op uuid,nota text default null,lic bigint default null) returns jsonb language plpgsql as $$
declare n jsonb; v text;
begin
 n:=public.rpc_novedades_detalle(origen,id);
 if lic is not null then select x->>'version' into v from jsonb_array_elements(n->'coincidencias') x where x->>'origen'='licencia' and (x->>'id')::bigint=lic; end if;
 return public.rpc_novedades_controlar(origen,id,n->>'version',(n->>'control_id')::bigint,n->>'calendario_version',estado,nota,op,lic,v);
end $$;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
set test.nov_read='off'; set test.nov_write='off';
set role authenticated;
select pg_temp.rechazar('select * from public.rpc_novedades_listar(''2026-11-01'',''2026-11-30'')','42501');
set test.nov_read='on';
select pg_temp.verificar((public.rpc_novedades_detalle('franco',102)->>'estado')='recarga_verificada','Recarga ya verificada');
select pg_temp.verificar(not exists(select 1 from public.rpc_novedades_listar('2026-11-01','2026-11-30') r where r->>'origen'='franco' and r->>'id'='102'),'Recarga fuera de pendientes');
select pg_temp.rechazar('select pg_temp.guardar(''franco'',101,''confirmada'',''00000000-0000-4000-8000-000000000001'')','42501');
set test.nov_write='on';
select pg_temp.guardar('franco',101,'confirmada','00000000-0000-4000-8000-000000000001');
select pg_temp.verificar((public.rpc_novedades_detalle('franco',101)->>'estado')='confirmada','Franco Confirmada');
-- Reenvío idéntico, incluso cuando el control ya existe.
select pg_temp.verificar((select count(*)=1 from public.rpc_novedades_listar('2026-11-01','2026-11-30',p_estado=>'confirmada')),'Filtro de confirmadas');
select pg_temp.rechazar('select pg_temp.guardar(''franco'',102,''confirmada'',''00000000-0000-4000-8000-000000000002'')','22023');
select pg_temp.rechazar('select pg_temp.guardar(''franco'',103,''confirmada'',''00000000-0000-4000-8000-000000000003'')','42501');
select pg_temp.rechazar('select pg_temp.guardar(''franco'',104,''confirmada'',''00000000-0000-4000-8000-000000000004'')','22023');
select pg_temp.guardar('hora',201,'observada','00000000-0000-4000-8000-000000000005','Revisar coincidencia');
select pg_temp.verificar((public.rpc_novedades_detalle('hora',201)->'feriados'->0->>'nombre')='Feriado ficticio de prueba','Aviso de feriado registrado');
select pg_temp.verificar((public.rpc_novedades_detalle('hora',201)->>'minutos')='90','Horas conserva minutos');
select pg_temp.rechazar('select pg_temp.guardar(''medico'',302,''confirmada'',''00000000-0000-4000-8000-000000000006'')','22023');
select pg_temp.guardar('medico',301,'confirmada','00000000-0000-4000-8000-000000000007',null,501);
select pg_temp.verificar((public.rpc_novedades_detalle('medico',301)->>'licencia_id')='501','Vinculo explicito a licencia existente');
select pg_temp.verificar(public.rpc_novedades_detalle('medico',301)::text not like '%MEDICO_PRIVADO%' and public.rpc_novedades_detalle('medico',301)::text not like '%DATOS_MEDICOS_PRIVADOS%','No devuelve datos medicos privados');
select pg_temp.rechazar('select * from private.novedades_controles','42501');
select pg_temp.rechazar('select * from private.novedades_fuentes','42501');
set test.expired='on';
select pg_temp.rechazar('select public.rpc_novedades_detalle(''franco'',101)','PT401');
set test.expired='off'; set test.mfa='on';
select pg_temp.rechazar('select public.rpc_novedades_detalle(''franco'',101)','42501');
set test.mfa='off'; set test.conflict='on';
select pg_temp.rechazar('select public.rpc_novedades_detalle(''franco'',101)','PT409');
set test.conflict='off';
reset role;
update public.francos_movimientos set minutos=-180,updated_at=clock_timestamp() where id=101;
select pg_temp.verificar((public.rpc_novedades_detalle('franco',101)->>'estado')='pendiente','Cambiar fuente invalida confirmacion');
update public.licencias_registros set hasta='2026-11-14' where id=501;
select pg_temp.verificar((public.rpc_novedades_detalle('medico',301)->>'estado')='pendiente','Cambiar licencia invalida vinculo');
update public.feriados set nombre='Nombre modificado' where fecha='2026-11-12';
select pg_temp.verificar((public.rpc_novedades_detalle('hora',201)->>'estado')='pendiente','Cambiar calendario obliga a revisar');
select pg_temp.verificar((select minutos=-180 from public.francos_movimientos where id=101),'Control no modifico saldo ni carga');
select pg_temp.verificar((select count(*)=3 from private.novedades_controles),'Historial independiente');
select pg_temp.verificar(not has_function_privilege('anon','public.rpc_novedades_detalle(text,bigint)','execute'),'Anon no accede');
select pg_temp.verificar(not has_function_privilege('authenticated','private.novedades_presentar(private.novedades_fuentes)','execute'),'Helper privado');
select 'OK: Control de novedades, fuentes, feriados, permisos, vinculos y versiones.';

do $$ declare n jsonb; primero jsonb; segundo jsonb; begin
 n:=public.rpc_novedades_detalle('franco',101);
 primero:=public.rpc_novedades_controlar('franco',101,n->>'version',(n->>'control_id')::bigint,
 n->>'calendario_version','confirmada',null,'00000000-0000-4000-8000-000000000010');
 segundo:=public.rpc_novedades_controlar('franco',101,n->>'version',(n->>'control_id')::bigint,
 n->>'calendario_version','confirmada',null,'00000000-0000-4000-8000-000000000010');
 perform pg_temp.verificar(primero=segundo,'Reenvio devuelve mismo recibo');
 perform pg_temp.rechazar(format('select public.rpc_novedades_controlar(''franco'',101,%L,%s,%L,''confirmada'',null,''00000000-0000-4000-8000-000000000011'')',n->>'version',n->>'control_id',n->>'calendario_version'),'40001');
 perform pg_temp.rechazar(format('select public.rpc_novedades_controlar(''franco'',101,%L,%s,%L,''observada'',''Otro contenido'',''00000000-0000-4000-8000-000000000010'')',n->>'version',n->>'control_id',n->>'calendario_version'),'22023');
end $$;
insert into public.francos_movimientos(id,dni,carrera_id,fecha,minutos,usuario_carga)
 select n,12345678,1,'2026-11-12',-30,'11111111-1111-4111-8111-111111111111' from generate_series(1001,1075) n;
select pg_temp.verificar((select count(*)=26 from public.rpc_novedades_listar('2026-11-01','2026-11-30',p_origen=>'franco',p_limite=>26)),'Pagina completa');
select pg_temp.verificar(not exists(
 select 1 from public.rpc_novedades_listar('2026-11-01','2026-11-30',p_origen=>'franco',p_limite=>25) a
 join public.rpc_novedades_listar('2026-11-01','2026-11-30',p_origen=>'franco',p_offset=>25,p_limite=>25) b on a->>'id'=b->>'id'
),'Paginas sin repeticion');
