set legajo_test.auth = 'on';
set legajo_test.edit = 'on';
do $test$
declare
  v_domicilio jsonb := '{"calle":"Calle ficticia","numero":"007","casa":"A","torre":"02","piso":"0","departamento":"B","provincia_nombre":"Provincia ficticia","localidad_nombre":"Localidad ficticia"}';
  v_total integer;
begin
  -- Alta y guardado de Casa/Torre, incluido piso cero y ceros iniciales.
  perform public.rpc_persona_guardar(12345678, 'Persona', 'Ficticia', null, null, null, null, 1, 1, p_domicilio => v_domicilio);
  if not exists(select 1 from public.persona_domicilios where vigente_hasta is null
    and casa = 'A' and torre = '02' and numero = '007' and piso = '0') then
    raise exception 'No se guardaron todos los campos';
  end if;
  -- Misma direccion no genera historial artificial.
  perform public.rpc_persona_guardar(12345678, 'Persona', 'Ficticia', null, null, null, null, 1, 1, p_domicilio => v_domicilio);
  select count(*) into v_total from public.persona_domicilios;
  if v_total <> 1 then raise exception 'Se duplico un domicilio sin cambios'; end if;
  -- Clientes anteriores no envian Casa ni Torre: ambos deben sobrevivir.
  v_domicilio := (v_domicilio - 'casa' - 'torre') || '{"numero":"008"}';
  perform public.rpc_persona_guardar(12345678, 'Persona', 'Ficticia', null, null, null, null, 1, 1, p_domicilio => v_domicilio);
  if not exists(select 1 from public.persona_domicilios where vigente_hasta is null
    and casa = 'A' and torre = '02' and numero = '008' and localidad_nombre = 'Localidad ficticia') then
    raise exception 'Un cliente anterior perdio datos de la direccion';
  end if;
  if not exists(select 1 from public.persona_domicilios where vigente_hasta is not null
    and casa = 'A' and torre = '02' and numero = '007') then
    raise exception 'No se conservo el historial anterior';
  end if;
  -- Otra seccion con p_domicilio null no modifica ni versiona la direccion.
  perform public.rpc_persona_guardar(12345678, 'Persona', 'Ficticia', null, null, null, null, 1, 1);
  select count(*) into v_total from public.persona_domicilios;
  if v_total <> 2 then raise exception 'Guardar otra seccion modifico el domicilio'; end if;
  -- Casa y Torre admiten cambios explicitos.
  v_domicilio := v_domicilio || '{"casa":" C ","torre":"03"}';
  perform public.rpc_persona_guardar(12345678, 'Persona', 'Ficticia', null, null, null, null, 1, 1, p_domicilio => v_domicilio);
  if not exists(select 1 from public.persona_domicilios where vigente_hasta is null and casa = 'C' and torre = '03') then
    raise exception 'No se actualizo Casa/Torre';
  end if;
  v_domicilio := v_domicilio || '{"casa":null,"torre":null}';
  perform public.rpc_persona_guardar(12345678, 'Persona', 'Ficticia', null, null, null, null, 1, 1, p_domicilio => v_domicilio);
  if not exists(select 1 from public.persona_domicilios where vigente_hasta is null and casa is null and torre is null) then
    raise exception 'No se permite limpiar explicitamente Casa/Torre';
  end if;
  -- Un domicilio formado solo por Casa tambien cuenta como direccion.
  perform public.rpc_persona_guardar(12345679, 'Otra', 'Ficticia', null, null, null, null, 1, 1, p_domicilio => '{"casa":"Solo casa"}');
  if not exists(select 1 from public.persona_domicilios where persona_dni = 12345679 and vigente_hasta is null and casa = 'Solo casa') then
    raise exception 'No se reconocio un domicilio formado solo por Casa';
  end if;
  -- Se conservan los controles de identidad y permiso de la funcion original.
  perform set_config('legajo_test.auth', 'off', true);
  begin
    perform public.rpc_persona_guardar(12345678, 'No', 'Autorizada', null, null, null, null, 1, 1);
    raise exception 'Se permitio guardar sin autenticacion';
  exception when raise_exception then
    if sqlerrm <> 'No autenticado.' then raise; end if;
  end;
  perform set_config('legajo_test.auth', 'on', true);
  perform set_config('legajo_test.edit', 'off', true);
  begin
    perform public.rpc_persona_guardar(12345678, 'No', 'Autorizada', null, null, null, null, 1, 1);
    raise exception 'Se permitio guardar sin permiso';
  exception when raise_exception then
    if sqlerrm <> 'Sin permiso para editar legajos.' then raise; end if;
  end;
  if exists(select 1 from public.personas where apellido = 'No') then
    raise exception 'Un intento no autorizado modifico personas';
  end if;
end;
$test$;
