-- Snapshot consistente de la ficha y guardado con comprobacion dentro de la transaccion.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function private.legajo_edicion_snapshot(p_dni bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'persona', to_jsonb(ficha),
    'carreras', coalesce((select jsonb_agg(c.carrera_id order by c.carrera_id)
      from public.persona_carreras c where c.dni = p_dni), '[]'::jsonb),
    'situaciones', coalesce((select jsonb_agg(s.situacion_id order by s.situacion_id)
      from public.persona_situacion_revista s where s.dni = p_dni), '[]'::jsonb),
    'domicilio', (select to_jsonb(domicilio) from (
      select d.id, d.calle, d.numero, d.barrio, d.manzana, d.lote, d.casa, d.torre,
        d.monoblock, d.piso, d.departamento, d.referencias, d.otros_datos,
        d.provincia_georef_id, d.provincia_nombre, d.localidad_georef_id, d.localidad_nombre
      from public.persona_domicilios d where d.persona_dni = p_dni and d.vigente_hasta is null
    ) domicilio)
  ) from (
    select p.dni, p.legajo, p.apellido, p.nombre, p.email, p.telefono,
      p.fecha_nacimiento, p.created_at, p.updated_at, p.horario_rotativo,
      p.cuil, p.reloj, p.indice, p.sexo_id, p.numero_contacto, p.estado_civil,
      p.fecha_ingreso, p.formacion_estudio, p.matricula, p.nivel_escolaridad,
      p.estado_escolaridad, p.fecha_inicio_tarea_especifica, p.observacion
    from public.personas p where p.dni = p_dni
  ) ficha;
$$;

create function public.rpc_persona_ficha_edicion(p_dni bigint)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_snapshot jsonb;
begin
  if (select auth.uid()) is null or not private.has_legajo_edit_role() then
    raise exception using errcode = '42501', message = 'Sin permiso para editar legajos.';
  end if;
  v_snapshot := private.legajo_edicion_snapshot(p_dni);
  if v_snapshot is null then return null; end if;
  return v_snapshot || jsonb_build_object('version', md5(v_snapshot::text));
end;
$$;

create function public.rpc_persona_editar_versionada(p_datos jsonb, p_version text)
returns void language plpgsql security invoker set search_path = '' set lock_timeout = '5s' as $$
declare
  v_dni bigint;
  v_snapshot jsonb;
  x record;
begin
  if (select auth.uid()) is null or not private.has_legajo_edit_role() then
    raise exception using errcode = '42501', message = 'Sin permiso para editar legajos.';
  end if;
  if jsonb_typeof(p_datos) is distinct from 'object' or p_version is null
    or p_version !~ '^[a-f0-9]{32}$' then
    raise exception using errcode = '22023', message = 'Falta una version valida de la ficha.';
  end if;
  v_dni := (p_datos ->> 'p_dni')::bigint;
  -- El mismo bloqueo se toma antes de comprobar y escribir. Un segundo editor espera
  -- y compara su version con los datos ya confirmados por el primero.
  perform 1 from public.personas where dni = v_dni for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'La persona no esta disponible.';
  end if;
  perform 1 from public.persona_carreras where dni = v_dni order by carrera_id for update;
  perform 1 from public.persona_situacion_revista where dni = v_dni order by situacion_id for update;
  perform 1 from public.persona_domicilios where persona_dni = v_dni and vigente_hasta is null for update;
  v_snapshot := private.legajo_edicion_snapshot(v_dni);
  if v_snapshot is null or md5(v_snapshot::text) is distinct from p_version then
    raise exception using errcode = 'P4090', message = 'La ficha cambio desde que se abrio.';
  end if;
  select * into x from jsonb_to_record(p_datos) as input(
    p_dni bigint, p_apellido text, p_nombre text, p_fecha_nacimiento date,
    p_email text, p_telefono text, p_legajo integer, p_carrera_id bigint,
    p_situacion_id bigint, p_horario_rotativo boolean, p_cuil bigint,
    p_reloj integer, p_indice text, p_sexo_id bigint, p_numero_contacto bigint,
    p_estado_civil text, p_fecha_ingreso date, p_formacion_estudio text,
    p_matricula text, p_nivel_escolaridad text, p_fecha_inicio_tarea_especifica date,
    p_observacion text, p_estado_escolaridad text, p_domicilio jsonb
  );
  perform public.rpc_persona_guardar_con_escolaridad(
    p_dni => x.p_dni, p_apellido => x.p_apellido, p_nombre => x.p_nombre,
    p_fecha_nacimiento => x.p_fecha_nacimiento, p_email => x.p_email,
    p_telefono => x.p_telefono, p_legajo => x.p_legajo, p_carrera_id => x.p_carrera_id,
    p_situacion_id => x.p_situacion_id, p_horario_rotativo => x.p_horario_rotativo,
    p_cuil => x.p_cuil, p_reloj => x.p_reloj, p_indice => x.p_indice,
    p_sexo_id => x.p_sexo_id, p_numero_contacto => x.p_numero_contacto,
    p_estado_civil => x.p_estado_civil, p_fecha_ingreso => x.p_fecha_ingreso,
    p_formacion_estudio => x.p_formacion_estudio, p_matricula => x.p_matricula,
    p_nivel_escolaridad => x.p_nivel_escolaridad,
    p_fecha_inicio_tarea_especifica => x.p_fecha_inicio_tarea_especifica,
    p_observacion => x.p_observacion, p_estado_escolaridad => x.p_estado_escolaridad,
    p_domicilio => x.p_domicilio
  );
end;
$$;

revoke all on function private.legajo_edicion_snapshot(bigint) from public, anon;
revoke all on function public.rpc_persona_ficha_edicion(bigint) from public, anon;
revoke all on function public.rpc_persona_editar_versionada(jsonb, text) from public, anon;
grant execute on function private.legajo_edicion_snapshot(bigint) to authenticated;
grant execute on function public.rpc_persona_ficha_edicion(bigint) to authenticated;
grant execute on function public.rpc_persona_editar_versionada(jsonb, text) to authenticated;
commit;
