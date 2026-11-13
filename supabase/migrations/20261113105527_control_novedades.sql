begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

insert into public.roles(codigo,nombre) values
 ('NOVEDADES_LECTURA','Novedades - Consulta administrativa'),
 ('NOVEDADES_CONFIRMAR','Novedades - Confirmar control')
on conflict(codigo) do update set nombre=excluded.nombre;

create function public.can_novedades_read() returns boolean
language sql stable security invoker set search_path='' as $$
 select (select auth.uid()) is not null and public.can_licencias_read()
 and (public.has_role_code('NOVEDADES_LECTURA') or public.has_role_code('NOVEDADES_CONFIRMAR'));
$$;
create function public.can_novedades_confirm() returns boolean
language sql stable security invoker set search_path='' as $$
 select public.can_novedades_read() and public.has_role_code('NOVEDADES_CONFIRMAR');
$$;
revoke all on function public.can_novedades_read(),public.can_novedades_confirm() from public,anon;
grant execute on function public.can_novedades_read(),public.can_novedades_confirm() to authenticated;

create table private.novedades_controles(
 id bigint generated always as identity primary key,
 origen text not null check(origen in ('franco','hora','medico','licencia','imprevisto')),
 origen_id bigint not null,
 origen_version text not null,
 calendario_version text not null,
 estado text not null check(estado in ('confirmada','observada')),
 observacion text,
 usuario_id uuid not null,
 registrado_at timestamptz not null default clock_timestamp(),
 operacion_id uuid not null,
 solicitud jsonb not null,
 licencia_id bigint references public.licencias_registros(id),
 licencia_version text,
 unique(usuario_id,operacion_id)
);
alter table private.novedades_controles enable row level security;
revoke all on private.novedades_controles from public,anon,authenticated,service_role;
revoke all on sequence private.novedades_controles_id_seq from public,anon,authenticated,service_role;
create index novedades_controles_origen_idx on private.novedades_controles(origen,origen_id,id desc);

-- Solo metadatos administrativos. El hash incluye los datos de origen para
-- invalidar una revisión sin copiar su contenido médico o documental.
create view private.novedades_fuentes with(security_invoker=true) as
 select 'franco'::text as origen,f.id,f.dni,f.carrera_id,f.fecha as desde,f.fecha as hasta,
 abs(f.minutos) as minutos,null::integer as cantidad,'minutos'::text as unidad,
 case when f.minutos>0 then 'Recarga de banco' else 'Uso de franco' end as tipo,
 f.usuario_carga,f.usuario_modifica as usuario_modifica,
 f.created_at at time zone 'UTC' as cargado_at,f.anulado as anulada,f.minutos>0 as recarga,
 md5(to_jsonb(f)::text) as version,'{}'::jsonb as documento
 from public.francos_movimientos f
 union all
 select 'hora',h.id,h.dni,h.carrera_id::bigint,h.fecha,h.fecha,h.minutos,null,'minutos',h.tipo,
 h.usuario_carga,null,h.created_at at time zone 'UTC',false,false,md5(to_jsonb(h)::text),'{}'::jsonb
 from public.horas_registros h
 union all
 select 'licencia',l.id,l.persona_dni,null,l.desde,l.hasta,null,
 coalesce(l.cantidad_dias_ficha,l.dias),case when l.cantidad_dias_ficha is null then 'días calendario' else 'días según ficha' end,
 concat_ws(' · ',t.codigo,t.nombre),l.created_by,l.updated_by,l.created_at,l.anulado_at is not null,false,
 md5(to_jsonb(l)::text),jsonb_build_object('documentacion_pendiente',l.documentacion_pendiente,'cantidad_ficha',l.cantidad_ficha)
 from public.licencias_registros l join public.licencias_tipos t on t.id=l.tipo_id
 where l.importacion_confirmada and l.persona_dni is not null and coalesce(t.codigo,'') not in ('43','98') and t.nombre<>'Imprevisto'
 union all
 select 'imprevisto',i.id,i.dni::bigint,i.carrera_id::bigint,i.fecha,i.fecha,null,1,'día','Imprevisto',
 i.usuario_carga,null,i.created_at,i.deleted_at is not null,false,md5(to_jsonb(i)::text),jsonb_build_object('numero_orden',i.numero_orden)
 from public.imprevistos_registros i
 union all
 select 'medico',m.id,m.dni,null,coalesce(c.fecha_desde,m.fecha),coalesce(c.fecha_hasta,c.fecha_desde,m.fecha),null,c.dias_aprobados,'días aprobados',
 case when m.es_art then 'Parte médico · ART' when m.tipo='DOMICILIO_FAMILIAR' then 'Parte médico · Familiar' else 'Parte médico · Propio' end,
 m.usuario_carga,c.usuario_registro,m.created_at,m.anulado_at is not null,false,
 md5(jsonb_build_array(to_jsonb(m),to_jsonb(c))::text),
 jsonb_build_object('parte_id',m.id,'codigo',m.codigo_qr,'devolucion_registrada',c.id is not null,
 'version_control',c.version,'dias_aprobados',c.dias_aprobados)
 from public.partes_medicos m left join lateral (
 select pc.* from public.partes_medicos_controles pc where pc.parte_id=m.id order by pc.version desc limit 1
 ) c on true;
revoke all on private.novedades_fuentes from public,anon,authenticated,service_role;

create function private.novedades_exigir(p_escritura boolean default false) returns void
language plpgsql stable security invoker set search_path='' as $$ begin
 if (select auth.uid()) is null or public.can_novedades_read() is distinct from true
 or (p_escritura and public.can_novedades_confirm() is distinct from true) then
  raise exception 'Sin permiso para controlar novedades.' using errcode='42501';
 end if;
 perform private.exigir_mfa_si_activado();
 perform private.gestion_sesion_exigir();
end; $$;

create function private.novedades_calendario(p_desde date,p_hasta date) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('fecha',f.fecha,'nombre',f.nombre) order by f.fecha),'[]'::jsonb)
 from public.feriados f where f.fecha between p_desde and p_hasta;
$$;

create function private.novedades_presentar(n private.novedades_fuentes) returns jsonb
language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare c private.novedades_controles; dias jsonb; valida boolean; licencia_vigente boolean;
begin
 select * into c from private.novedades_controles where origen=n.origen and origen_id=n.id order by id desc limit 1;
 dias:=private.novedades_calendario(n.desde,n.hasta);
 licencia_vigente:=c.licencia_id is null or exists(
  select 1 from public.licencias_registros l where l.id=c.licencia_id and l.persona_dni=n.dni
  and l.importacion_confirmada and l.anulado_at is null and md5(to_jsonb(l)::text)=c.licencia_version
 );
 valida:=c.id is not null and c.origen_version=n.version and c.calendario_version=md5(dias::text) and licencia_vigente;
 return jsonb_build_object('origen',n.origen,'id',n.id,'dni',n.dni,'carrera_id',n.carrera_id,
 'persona',coalesce((select btrim(p.apellido||' '||p.nombre) from public.personas p where p.dni=n.dni),'Persona no disponible'),
 'legajo',(select p.legajo from public.personas p where p.dni=n.dni),
 'desde',n.desde,'hasta',n.hasta,'minutos',n.minutos,'cantidad',n.cantidad,'unidad',n.unidad,'tipo',n.tipo,
 'usuario_carga',n.usuario_carga,'cargado_por',private.licencias_nombre_usuario(n.usuario_carga),'cargado_at',n.cargado_at,
 'version',n.version,'anulada',n.anulada,'recarga',n.recarga,'documento',n.documento,
 'feriados',dias,'calendario_version',md5(dias::text),
 'estado',case when n.anulada then 'anulada' when n.recarga then 'recarga_verificada' when valida then c.estado else 'pendiente' end,
 'control_id',coalesce(c.id,0),'control_desactualizado',c.id is not null and not valida,
 'confirmado_por',case when valida then private.licencias_nombre_usuario(c.usuario_id) end,
 'controlado_at',case when valida then c.registrado_at end,'observacion',case when valida then c.observacion end,
 'licencia_id',case when valida then c.licencia_id end,
 'carga_propia',(select auth.uid())=n.usuario_carga or (select auth.uid())=n.usuario_modifica,
 'puede_confirmar',not n.anulada and not n.recarga
 and (select auth.uid()) is distinct from n.usuario_carga and (select auth.uid()) is distinct from n.usuario_modifica
 and (n.origen<>'franco' or n.desde<=(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date)
 and (n.origen<>'medico' or (n.documento->>'devolucion_registrada')::boolean)
 );
end; $$;

create function private.novedades_listar(p_desde date,p_hasta date,p_buscar text default '',p_origen text default '',
 p_estado text default 'pendiente',p_offset integer default 0,p_limite integer default 26)
returns setof jsonb language plpgsql stable security definer set search_path='' set timezone='UTC' as $$ begin
 perform private.novedades_exigir();
 if p_desde is null or p_hasta is null or p_desde<date '2026-01-01' or p_hasta<p_desde or p_hasta-p_desde>366
 or p_buscar is null or length(p_buscar)>150 or p_origen is null or p_origen not in ('','franco','hora','medico','licencia','imprevisto')
 or p_estado is null or p_estado not in ('todas','pendiente','confirmada','observada','recarga_verificada','anulada')
 or p_offset is null or p_offset<0 or p_offset>100000 or p_limite is null or p_limite<1 or p_limite>100 then
  raise exception 'La consulta de novedades es inválida.' using errcode='22023';
 end if;
 return query with filtradas as materialized (
 select f.* from private.novedades_fuentes f left join public.personas p on p.dni=f.dni
 where f.desde<=p_hasta and f.hasta>=p_desde and (p_origen='' or f.origen=p_origen)
 and public.busqueda_coincide(array[p.apellido,p.nombre,f.dni::text,p.legajo::text],public.busqueda_terminos(p_buscar))
 ), presentadas as materialized (
 select f.desde,f.origen,f.id,private.novedades_presentar(f::private.novedades_fuentes) as datos from filtradas f
 ) select p.datos from presentadas p where p_estado='todas' or p.datos->>'estado'=p_estado
 order by p.desde desc,p.origen,p.id desc limit p_limite offset p_offset;
end; $$;

create function private.novedades_detalle(p_origen text,p_id bigint) returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare n private.novedades_fuentes; resultado jsonb;
begin
 perform private.novedades_exigir();
 select * into n from private.novedades_fuentes where origen=p_origen and id=p_id;
 if not found or n.desde<date '2026-01-01' then raise exception 'La novedad no está disponible.' using errcode='22023'; end if;
 resultado:=private.novedades_presentar(n);
 return resultado||jsonb_build_object(
 'coincidencias',coalesce((select jsonb_agg(x.datos order by x.desde desc,x.origen,x.id) from (
 select f.desde,f.origen,f.id,jsonb_build_object('origen',f.origen,'id',f.id,'desde',f.desde,'hasta',f.hasta,
 'tipo',f.tipo,'minutos',f.minutos,'cantidad',f.cantidad,'unidad',f.unidad,'version',f.version) as datos
 from private.novedades_fuentes f where f.dni=n.dni and not f.anulada and not f.recarga
 and f.desde<=n.hasta and f.hasta>=n.desde and (f.origen,f.id)<>(n.origen,n.id)
 order by f.desde desc,f.origen,f.id limit 51
 ) x),'[]'::jsonb),
 'historial',coalesce((select jsonb_agg(x.datos order by x.id desc) from (
 select c.id,jsonb_build_object('id',c.id,'estado',c.estado,'observacion',c.observacion,
 'usuario',private.licencias_nombre_usuario(c.usuario_id),'fecha',c.registrado_at,
 'licencia_id',c.licencia_id,'version',c.origen_version) as datos
 from private.novedades_controles c where c.origen=n.origen and c.origen_id=n.id order by c.id desc limit 50
 ) x),'[]'::jsonb));
end; $$;

create function private.novedades_controlar(p_origen text,p_id bigint,p_version text,p_control_id bigint,
 p_calendario_version text,p_estado text,p_observacion text,p_operacion uuid,
 p_licencia_id bigint default null,p_licencia_version text default null) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare n private.novedades_fuentes; anterior private.novedades_controles; guardado private.novedades_controles;
 solicitud jsonb; ultimo bigint; dias jsonb; vinculo public.licencias_registros;
begin
 perform private.novedades_exigir(true);
 if p_origen is null or p_origen not in ('franco','hora','medico','licencia','imprevisto') or p_id is null or p_id<1
 or p_version is null or p_version!~'^[a-f0-9]{32}$' or p_control_id is null or p_control_id<0
 or p_calendario_version is null or p_calendario_version!~'^[a-f0-9]{32}$' or p_estado is null or p_estado not in ('confirmada','observada')
 or length(coalesce(p_observacion,''))>500 or (p_estado='observada' and length(btrim(coalesce(p_observacion,'')))<3)
 or p_operacion is null or (p_licencia_id is not null and (p_origen<>'medico' or p_licencia_id<1 or p_licencia_version is null or p_licencia_version!~'^[a-f0-9]{32}$')) then
  raise exception 'Los datos del control son inválidos.' using errcode='22023';
 end if;
 solicitud:=jsonb_build_array(p_origen,p_id,p_version,p_control_id,p_calendario_version,p_estado,btrim(coalesce(p_observacion,'')),p_licencia_id,p_licencia_version);
 perform pg_advisory_xact_lock(hashtextextended((select auth.uid())::text||p_operacion::text,0));
 select * into anterior from private.novedades_controles where usuario_id=(select auth.uid()) and operacion_id=p_operacion;
 if found then
  if anterior.solicitud is distinct from solicitud then raise exception 'La operación corresponde a otro control.' using errcode='22023'; end if;
  return jsonb_build_object('id',anterior.id,'estado',anterior.estado,'fecha',anterior.registrado_at);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('novedad/'||p_origen||'/'||p_id::text,0));
 select * into n from private.novedades_fuentes where origen=p_origen and id=p_id;
 if not found or n.desde<date '2026-01-01' then raise exception 'La novedad no está disponible.' using errcode='22023'; end if;
 perform 1 from public.personas where dni=n.dni for update;
 case p_origen
 when 'franco' then perform 1 from public.francos_movimientos where id=p_id for update;
 when 'hora' then perform 1 from public.horas_registros where id=p_id for update;
 when 'medico' then perform 1 from public.partes_medicos where id=p_id for update;
 when 'licencia' then perform 1 from public.licencias_registros where id=p_id for update;
 when 'imprevisto' then perform 1 from public.imprevistos_registros where id=p_id for update;
 end case;
 select * into n from private.novedades_fuentes where origen=p_origen and id=p_id;
 select coalesce(max(id),0) into ultimo from private.novedades_controles where origen=p_origen and origen_id=p_id;
 dias:=private.novedades_calendario(n.desde,n.hasta);
 if not found or n.version is distinct from p_version or ultimo<>p_control_id or md5(dias::text)<>p_calendario_version then
  raise exception 'La novedad, el calendario o su control cambiaron. Actualizá y revisá antes de continuar.' using errcode='40001';
 end if;
 if n.anulada or n.recarga then raise exception 'Esta novedad no admite confirmación.' using errcode='22023'; end if;
 if (select auth.uid())=n.usuario_carga or (select auth.uid())=n.usuario_modifica then
  raise exception 'No se puede controlar una carga propia.' using errcode='42501';
 end if;
 if p_estado='confirmada' and p_origen='franco' and n.desde>(current_timestamp at time zone 'America/Argentina/Buenos_Aires')::date then
  raise exception 'Un franco futuro todavía no puede confirmarse como tomado.' using errcode='22023';
 end if;
 if p_estado='confirmada' and p_origen='medico' and not (n.documento->>'devolucion_registrada')::boolean then
  raise exception 'El parte todavía no tiene devolución registrada.' using errcode='22023';
 end if;
 if p_licencia_id is not null then
  select * into vinculo from public.licencias_registros where id=p_licencia_id and persona_dni=n.dni for share;
  if not found or not vinculo.importacion_confirmada or vinculo.anulado_at is not null
  or vinculo.desde>n.hasta or vinculo.hasta<n.desde or md5(to_jsonb(vinculo)::text)<>p_licencia_version then
   raise exception 'La licencia vinculada cambió o no corresponde a esta persona y período.' using errcode='40001';
  end if;
 end if;
 insert into private.novedades_controles(origen,origen_id,origen_version,calendario_version,estado,observacion,
 usuario_id,operacion_id,solicitud,licencia_id,licencia_version)
 values(p_origen,p_id,p_version,p_calendario_version,p_estado,nullif(btrim(p_observacion),''),
 (select auth.uid()),p_operacion,solicitud,p_licencia_id,case when p_licencia_id is not null then p_licencia_version end)
 returning * into guardado;
 return jsonb_build_object('id',guardado.id,'estado',guardado.estado,'fecha',guardado.registrado_at);
end; $$;

create function public.rpc_novedades_listar(p_desde date,p_hasta date,p_buscar text default '',p_origen text default '',
 p_estado text default 'pendiente',p_offset integer default 0,p_limite integer default 26) returns setof jsonb
language sql stable security invoker set search_path='' as $$ select * from private.novedades_listar(p_desde,p_hasta,p_buscar,p_origen,p_estado,p_offset,p_limite); $$;
create function public.rpc_novedades_detalle(p_origen text,p_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.novedades_detalle(p_origen,p_id); $$;
create function public.rpc_novedades_controlar(p_origen text,p_id bigint,p_version text,p_control_id bigint,
 p_calendario_version text,p_estado text,p_observacion text,p_operacion uuid,p_licencia_id bigint default null,p_licencia_version text default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.novedades_controlar(p_origen,p_id,p_version,p_control_id,p_calendario_version,p_estado,p_observacion,p_operacion,p_licencia_id,p_licencia_version); $$;

-- Ningún helper permite saltar la autorización por llamada directa.
revoke all on function private.novedades_exigir(boolean),private.novedades_calendario(date,date),private.novedades_presentar(private.novedades_fuentes) from public,anon,authenticated;
revoke all on function private.novedades_listar(date,date,text,text,text,integer,integer),private.novedades_detalle(text,bigint),
 private.novedades_controlar(text,bigint,text,bigint,text,text,text,uuid,bigint,text),
 public.rpc_novedades_listar(date,date,text,text,text,integer,integer),public.rpc_novedades_detalle(text,bigint),
 public.rpc_novedades_controlar(text,bigint,text,bigint,text,text,text,uuid,bigint,text) from public,anon;
grant execute on function private.novedades_listar(date,date,text,text,text,integer,integer),private.novedades_detalle(text,bigint),
 private.novedades_controlar(text,bigint,text,bigint,text,text,text,uuid,bigint,text),
 public.rpc_novedades_listar(date,date,text,text,text,integer,integer),public.rpc_novedades_detalle(text,bigint),
 public.rpc_novedades_controlar(text,bigint,text,bigint,text,text,text,uuid,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
