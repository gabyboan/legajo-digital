-- Esquema minimo y datos sinteticos; no reproduce las politicas RLS del proyecto.
create schema auth;
create schema private;
create function auth.uid() returns uuid language sql stable as $$
  select case when current_setting('legajo_test.auth', true) = 'on'
    then '00000000-0000-0000-0000-000000000001'::uuid end
$$;
create function private.has_legajo_edit_role() returns boolean language sql stable as $$
  select coalesce(current_setting('legajo_test.edit', true) = 'on', false)
$$;
create table public.carreras (id bigint primary key);
create table public.situacion_revista (id bigint primary key);
create table public.sexos (id bigint primary key);
insert into public.carreras values (1);
insert into public.situacion_revista values (1);
create table public.personas (
  dni bigint primary key, apellido text, nombre text, fecha_nacimiento date,
  email text, telefono text, legajo integer, horario_rotativo boolean,
  cuil bigint, reloj integer, indice text, sexo_id bigint, numero_contacto bigint,
  estado_civil text, fecha_ingreso date, formacion_estudio text, matricula text,
  nivel_escolaridad text, fecha_inicio_tarea_especifica date, observacion text,
  created_by uuid, updated_by uuid, updated_at timestamptz default now()
);
alter table public.personas add column created_at timestamptz default now();
alter table public.personas add column estado_escolaridad text;
create role anon;
create role authenticated;
create table public.persona_carreras (dni bigint primary key references public.personas(dni), carrera_id bigint);
create table public.persona_situacion_revista (dni bigint references public.personas(dni), situacion_id bigint);
create table public.persona_domicilios (
  id uuid primary key default gen_random_uuid(), persona_dni bigint references public.personas(dni),
  calle text, numero text, barrio text, casa text, torre text, manzana text,
  lote text, monoblock text, piso text, departamento text, referencias text,
  otros_datos text, provincia_georef_id text, provincia_nombre text,
  localidad_georef_id text, localidad_nombre text,
  vigente_desde date default current_date, vigente_hasta date,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  created_by uuid, updated_by uuid
);
create unique index domicilio_vigente on public.persona_domicilios (persona_dni)
  where vigente_hasta is null;
