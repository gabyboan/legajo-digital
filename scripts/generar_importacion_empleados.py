from __future__ import annotations

import argparse
from datetime import date, timedelta
from pathlib import Path
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile


SHEET_CONFIG = {
    "Titulares y Sup Ext": {
        "priority": 300,
        "columns": {
            "legajo": 1, "dni": 2, "cuil": 3, "reloj": 4, "indice": 5,
            "nombre_completo": 6, "carrera": 9, "situacion": 12, "sexo": 13,
            "domicilio": 14, "fecha_nacimiento": 15, "fecha_ingreso": 17,
            "formacion_estudio": 18, "matricula": 19, "email": 20,
            "turno": 21, "dias": 22, "nivel_escolaridad": 23,
            "fecha_inicio_tarea_especifica": 24, "observacion": 25,
            "estado_civil": 26, "numero_contacto": 27,
        },
    },
    "Suplente Ord": {
        "priority": 200,
        "columns": {
            "legajo": 1, "dni": 2, "cuil": 3, "reloj": 4, "indice": 5,
            "nombre_completo": 6, "carrera": 9, "situacion": 12, "sexo": 13,
            "domicilio": 14, "fecha_nacimiento": 15, "fecha_ingreso": 17,
            "formacion_estudio": 18, "matricula": 19, "email": 20,
            "turno": 21, "dias": 22, "nivel_escolaridad": 23,
            "fecha_inicio_tarea_especifica": 24, "observacion": 25,
            "estado_civil": 26, "numero_contacto": 27,
        },
    },
    "RISaMC": {
        "priority": 100,
        "columns": {
            "legajo": 1, "dni": 2, "cuil": 3, "reloj": 4,
            "nombre_completo": 5, "situacion": 8, "sexo": 10, "domicilio": 11,
            "email": 12, "fecha_nacimiento": 13, "fecha_ingreso": 15,
            "formacion_estudio": 16, "matricula": 17, "turno": 18, "dias": 19,
            "nivel_escolaridad": 20, "observacion": 21,
        },
        "defaults": {"carrera": "RISaMC"},
    },
}
NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def cell_text(element: ET.Element | None) -> str:
    return "".join(element.itertext()) if element is not None else ""


def column_number(reference: str) -> int:
    match = re.match(r"[A-Z]+", reference)
    if not match:
        raise ValueError(f"Invalid cell reference: {reference}")
    number = 0
    for character in match.group(0):
        number = number * 26 + ord(character) - 64
    return number


def load_sheets(path: Path) -> dict[str, list[dict[int, str]]]:
    with ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [cell_text(item) for item in shared_root.findall("m:si", NS)]

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        sheets: dict[str, list[dict[int, str]]] = {}

        for sheet in workbook.find("m:sheets", NS) or []:
            name = sheet.attrib["name"]
            relationship_id = sheet.attrib[
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            ]
            target = targets[relationship_id]
            sheet_path = "xl/" + target.lstrip("/")
            root = ET.fromstring(archive.read(sheet_path))
            rows: list[dict[int, str]] = []
            for row in root.findall(".//m:sheetData/m:row", NS):
                record: dict[int, str] = {}
                for cell in row.findall("m:c", NS):
                    value_node = cell.find("m:v", NS)
                    inline_node = cell.find("m:is", NS)
                    value = cell_text(inline_node) if inline_node is not None else (
                        value_node.text if value_node is not None else ""
                    )
                    if cell.attrib.get("t") == "s" and value:
                        value = shared[int(value)]
                    record[column_number(cell.attrib["r"])] = value.strip()
                if record:
                    rows.append(record)
            sheets[name] = rows
    return sheets


def cleaned(value: str | None) -> str | None:
    value = (value or "").strip()
    return None if not value or value.casefold() in {"-", "no informado"} else value


def integer(value: str | None, digits: int | None = None) -> int | None:
    value = re.sub(r"\D", "", value or "")
    if not value or (digits is not None and len(value) != digits):
        return None
    return int(value)


def excel_date(value: str | None, earliest: date = date(1900, 1, 1)) -> str | None:
    try:
        serial = int(float(value or ""))
    except ValueError:
        return None
    parsed = date(1899, 12, 30) + timedelta(days=serial)
    return parsed.isoformat() if earliest <= parsed <= date.today() else None


def split_name(value: str | None) -> tuple[str, str] | None:
    parts = (value or "").strip().split()
    return (parts[0], " ".join(parts[1:])) if len(parts) >= 2 else None


def sql_literal(value: object | None) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def source_rows(source: Path) -> list[dict[str, object]]:
    sheets = load_sheets(source)
    rows: list[dict[str, object]] = []

    for sheet_name, config in SHEET_CONFIG.items():
        for row in sheets[sheet_name][1:]:
            values = {field: row.get(column, "") for field, column in config["columns"].items()}
            values.update(config.get("defaults", {}))
            dni = integer(values.get("dni"), 8)
            name = split_name(values.get("nombre_completo"))
            if dni is None or name is None:
                continue

            email = cleaned(values.get("email"))
            if email and "@" not in email:
                email = None
            turno = cleaned(values.get("turno"))
            rows.append({
                "dni": dni,
                "apellido": name[0],
                "nombre": name[1],
                "legajo": integer(values.get("legajo")) or None,
                "cuil": integer(values.get("cuil"), 11),
                "reloj": integer(values.get("reloj")) or None,
                "indice": cleaned(values.get("indice")),
                "carrera": cleaned(values.get("carrera")) or "Sin clasificar",
                "situacion": cleaned(values.get("situacion")) or "Sin clasificar",
                "sexo": cleaned(values.get("sexo")),
                "domicilio": cleaned(values.get("domicilio")),
                "fecha_nacimiento": excel_date(values.get("fecha_nacimiento")),
                "fecha_ingreso": excel_date(values.get("fecha_ingreso")),
                "formacion_estudio": cleaned(values.get("formacion_estudio")),
                "matricula": cleaned(values.get("matricula")),
                "email": email,
                "turno": turno,
                "dias": cleaned(values.get("dias")),
                "nivel_escolaridad": cleaned(values.get("nivel_escolaridad")),
                "fecha_inicio_tarea_especifica": excel_date(values.get("fecha_inicio_tarea_especifica")),
                "observacion": cleaned(values.get("observacion")),
                "estado_civil": cleaned(values.get("estado_civil")),
                "numero_contacto": integer(values.get("numero_contacto")) or None,
                "horario_rotativo": bool(turno and ("rotativ" in turno.casefold() or "3 turno" in turno.casefold())),
                "source_sheet": sheet_name,
                "priority": config["priority"],
            })

    by_dni: dict[int, dict[str, object]] = {}
    for row in rows:
        current = by_dni.get(row["dni"])
        if current is None or row["priority"] > current["priority"]:
            by_dni[row["dni"]] = row
    return sorted(by_dni.values(), key=lambda row: row["dni"])


def migration_sql(rows: list[dict[str, object]]) -> str:
    fields = [
        "dni", "apellido", "nombre", "legajo", "cuil", "reloj", "indice", "carrera",
        "situacion", "sexo", "domicilio", "fecha_nacimiento", "fecha_ingreso",
        "formacion_estudio", "matricula", "email", "turno", "dias", "nivel_escolaridad",
        "fecha_inicio_tarea_especifica", "observacion", "estado_civil", "numero_contacto",
        "horario_rotativo", "source_sheet", "priority",
    ]
    values = ",\n    ".join(
        "(" + ", ".join(sql_literal(row[field]) for field in fields) + ")" for row in rows
    )
    return f'''-- Fuente: archivo Excel local (origen no incluido).
-- Alcance deliberado: nÃ³minas vigentes. No procesa bajas, cortes ni pases.
-- La migraciÃ³n es idempotente por DNI y conserva los valores existentes cuando
-- el Excel no provee un dato vÃ¡lido. Los domicilios detallados no se reemplazan.

create temp table importacion_empleados_vigentes (
  dni bigint not null,
  apellido text not null,
  nombre text not null,
  legajo integer,
  cuil bigint,
  reloj integer,
  indice text,
  carrera text not null,
  situacion text not null,
  sexo text,
  domicilio text,
  fecha_nacimiento date,
  fecha_ingreso date,
  formacion_estudio text,
  matricula text,
  email text,
  turno text,
  dias text,
  nivel_escolaridad text,
  fecha_inicio_tarea_especifica date,
  observacion text,
  estado_civil text,
  numero_contacto bigint,
  horario_rotativo boolean not null,
  source_sheet text not null,
  priority integer not null
) on commit drop;

insert into importacion_empleados_vigentes ({", ".join(fields)}) values
    {values};

-- CatÃ¡logos necesarios para los valores presentes en el archivo fuente.
insert into public.carreras (nombre)
select distinct source.carrera
from importacion_empleados_vigentes source
where not exists (
  select 1 from public.carreras carrera
  where lower(translate(trim(carrera.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) =
        lower(translate(trim(source.carrera), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'))
);

insert into public.situacion_revista (nombre)
select distinct case
  when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%titular%' then 'Titular'
  when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ext%' then 'Suplente Extraordinario'
  when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ord%' then 'Suplente Ordinario'
  when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%residente%' then 'Residente'
  else initcap(lower(trim(source.situacion)))
end
from importacion_empleados_vigentes source
where not exists (
  select 1 from public.situacion_revista situacion
  where lower(translate(trim(situacion.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) =
    lower(translate(trim(case
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%titular%' then 'Titular'
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ext%' then 'Suplente Extraordinario'
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ord%' then 'Suplente Ordinario'
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%residente%' then 'Residente'
      else initcap(lower(trim(source.situacion)))
    end), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'))
);

insert into public.sexos (nombre)
select distinct case
  when lower(source.sexo) like 'fem%' then 'Femenino'
  when lower(source.sexo) like 'mas%' then 'Masculino'
end
from importacion_empleados_vigentes source
where source.sexo is not null
  and not exists (
    select 1 from public.sexos sexo
    where lower(translate(trim(sexo.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) =
      case when lower(source.sexo) like 'fem%' then 'femenino' else 'masculino' end
  );

with mapped as (
  select
    source.*,
    carrera.id as carrera_id,
    situacion.id as situacion_id,
    sexo.id as sexo_id
  from importacion_empleados_vigentes source
  join public.carreras carrera
    on lower(translate(trim(carrera.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) =
       lower(translate(trim(source.carrera), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'))
  join public.situacion_revista situacion
    on lower(translate(trim(situacion.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) =
       lower(translate(trim(case
         when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%titular%' then 'Titular'
         when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ext%' then 'Suplente Extraordinario'
         when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ord%' then 'Suplente Ordinario'
         when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%residente%' then 'Residente'
         else initcap(lower(trim(source.situacion)))
       end), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'))
  left join public.sexos sexo
    on (lower(source.sexo) like 'fem%' and lower(translate(trim(sexo.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) = 'femenino')
    or (lower(source.sexo) like 'mas%' and lower(translate(trim(sexo.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) = 'masculino')
)
insert into public.personas as persona (
  dni, apellido, nombre, legajo, cuil, reloj, indice, fecha_nacimiento,
  fecha_ingreso, formacion_estudio, matricula, email, nivel_escolaridad,
  observacion, estado_civil, numero_contacto, horario_rotativo, sexo_id
)
select
  dni, apellido, nombre, legajo, cuil, reloj, indice, fecha_nacimiento,
  fecha_ingreso, formacion_estudio, matricula, email, nivel_escolaridad,
  observacion, estado_civil, numero_contacto, horario_rotativo, sexo_id
from mapped
on conflict (dni) do update set
  apellido = excluded.apellido,
  nombre = excluded.nombre,
  legajo = coalesce(excluded.legajo, persona.legajo),
  cuil = coalesce(excluded.cuil, persona.cuil),
  reloj = coalesce(excluded.reloj, persona.reloj),
  indice = coalesce(excluded.indice, persona.indice),
  fecha_nacimiento = coalesce(excluded.fecha_nacimiento, persona.fecha_nacimiento),
  fecha_ingreso = coalesce(excluded.fecha_ingreso, persona.fecha_ingreso),
  formacion_estudio = coalesce(excluded.formacion_estudio, persona.formacion_estudio),
  matricula = coalesce(excluded.matricula, persona.matricula),
  email = coalesce(excluded.email, persona.email),
  nivel_escolaridad = coalesce(excluded.nivel_escolaridad, persona.nivel_escolaridad),
  observacion = coalesce(excluded.observacion, persona.observacion),
  estado_civil = coalesce(excluded.estado_civil, persona.estado_civil),
  numero_contacto = coalesce(excluded.numero_contacto, persona.numero_contacto),
  horario_rotativo = excluded.horario_rotativo or persona.horario_rotativo,
  sexo_id = coalesce(excluded.sexo_id, persona.sexo_id),
  updated_at = now();

with mapped as (
  select source.dni, carrera.id as carrera_id, situacion.id as situacion_id
  from importacion_empleados_vigentes source
  join public.carreras carrera
    on lower(translate(trim(carrera.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) = lower(translate(trim(source.carrera), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'))
  join public.situacion_revista situacion
    on lower(translate(trim(situacion.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) = lower(translate(trim(case
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%titular%' then 'Titular'
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ext%' then 'Suplente Extraordinario'
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ord%' then 'Suplente Ordinario'
      when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%residente%' then 'Residente'
      else initcap(lower(trim(source.situacion)))
    end), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'))
)
insert into public.persona_carreras (dni, carrera_id)
select dni, carrera_id from mapped
on conflict (dni) do update
set carrera_id = excluded.carrera_id
where not exists (
  select 1
  from public.francos_movimientos movimiento
  where movimiento.dni = persona_carreras.dni
    and movimiento.carrera_id = persona_carreras.carrera_id
);

delete from public.persona_situacion_revista relation
using importacion_empleados_vigentes source
where relation.dni = source.dni;

insert into public.persona_situacion_revista (dni, situacion_id)
select source.dni, situacion.id
from importacion_empleados_vigentes source
join public.situacion_revista situacion
  on lower(translate(trim(situacion.nombre), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) = lower(translate(trim(case
    when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%titular%' then 'Titular'
    when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ext%' then 'Suplente Extraordinario'
    when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%ord%' then 'Suplente Ordinario'
    when lower(translate(source.situacion, 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun')) like '%residente%' then 'Residente'
    else initcap(lower(trim(source.situacion)))
  end), 'Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±', 'aeiouun'));

insert into public.persona_domicilios (persona_dni, otros_datos)
select source.dni, source.domicilio
from importacion_empleados_vigentes source
where source.domicilio is not null
  and not exists (
    select 1 from public.persona_domicilios domicilio
    where domicilio.persona_dni = source.dni and domicilio.vigente_hasta is null
  );
'''


_migration_sql_with_original_encoding = migration_sql


def migration_sql(rows: list[dict[str, object]]) -> str:
    """Return ASCII-safe SQL regardless of terminal encoding."""
    sql = _migration_sql_with_original_encoding(rows)
    sql = re.sub(
        r"translate\((.+?), '[^']*', 'aeiouun'\)",
        r"\1",
        sql,
        flags=re.DOTALL,
    )
    sql = re.sub(r", '[^']*', 'aeiouun'(?=\)\))", "", sql)
    sql = sql.replace("end)))", "end))")
    sequence_sync = """
-- Align identity sequences before adding any missing catalog values.
select setval(pg_get_serial_sequence('public.carreras', 'id'), coalesce(max(id), 1), coalesce(max(id), 0) > 0) from public.carreras;
select setval(pg_get_serial_sequence('public.situacion_revista', 'id'), coalesce(max(id), 1), coalesce(max(id), 0) > 0) from public.situacion_revista;
select setval(pg_get_serial_sequence('public.sexos', 'id'), coalesce(max(id), 1), coalesce(max(id), 0) > 0) from public.sexos;
"""
    sql = sql.replace("\n-- Cat", sequence_sync + "\n-- Cat", 1)
    return sql.replace(
        "lower(translate(source.situacion) like",
        "lower(source.situacion) like",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generar una importación SQL desde un Excel local; no ejecuta SQL.")
    parser.add_argument("target", type=Path, help="Archivo SQL de salida (mantener fuera de Git)")
    parser.add_argument("--source", required=True, type=Path, help="Excel de origen")
    args = parser.parse_args()
    target = args.target
    rows = source_rows(args.source)
    if not rows:
        raise SystemExit("No se encontraron personas importables.")
    target.write_text(migration_sql(rows), encoding="utf-8", newline="\n")
    print(f"Generadas {len(rows)} personas Ãºnicas en {target}")


if __name__ == "__main__":
    main()
