"""Carga local de domicilios aportados por sus titulares; sin consultas web."""

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path


ARCHIVO_PREDETERMINADO = Path(__file__).resolve().with_name("domicilios-declarados.json")
CAMPOS_DOMICILIO = (
    "calle", "numero", "piso", "departamento", "localidad", "provincia",
    "codigo_postal", "origen", "fecha_declaracion", "fecha_carga_utc",
)
CAMPOS_OBLIGATORIOS = ("calle", "numero", "localidad", "provincia")


def normalizar_cuit(valor: str) -> str:
    """Exige el identificador completo, sin inferirlo del DNI ni del nombre."""
    if not isinstance(valor, str) or not re.fullmatch(r"[0-9.\s-]+", valor):
        raise ValueError("Ingresá el CUIT/CUIL completo de 11 dígitos, con o sin guiones.")
    numero = re.sub(r"[.\s-]", "", valor)
    if len(numero) != 11:
        raise ValueError("Ingresá el CUIT/CUIL completo de 11 dígitos; el DNI solo no alcanza.")
    return numero


def _validar_domicilio(datos: dict) -> dict:
    if not isinstance(datos, dict) or set(datos) != set(CAMPOS_DOMICILIO):
        raise ValueError("El registro de domicilio tiene campos faltantes o desconocidos.")
    domicilio = {}
    for campo in CAMPOS_DOMICILIO:
        valor = datos[campo]
        if valor is not None and (not isinstance(valor, str) or len(valor) > 250):
            raise ValueError(f"El campo {campo} debe ser texto de hasta 250 caracteres.")
        domicilio[campo] = (" ".join(valor.split()) or None) if valor is not None else None
    for campo in CAMPOS_OBLIGATORIOS:
        if not domicilio[campo]:
            raise ValueError(f"Falta completar {campo}.")
    if domicilio["origen"] != "declarado_por_titular":
        raise ValueError("El domicilio debe estar identificado como declarado_por_titular.")
    fecha = domicilio["fecha_declaracion"]
    if not fecha or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", fecha):
        raise ValueError("La fecha de declaración debe tener formato AAAA-MM-DD.")
    try:
        date.fromisoformat(fecha)
        carga = datetime.fromisoformat(domicilio["fecha_carga_utc"] or "")
        if carga.tzinfo is None or carga.utcoffset().total_seconds() != 0:
            raise ValueError
    except ValueError as error:
        raise ValueError("La fecha de declaración o de carga no es válida.") from error
    return domicilio


def cargar_domicilios(archivo: Path) -> dict[str, dict]:
    """Lee y valida todo el archivo antes de asociar o modificar registros."""
    try:
        contenido = json.loads(archivo.read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, UnicodeError) as error:
        raise ValueError("El archivo de domicilios no contiene JSON válido en UTF-8.") from error
    if (not isinstance(contenido, dict) or contenido.get("version") != 1
            or not isinstance(contenido.get("domicilios"), dict)):
        raise ValueError("Formato de domicilios no reconocido. Usá domicilios.py para cargar los datos.")
    registros = {}
    for numero, domicilio in contenido["domicilios"].items():
        cuit = normalizar_cuit(numero)
        if cuit in registros:
            raise ValueError("El archivo contiene registros repetidos para el mismo CUIT/CUIL.")
        registros[cuit] = _validar_domicilio(domicilio)
    return registros


def guardar_domicilio(archivo: Path, numero: str, datos: dict) -> None:
    """Conserva los demás titulares y reemplaza el archivo sólo al terminar."""
    numero = normalizar_cuit(numero)
    domicilio = _validar_domicilio(datos)
    registros = cargar_domicilios(archivo) if archivo.exists() else {}
    registros[numero] = domicilio
    contenido = json.dumps({"version": 1, "domicilios": registros}, ensure_ascii=False, indent=2) + "\n"
    archivo.parent.mkdir(parents=True, exist_ok=True)
    temporal = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=archivo.parent,
            prefix=f".{archivo.stem}-", suffix=".tmp", delete=False,
        ) as salida:
            temporal = Path(salida.name)
            salida.write(contenido)
            salida.flush()
            os.fsync(salida.fileno())
        os.replace(temporal, archivo)
    finally:
        if temporal is not None:
            temporal.unlink(missing_ok=True)


def vincular_domicilios(resultados: list[dict], registros: dict[str, dict]) -> list[dict]:
    """Agrega un dato local sin modificar el origen ni los datos del buscador."""
    vinculados = []
    for resultado in resultados:
        try:
            numero = normalizar_cuit(resultado.get("numero"))
        except ValueError:
            numero = None
        domicilio = registros.get(numero)
        vinculados.append({
            **resultado,
            "domicilio_declarado": dict(domicilio) if domicilio is not None else None,
        })
    return vinculados


def aplanar_domicilio(resultado: dict) -> dict:
    """Columnas propias para CSV/texto, separadas de la provincia del buscador."""
    if "domicilio_declarado" not in resultado:
        return resultado
    fila = dict(resultado)
    domicilio = fila.pop("domicilio_declarado") or {}
    fila.update({f"domicilio_declarado_{campo}": domicilio.get(campo) for campo in CAMPOS_DOMICILIO})
    return fila


def main() -> int:
    parser = argparse.ArgumentParser(description="Carga un domicilio aportado por su titular en un archivo local.")
    parser.add_argument("cuit", nargs="?", help="CUIT/CUIL completo; si se omite, se solicita por consola")
    parser.add_argument("--archivo", type=Path, default=ARCHIVO_PREDETERMINADO,
                        help="archivo local (por defecto domicilios-declarados.json junto al programa)")
    args = parser.parse_args()
    try:
        registros = cargar_domicilios(args.archivo) if args.archivo.exists() else {}
        print("Domicilio aportado por el titular. Ctrl+C cancela sin guardar.")
        numero = normalizar_cuit(args.cuit or input("CUIT/CUIL completo (11 dígitos): "))
        if numero in registros:
            print("Ya tiene un domicilio cargado; esta carga lo actualizará al finalizar.")
        datos = {}
        for campo, etiqueta in (
            ("calle", "Calle"), ("numero", "Número (o S/N)"),
            ("piso", "Piso (opcional)"), ("departamento", "Departamento (opcional)"),
            ("localidad", "Localidad"), ("provincia", "Provincia"),
            ("codigo_postal", "Código postal (opcional)"),
        ):
            datos[campo] = input(f"{etiqueta}: ").strip() or None
        hoy = date.today().isoformat()
        datos["fecha_declaracion"] = input(f"Fecha de declaración (AAAA-MM-DD, Enter = {hoy}): ").strip() or hoy
        datos["origen"] = "declarado_por_titular"
        datos["fecha_carga_utc"] = datetime.now(timezone.utc).isoformat()
        guardar_domicilio(args.archivo, numero, datos)
        print(f"Domicilio declarado guardado en {args.archivo.resolve()}")
    except (EOFError, KeyboardInterrupt):
        print("\nCarga cancelada; no se guardaron cambios.", file=sys.stderr)
        return 1
    except (ValueError, OSError) as error:
        print(f"Domicilio no guardado: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
