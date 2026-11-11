-- Solo datos ficticios y dependencias mínimas de las RPC existentes.
create role anon;
create role authenticated;
create schema auth;
create schema private;
grant usage on schema private,auth to authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.can_licencias_read() returns boolean language sql stable as $$ select coalesce(current_setting('test.read',true),'off')='on' $$;
create function public.can_licencias_admin() returns boolean language sql stable as $$ select public.can_licencias_read() and coalesce(current_setting('test.admin',true),'off')='on' $$;
create function public.verificar_mfa_opcional() returns void language plpgsql as $$ begin
  if current_user='authenticated' then perform private.exigir_mfa_si_activado(); end if;
end $$;
create function private.exigir_mfa_si_activado() returns void language plpgsql as $$ begin
  if current_setting('test.expired',true)='on' then raise exception 'Sesión vencida' using errcode='PT401'; end if;
  if current_setting('test.mfa',true)='on' then raise exception 'Autenticadora requerida' using errcode='42501'; end if;
end $$;
create function private.gestion_sesion_exigir() returns void language plpgsql as $$ begin
  if current_setting('test.conflict',true)='on' then raise exception 'Conflicto de sesión' using errcode='PT409'; end if;
end $$;
create table auth.users(id uuid primary key,email text);
create table public.usuarios(id uuid primary key,auth_user_id uuid,nombre text,apellido text);
create table public.personas(dni bigint primary key,legajo integer);
create table public.licencias_tipos(id smallint primary key,nombre text,codigo text,columna_ficha text,categoria_excel_id smallint);
create table public.licencias_registros(
  id bigint primary key,dni bigint,persona_dni bigint,apellido_nombre text,tipo_id smallint,
  desde date,hasta date,dias integer,observacion text,dni_familiar bigint,numero_orden integer,cantidad_ficha text,
  created_at timestamptz,created_by uuid,updated_at timestamptz,updated_by uuid,anulado_at timestamptz,anulado_by uuid,
  origen_archivo text,importacion_confirmada boolean default true
);
create function public.busqueda_terminos(text) returns text[] language sql immutable as $$ select array[lower(coalesce($1,''))] $$;
create function public.busqueda_coincide(text[],text[]) returns boolean language sql immutable as $$ select lower(array_to_string($1,' ')) like '%'||$2[1]||'%' $$;
create function private.licencias_estudio_datos(jsonb) returns jsonb language sql immutable as $$ select $1 $$;
create function private.licencias_guardar_con_datos(p_id bigint,p_dni bigint,p_tipo_id smallint,p_desde date,p_hasta date,
  p_observacion text,p_dni_familiar bigint,p_numero_orden integer,p_cantidad_ficha text) returns bigint language plpgsql as $$
begin
  if p_hasta<p_desde or p_tipo_id is null then raise exception 'El período es inválido.' using errcode='22023'; end if;
  update public.licencias_registros set tipo_id=p_tipo_id,desde=p_desde,hasta=p_hasta,dias=p_hasta-p_desde+1,
    observacion=p_observacion,dni_familiar=p_dni_familiar,numero_orden=p_numero_orden,cantidad_ficha=p_cantidad_ficha,
    updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id;
  return p_id;
end $$;
create function private.licencias_anular(p_id bigint) returns boolean language plpgsql as $$
begin
  update public.licencias_registros set anulado_at=clock_timestamp(),anulado_by=auth.uid(),updated_at=clock_timestamp(),updated_by=auth.uid()
    where id=p_id and anulado_at is null;
  return found;
end $$;
insert into auth.users values ('11111111-1111-4111-8111-111111111111','carga@example.invalid'),('22222222-2222-4222-8222-222222222222','admin@example.invalid');
insert into public.usuarios values ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Operadora','Ficticia');
insert into public.personas values(12345678,10),(87654321,20);
insert into public.licencias_tipos values(101,'Anual','01','ANUAL',101),(129,'Estudio','29','ESTUDIO',129),(143,'Imprevisto','43','ART8',143);
insert into public.licencias_registros(id,dni,persona_dni,apellido_nombre,tipo_id,desde,hasta,dias,created_at,created_by,updated_at,updated_by)
values(1,12345678,12345678,'AGENTE ANA',101,'2026-11-10','2026-11-12',3,'2026-11-11T12:04:05Z','11111111-1111-4111-8111-111111111111','2026-11-11T12:04:05Z','11111111-1111-4111-8111-111111111111'),
 (2,87654321,87654321,'AGENTE BRUNO',129,'2026-11-11','2026-11-11',1,'2026-11-11T12:04:05Z','22222222-2222-4222-8222-222222222222','2026-11-11T12:04:05Z','22222222-2222-4222-8222-222222222222'),
 (3,12345678,12345678,'AGENTE ANA',143,'2026-11-11','2026-11-11',1,'2026-11-11T13:00:00Z',null,'2026-11-11T13:00:00Z',null);

\ir ../../supabase/migrations/20261111103934_licencias_ultimas_y_correcciones.sql

create function pg_temp.verificar(ok boolean,msg text) returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'Falló: %',msg; end if;
end $$;
create function pg_temp.rechazar(sql text,code text) returns void language plpgsql as $$
declare caught boolean:=false;
begin
  begin execute sql; exception when others then
    if sqlstate<>code then raise exception 'Se esperaba %, llegó %: %',code,sqlstate,sqlerrm; end if;
    caught:=true;
  end;
  if not caught then raise exception 'La operación no fue rechazada: %',sql; end if;
end $$;

select set_config('test.read','on',false),set_config('test.admin','on',false);
select pg_temp.rechazar('select * from public.rpc_licencias_ultimas()','42501');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
set role anon;
select pg_temp.rechazar('select * from public.rpc_licencias_ultimas()','42501');
reset role;
set role authenticated;
select pg_temp.rechazar('select * from private.licencias_correcciones','42501');
select pg_temp.rechazar('select private.licencias_nombre_usuario(null)','42501');
select pg_temp.verificar((select count(*)=2 from public.rpc_licencias_ultimas()),'Excluye imprevistos');
select pg_temp.verificar((select r->>'id'='2' from public.rpc_licencias_ultimas(p_limite=>1) r),'Desempate estable por ID');
select pg_temp.verificar((select r->>'id'='1' from public.rpc_licencias_ultimas(p_offset=>1,p_limite=>1) r),'Paginación');
select pg_temp.verificar((select r->>'creado_por'='Ficticia Operadora' and r->>'created_by'='11111111-1111-4111-8111-111111111111'
  from public.rpc_licencias_ultimas(p_id=>1) r),'Autor de carga y perfil');
select pg_temp.verificar((select r->>'creado_por'='admin@example.invalid' from public.rpc_licencias_ultimas(p_id=>2) r),'Alternativa de correo autenticado');
select pg_temp.verificar((select count(*)=1 from public.rpc_licencias_ultimas(p_buscar=>'20')),'Busca por legajo');
select pg_temp.rechazar('select * from public.rpc_licencias_ultimas(p_estado=>''otra'')','22023');
select pg_temp.rechazar('select * from public.rpc_licencias_ultimas(p_limite=>101)','22023');
select set_config('test.expired','on',false);
select pg_temp.rechazar('select * from public.rpc_licencias_ultimas()','PT401');
select pg_temp.rechazar('select public.rpc_licencias_borrar_versionada(1,repeat(''a'',32),''Error de carga'')','PT401');
select set_config('test.expired','off',false),set_config('test.mfa','on',false);
select pg_temp.rechazar('select * from public.rpc_licencias_ultimas()','42501');
select set_config('test.mfa','off',false),set_config('test.conflict','on',false);
select pg_temp.rechazar('select * from public.rpc_licencias_ultimas()','PT409');
select set_config('test.conflict','off',false),set_config('test.admin','off',false);
select pg_temp.rechazar('select public.rpc_licencias_borrar_versionada(1,repeat(''a'',32),''Error de carga'')','42501');
select set_config('test.admin','on',false);
reset role;
create temp table versiones as select id,md5(to_jsonb(l)::text) as version from public.licencias_registros l;
grant select on versiones to authenticated;
set role authenticated;
select pg_temp.rechazar('select public.rpc_licencias_editar_versionada(1,repeat(''a'',32),''{}'')','40001');
select pg_temp.rechazar(format('select public.rpc_licencias_editar_versionada(1,%L,null)',version),'22023') from versiones where id=1;
select pg_temp.rechazar(format('select public.rpc_licencias_editar_versionada(1,%L,''{"p_dni":87654321}'')',version),'22023') from versiones where id=1;
select public.rpc_licencias_editar_versionada(1,version,'{"p_dni":12345678,"p_tipo_id":101,"p_desde":"2026-11-10","p_hasta":"2026-11-13","p_observacion":"Corregida"}') from versiones where id=1;
select pg_temp.rechazar(format('select public.rpc_licencias_borrar_versionada(1,%L,''Carga equivocada'')',version),'40001') from versiones where id=1;
reset role;
select pg_temp.verificar((select created_by='11111111-1111-4111-8111-111111111111' and created_at='2026-11-11T12:04:05Z'
  and updated_by='22222222-2222-4222-8222-222222222222' and dias=4 from public.licencias_registros where id=1),'Conserva autor original y registra editor');
select pg_temp.verificar((select count(*)=1 and bool_and(accion='editar' and anterior->>'dias'='3' and posterior->>'dias'='4') from private.licencias_correcciones),'Auditoría antes y después');
update versiones set version=(select md5(to_jsonb(l)::text) from public.licencias_registros l where l.id=versiones.id);
set role authenticated;
select pg_temp.rechazar(format('select public.rpc_licencias_borrar_versionada(1,%L,''a'')',version),'22023') from versiones where id=1;
select public.rpc_licencias_borrar_versionada(1,version,'Carga al agente equivocado') from versiones where id=1;
select pg_temp.verificar((select count(*)=1 from public.rpc_licencias_ultimas()),'El borrado sale de vigentes');
select pg_temp.verificar((select r->>'motivo_borrado'='Carga al agente equivocado' and r->>'anulado_por'='admin@example.invalid'
  from public.rpc_licencias_ultimas(p_estado=>'borradas') r),'Borradas muestra motivo y responsable');
select pg_temp.rechazar(format('select public.rpc_licencias_borrar_versionada(1,%L,''Otra vez'')',version),'22023') from versiones where id=1;
reset role;
select pg_temp.verificar((select count(*)=2 from private.licencias_correcciones),'Borrado conserva el historial');
select pg_temp.verificar((select relrowsecurity from pg_class where oid='private.licencias_correcciones'::regclass),'RLS del registro privado');
