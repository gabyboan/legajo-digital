begin;
set local lock_timeout = '3s';
set local statement_timeout = '45s';

-- Las cargas ya registran created_by/created_at. Las correcciones conservan
-- esa autoría y dejan evidencia independiente, incluso después de un borrado.
create table private.licencias_correcciones (
  id bigint generated always as identity primary key,
  licencia_id bigint not null references public.licencias_registros(id),
  accion text not null check (accion in ('editar','borrar')),
  usuario_id uuid not null,
  fecha timestamptz not null default clock_timestamp(),
  motivo text,
  anterior jsonb not null,
  posterior jsonb not null
);
alter table private.licencias_correcciones enable row level security;
revoke all on private.licencias_correcciones from public,anon,authenticated;
revoke all on sequence private.licencias_correcciones_id_seq from public,anon,authenticated;
create index licencias_correcciones_registro_idx on private.licencias_correcciones(licencia_id,id desc);
create index licencias_registros_carga_idx on public.licencias_registros(created_at desc,id desc)
  where importacion_confirmada and desde>=date '2026-01-01';

-- Solo se invoca dentro de la consulta autorizada; no permite enumerar usuarios.
create function private.licencias_nombre_usuario(p_usuario uuid) returns text
language sql stable security invoker set search_path='' as $$
  select coalesce(
    (select nullif(btrim(concat_ws(' ',u.apellido,u.nombre)),'')
      from public.usuarios u where u.auth_user_id=p_usuario or u.id=p_usuario
      order by (u.auth_user_id=p_usuario) desc nulls last,u.id limit 1),
    (select u.email::text from auth.users u where u.id=p_usuario),
    case when p_usuario is not null then 'Usuario '||left(p_usuario::text,8) end
  );
$$;

create function private.licencias_ultimas(p_buscar text default '',p_estado text default 'vigentes',
  p_offset integer default 0,p_limite integer default 26,p_id bigint default null)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not public.can_licencias_read() then
    raise exception 'Sin permiso para consultar licencias.' using errcode='42501';
  end if;
  -- La función pública omite el control al ejecutarse como propietario.
  -- En SECURITY DEFINER se invocan directamente los controles de sesión.
  perform private.exigir_mfa_si_activado();
  perform private.gestion_sesion_exigir();
  if p_buscar is null or length(p_buscar)>150 or p_estado is null or p_estado not in ('vigentes','borradas','todas')
    or p_offset is null or p_offset<0 or p_offset>100000 or p_limite is null or p_limite<1 or p_limite>100
    or (p_id is not null and p_id<1) then
    raise exception 'La consulta de licencias es inválida.' using errcode='22023';
  end if;
  return query
  with pagina as materialized (
    select l.* from public.licencias_registros l
    join public.licencias_tipos t on t.id=l.tipo_id
    left join public.personas p on p.dni=l.persona_dni
    where l.importacion_confirmada and l.desde>=date '2026-01-01'
      and coalesce(t.codigo,'') not in ('43','98') and t.nombre<>'Imprevisto'
      and (p_id is null or l.id=p_id)
      and (p_estado='todas' or (p_estado='vigentes' and l.anulado_at is null)
        or (p_estado='borradas' and l.anulado_at is not null))
      and public.busqueda_coincide(array[l.apellido_nombre,l.dni::text,p.legajo::text],public.busqueda_terminos(p_buscar))
    order by l.created_at desc,l.id desc limit p_limite offset p_offset
  )
  select private.licencias_estudio_datos(jsonb_build_object(
    'id',l.id,'dni',l.dni,'apellido_nombre',l.apellido_nombre,'tipo_id',l.tipo_id,
    'tipo',jsonb_build_object('nombre',coalesce(cat.nombre,t.nombre),'codigo',t.codigo,'columna_ficha',t.columna_ficha),
    'desde',l.desde,'hasta',l.hasta,'dias',l.dias,'observacion',l.observacion,
    'dni_familiar',l.dni_familiar,'numero_orden',l.numero_orden,'cantidad_ficha',l.cantidad_ficha,
    'anulado_at',l.anulado_at,'imprevisto_id',null,
    'created_at',l.created_at,'created_by',l.created_by,'creado_por',private.licencias_nombre_usuario(l.created_by),
    'updated_at',l.updated_at,'actualizado_por',private.licencias_nombre_usuario(l.updated_by),
    'anulado_por',private.licencias_nombre_usuario(l.anulado_by),
    'motivo_borrado',(select c.motivo from private.licencias_correcciones c where c.licencia_id=l.id and c.accion='borrar' order by c.id desc limit 1),
    'origen',case when l.origen_archivo is null then 'manual' else 'importacion' end,
    'version',md5(to_jsonb(l)::text)
  )) from pagina l join public.licencias_tipos t on t.id=l.tipo_id
  left join public.licencias_tipos cat on cat.id=t.categoria_excel_id
  order by l.created_at desc,l.id desc;
end;
$$;
create function public.rpc_licencias_ultimas(p_buscar text default '',p_estado text default 'vigentes',
  p_offset integer default 0,p_limite integer default 26,p_id bigint default null)
returns setof jsonb language sql stable security invoker set search_path='' as $$
  select * from private.licencias_ultimas(p_buscar,p_estado,p_offset,p_limite,p_id);
$$;

create function private.licencias_corregir(p_id bigint,p_version text,p_datos jsonb default null,p_motivo text default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  v_anterior public.licencias_registros;
  v_posterior public.licencias_registros;
  v_dni bigint;
  v_codigo text;
  v_borrar boolean := p_datos is null;
begin
  if (select auth.uid()) is null or not public.can_licencias_admin() then
    raise exception 'Sin permiso para corregir licencias.' using errcode='42501';
  end if;
  perform private.exigir_mfa_si_activado();
  perform private.gestion_sesion_exigir();
  if p_id is null or p_id<1 or p_version is null or p_version !~ '^[a-f0-9]{32}$' then
    raise exception 'La licencia o su versión son inválidas.' using errcode='22023';
  end if;
  -- Mismo orden de bloqueo que Estudio y Gestión: persona, luego licencia.
  select dni into v_dni from public.licencias_registros where id=p_id;
  perform 1 from public.personas where dni=v_dni for update;
  select * into v_anterior from public.licencias_registros where id=p_id for update;
  if not found or not v_anterior.importacion_confirmada or v_anterior.desde<date '2026-01-01' then
    raise exception 'La licencia no está disponible para corregir.' using errcode='22023';
  end if;
  if v_anterior.anulado_at is not null then
    raise exception 'La licencia ya fue borrada. Actualizá el listado.' using errcode='22023';
  end if;
  if md5(to_jsonb(v_anterior)::text)<>p_version then
    raise exception 'La licencia cambió desde que la abriste. Volvé al listado y revisá la versión actual.' using errcode='40001';
  end if;
  select codigo into v_codigo from public.licencias_tipos where id=v_anterior.tipo_id;
  if v_codigo in ('43','98') then
    raise exception 'No se puede corregir un imprevisto desde Licencias. Usá Gestión.' using errcode='22023';
  end if;
  if v_borrar then
    if p_motivo is null or length(btrim(p_motivo))<3 or length(p_motivo)>500 then
      raise exception 'La licencia necesita un motivo de borrado de 3 a 500 caracteres.' using errcode='22023';
    end if;
    if not private.licencias_anular(p_id) then
      raise exception 'La licencia no pudo borrarse. Actualizá el listado.' using errcode='40001';
    end if;
  else
    if jsonb_typeof(p_datos)<>'object' or
      p_datos-array['p_dni','p_tipo_id','p_desde','p_hasta','p_observacion','p_dni_familiar','p_numero_orden','p_cantidad_ficha']<>'{}'::jsonb or
      (p_datos->>'p_dni')::bigint is distinct from v_anterior.dni then
      raise exception 'No se puede cambiar el agente ni la autoría de una licencia.' using errcode='22023';
    end if;
    if (p_datos->>'p_desde')::date is null or (p_datos->>'p_desde')::date<date '2026-01-01'
      or (p_datos->>'p_hasta')::date is null or (p_datos->>'p_hasta')::date>date '2300-12-31' then
      raise exception 'El período de la licencia es inválido.' using errcode='22023';
    end if;
    perform private.licencias_guardar_con_datos(p_id,v_anterior.dni,(p_datos->>'p_tipo_id')::smallint,
      (p_datos->>'p_desde')::date,(p_datos->>'p_hasta')::date,p_datos->>'p_observacion',
      (p_datos->>'p_dni_familiar')::bigint,(p_datos->>'p_numero_orden')::integer,p_datos->>'p_cantidad_ficha');
  end if;
  select * into v_posterior from public.licencias_registros where id=p_id;
  insert into private.licencias_correcciones(licencia_id,accion,usuario_id,motivo,anterior,posterior)
    values(p_id,case when v_borrar then 'borrar' else 'editar' end,(select auth.uid()),
      case when v_borrar then btrim(p_motivo) end,to_jsonb(v_anterior),to_jsonb(v_posterior));
  return p_id;
end;
$$;
create function public.rpc_licencias_editar_versionada(p_id bigint,p_version text,p_datos jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
begin
  if p_datos is null then raise exception 'La licencia necesita los datos de edición.' using errcode='22023'; end if;
  return private.licencias_corregir(p_id,p_version,p_datos,null);
end;
$$;
create function public.rpc_licencias_borrar_versionada(p_id bigint,p_version text,p_motivo text)
returns bigint language sql security invoker set search_path='' as $$
  select private.licencias_corregir(p_id,p_version,null,p_motivo);
$$;

revoke all on function private.licencias_nombre_usuario(uuid),
  private.licencias_ultimas(text,text,integer,integer,bigint),
  private.licencias_corregir(bigint,text,jsonb,text),
  public.rpc_licencias_ultimas(text,text,integer,integer,bigint),
  public.rpc_licencias_editar_versionada(bigint,text,jsonb),
  public.rpc_licencias_borrar_versionada(bigint,text,text) from public,anon,authenticated;
grant execute on function private.licencias_ultimas(text,text,integer,integer,bigint),
  private.licencias_corregir(bigint,text,jsonb,text),
  public.rpc_licencias_ultimas(text,text,integer,integer,bigint),
  public.rpc_licencias_editar_versionada(bigint,text,jsonb),
  public.rpc_licencias_borrar_versionada(bigint,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
