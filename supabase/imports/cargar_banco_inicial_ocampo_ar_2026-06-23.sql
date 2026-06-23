-- Carga puntual de banco inicial para Ocampo Ar
-- Fecha solicitada: 2026-06-23
-- DNI: 29346760
-- Saldo: 163:00 hs = 9780 minutos

begin;

with source_row as (
  select
    29346760::integer as dni,
    pc.carrera_id,
    date '2026-06-23' as fecha,
    date_trunc('month', date '2026-06-23')::date as periodo,
    9780::integer as minutos,
    null::text as observacion
  from public.persona_carreras pc
  where pc.dni = 29346760
), current_row as (
  select distinct on (fm.dni, fm.carrera_id)
    fm.id,
    fm.dni,
    fm.carrera_id
  from public.francos_movimientos fm
  join source_row s
    on s.dni = fm.dni
   and s.carrera_id = fm.carrera_id
  where fm.motivo = 'saldo_inicial'
    and fm.anulado = false
  order by fm.dni, fm.carrera_id, fm.fecha desc, fm.id desc
), updated as (
  update public.francos_movimientos fm
  set fecha = s.fecha,
      periodo = s.periodo,
      minutos = s.minutos,
      observacion = s.observacion,
      anulado = false,
      usuario_modifica = 'de9e581f-7906-457d-b422-8010139ca038'::uuid,
      updated_at = now()
  from source_row s
  join current_row c
    on c.dni = s.dni
   and c.carrera_id = s.carrera_id
  where fm.id = c.id
  returning fm.id
)
insert into public.francos_movimientos (
  dni,
  carrera_id,
  fecha,
  periodo,
  minutos,
  motivo,
  observacion,
  usuario_carga
)
select
  s.dni,
  s.carrera_id,
  s.fecha,
  s.periodo,
  s.minutos,
  'saldo_inicial',
  s.observacion,
  'de9e581f-7906-457d-b422-8010139ca038'::uuid
from source_row s
where not exists (select 1 from updated);

select
  fm.dni,
  fm.carrera_id,
  fm.fecha,
  fm.minutos,
  fm.minutos / 60 as horas,
  fm.minutos % 60 as minutos_resto,
  fm.motivo,
  fm.anulado
from public.francos_movimientos fm
where fm.dni = 29346760
  and fm.motivo = 'saldo_inicial'
order by fm.fecha desc, fm.id desc;

commit;
