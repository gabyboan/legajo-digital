from __future__ import annotations

import csv
import pathlib
import re

import fitz


PDF_PATH = pathlib.Path(r"C:\Users\som\Documents\francos horas totales.pdf")
OUTPUT_DIR = pathlib.Path("supabase/imports")
LOAD_DATE = "2026-06-23"


def parse_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []

    for page_number, page in enumerate(fitz.open(PDF_PATH), start=1):
        words: list[tuple[float, float, float, str]] = []

        for x0, y0, x1, y1, text, *_ in page.get_text("words"):
            y_center = (y0 + y1) / 2

            min_y = 90 if page_number == 1 else 50
            if y_center < min_y:
                continue

            if text in {"DNI", "Reloj", "Apellido", "y", "Nombres", "HORAS", "MINUTO", "S"}:
                continue

            words.append((y_center, x0, x1, text.strip()))

        words.sort()
        clusters: list[dict[str, object]] = []

        for word in words:
            y_center = word[0]

            if not clusters or abs(y_center - float(clusters[-1]["y_center"])) > 8:
                clusters.append({"y_center": y_center, "words": [word]})
                continue

            cluster_words = clusters[-1]["words"]
            assert isinstance(cluster_words, list)
            cluster_words.append(word)
            clusters[-1]["y_center"] = (
                float(clusters[-1]["y_center"]) * (len(cluster_words) - 1) + y_center
            ) / len(cluster_words)

        for cluster in clusters:
            cluster_words = cluster["words"]
            assert isinstance(cluster_words, list)

            dni = ""
            reloj = ""
            name_parts: list[str] = []
            horas: int | None = None
            minutos: int | None = None
            notes: list[str] = []

            for _, x0, _, text in sorted(cluster_words, key=lambda item: item[1]):
                if x0 < 120 and re.fullmatch(r"\d{1,3}(?:\.\d{3})+|\d{7,8}", text):
                    dni = text.replace(".", "")
                    continue

                if x0 < 175 and (re.fullmatch(r"\d+", text) or text == "-"):
                    reloj = text
                    continue

                glued_hour = re.fullmatch(r"(.+?)(-?\d+)", text)
                if (
                    glued_hour
                    and re.search(r"[A-Za-zÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã±]", glued_hour.group(1))
                    and horas is None
                ):
                    name_parts.append(glued_hour.group(1))
                    horas = int(glued_hour.group(2))
                    notes.append("hora_pegada_al_nombre")
                    continue

                if re.fullmatch(r"-?\d+", text):
                    value = int(text)

                    if horas is None and x0 >= 245:
                        horas = value
                    elif horas is not None and minutos is None and x0 >= 300:
                        minutos = value
                    elif horas is None and x0 >= 280:
                        horas = value
                    else:
                        name_parts.append(text)
                        notes.append("numero_en_nombre")

                    continue

                name_parts.append(text)

            if not dni and not reloj and not name_parts and horas is None and minutos is None:
                continue

            horas = 0 if horas is None else horas
            minutos = 0 if minutos is None else minutos

            if not 0 <= abs(minutos) <= 59:
                notes.append("minutos_fuera_de_rango")

            total_minutos = horas * 60 + (-minutos if horas < 0 else minutos)

            rows.append(
                {
                    "page": page_number,
                    "dni": dni,
                    "reloj": reloj,
                    "apellido_nombres": " ".join(name_parts),
                    "horas": horas,
                    "minutos": minutos,
                    "total_minutos": total_minutos,
                    "notes": ";".join(notes),
                }
            )

    return rows


def write_outputs(rows: list[dict[str, object]]) -> tuple[pathlib.Path, pathlib.Path]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = OUTPUT_DIR / "francos_horas_totales_2026-06-23.csv"
    sql_path = OUTPUT_DIR / "cargar_banco_inicial_francos_2026-06-23.sql"

    fieldnames = [
        "page",
        "dni",
        "reloj",
        "apellido_nombres",
        "horas",
        "minutos",
        "total_minutos",
        "notes",
    ]

    with csv_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    values: list[str] = []
    for row in rows:
        if not row["dni"]:
            continue

        name = str(row["apellido_nombres"]).replace("'", "''")
        notes = str(row["notes"]).replace("'", "''")
        values.append(
            "    "
            f"({row['dni']}, {row['horas']}, {row['minutos']}, "
            f"{row['total_minutos']}, '{name}', '{notes}')"
        )

    sql_path.write_text(
        f"""-- Carga inicial de banco de horas desde C:/Users/som/Documents/francos horas totales.pdf
-- Fecha solicitada: {LOAD_DATE}
-- Convencion: celdas vacias de horas/minutos = 0. Los saldos 0 se incluyen para dejar registro explicito.
-- Revisar primero el CSV hermano: supabase/imports/francos_horas_totales_2026-06-23.csv

begin;

create temp table tmp_banco_inicial_francos_pdf (
  dni integer not null,
  horas integer not null,
  minutos_resto integer not null,
  total_minutos integer not null,
  apellido_nombres text not null,
  notas text not null
) on commit drop;

insert into tmp_banco_inicial_francos_pdf
  (dni, horas, minutos_resto, total_minutos, apellido_nombres, notas)
values
{",\n".join(values)};

-- Control previo: estas filas no se cargan porque no tienen persona/carrera actual asociada.
select t.*
from tmp_banco_inicial_francos_pdf t
left join public.persona_carreras pc on pc.dni = t.dni
where pc.dni is null
order by t.apellido_nombres;

-- Ejecutar la carga. Si la RPC reemplaza el saldo vigente por persona/carrera,
-- esto es idempotente para la fecha/minutos indicados.
do $$
declare
  r record;
begin
  for r in
    select t.dni, pc.carrera_id, t.total_minutos, t.apellido_nombres, t.notas
    from tmp_banco_inicial_francos_pdf t
    join public.persona_carreras pc on pc.dni = t.dni
  loop
    perform public.rpc_francos_saldo_inicial(
      r.dni,
      r.carrera_id,
      date '{LOAD_DATE}',
      r.total_minutos,
      nullif(concat_ws(' | ', 'Carga PDF francos horas totales', r.apellido_nombres, nullif(r.notas, '')), '')
    );
  end loop;
end $$;

commit;
""",
        encoding="utf-8",
    )

    return csv_path, sql_path


def main() -> None:
    rows = parse_rows()
    csv_path, sql_path = write_outputs(rows)

    notes = sorted({note for row in rows for note in str(row["notes"]).split(";") if note})
    print(f"rows {len(rows)}")
    print(f"with_dni {sum(1 for row in rows if row['dni'])}")
    print(f"missing_dni {sum(1 for row in rows if not row['dni'])}")
    print(f"zero_total {sum(1 for row in rows if row['total_minutos'] == 0)}")
    print(f"notes {notes}")
    print(csv_path)
    print(sql_path)


if __name__ == "__main__":
    main()



