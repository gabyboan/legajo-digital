CREATE OR REPLACE FUNCTION public.rpc_persona_guardar_con_escolaridad(p_dni bigint, p_apellido text, p_nombre text, p_fecha_nacimiento date, p_email text, p_telefono text, p_legajo integer, p_carrera_id bigint, p_situacion_id bigint, p_horario_rotativo boolean DEFAULT NULL::boolean, p_cuil bigint DEFAULT NULL::bigint, p_reloj integer DEFAULT NULL::integer, p_indice text DEFAULT NULL::text, p_sexo_id bigint DEFAULT NULL::bigint, p_numero_contacto bigint DEFAULT NULL::bigint, p_estado_civil text DEFAULT NULL::text, p_fecha_ingreso date DEFAULT NULL::date, p_formacion_estudio text DEFAULT NULL::text, p_matricula text DEFAULT NULL::text, p_nivel_escolaridad text DEFAULT NULL::text, p_fecha_inicio_tarea_especifica date DEFAULT NULL::date, p_observacion text DEFAULT NULL::text, p_estado_escolaridad text DEFAULT NULL::text, p_domicilio jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if p_estado_escolaridad is not null
    and p_estado_escolaridad not in ('completo', 'incompleto', 'en curso') then
    raise exception 'Estado de escolaridad invalido.';
  end if;

  perform public.rpc_persona_guardar(
    p_dni,
    p_apellido,
    p_nombre,
    p_fecha_nacimiento,
    p_email,
    p_telefono,
    p_legajo,
    p_carrera_id,
    p_situacion_id,
    p_horario_rotativo,
    p_cuil,
    p_reloj,
    p_indice,
    p_sexo_id,
    p_numero_contacto,
    p_estado_civil,
    p_fecha_ingreso,
    p_formacion_estudio,
    left(nullif(btrim(p_matricula), ''), 10),
    p_nivel_escolaridad,
    p_fecha_inicio_tarea_especifica,
    p_observacion,
    p_domicilio
  );

  update public.personas
  set estado_escolaridad = nullif(btrim(p_estado_escolaridad), '')
  where dni = p_dni;
end;
$function$
;
