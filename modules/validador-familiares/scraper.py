"""Consulta puntual de datos en CuitOnline, Nosis y Dateas.

Uso:
    python scraper.py <dni>
    python scraper.py <dni> --visible
    python scraper.py "EMPRESA EJEMPLO" --fuente nosis --formato json
    python scraper.py <dni>789 --fuente dateas --salida resultados.csv

La fuente puede cambiar su HTML, limitar consultas o solicitar interacción
humana. Esos casos se informan explícitamente: este programa no intenta
sortear bloqueos, CAPTCHAs ni condiciones de uso del sitio.
"""

import argparse
import asyncio
import csv
import io
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from playwright.async_api import Error as PlaywrightError

from comparador import comparar_fuentes, filas_comparacion, resumen_comparacion
from domicilios import aplanar_domicilio, cargar_domicilios, vincular_domicilios
from fuentes import (
    FuenteError, NAVEGADORES, NAVEGADOR_PREDETERMINADO, PATRON_RESULTADO,
    ResultadoPublico, consultar_datos, normalizar_consulta,
)


BASE_URL = "https://www.cuitonline.com"

class ConsultaError(RuntimeError):
    """La fuente no permitió obtener un resultado utilizable."""


@dataclass(frozen=True)
class Resultado:
    dni: str
    nombre: str
    tipo: str
    numero: str
    url_fuente: str


class ConsultaAmbigua(ConsultaError):
    """La API de resultado único encontró varios candidatos para el DNI."""

    def __init__(self, resultados: list[Resultado]):
        self.resultados = resultados
        super().__init__(
            f"El DNI tiene {len(resultados)} coincidencias. "
            "Usá consultar_cuits para obtenerlas todas y revisarlas."
        )


def normalizar_dni(valor: str) -> str:
    dni, clase = normalizar_consulta(valor)
    if clase != "dni":
        raise ValueError("El DNI debe tener 7 u 8 dígitos.")
    return dni


def normalizar_identificador(numero: str) -> str:
    digitos = re.sub(r"\D", "", numero)
    return f"{digitos[:2]}-{digitos[2:10]}-{digitos[10:]}"


async def consultar_cuits(dni_busqueda: str, *, headless: bool = True,
                          timeout=30, espera_manual=0, diagnostico=None,
                          navegador=NAVEGADOR_PREDETERMINADO) -> list[Resultado]:
    """Devuelve todos los CUIT/CUIL coincidentes, con el formato de CuitOnline."""
    dni = normalizar_dni(dni_busqueda)
    try:
        resultados = await consultar_datos(
            dni, fuente="cuitonline", headless=headless, timeout=timeout,
            espera_manual=espera_manual, diagnostico=diagnostico,
            navegador=navegador,
        )
    except FuenteError as error:
        raise ConsultaError(str(error)) from error
    return [Resultado(dni, r.nombre, r.tipo, r.numero, r.url_fuente) for r in resultados]


async def consultar_cuit(dni_busqueda: str, *, headless: bool = True,
                         timeout=30, espera_manual=0, diagnostico=None,
                         navegador=NAVEGADOR_PREDETERMINADO) -> Resultado:
    """Devuelve un resultado único o informa que hace falta revisar candidatos."""
    resultados = await consultar_cuits(
        dni_busqueda, headless=headless, timeout=timeout, espera_manual=espera_manual,
        diagnostico=diagnostico, navegador=navegador,
    )
    if not resultados:
        raise ConsultaError("No se encontró una persona para ese DNI en la fuente.")
    if len(resultados) > 1:
        raise ConsultaAmbigua(resultados)
    return resultados[0]


def serializar(resultados: list[dict], formato: str) -> str:
    if formato == "json":
        return json.dumps(resultados, ensure_ascii=False, indent=2) + "\n"
    resultados = [aplanar_domicilio(r) for r in resultados]
    if formato == "csv":
        salida = io.StringIO(newline="")
        columnas = list(dict.fromkeys(k for r in resultados for k in r)) if resultados else list(ResultadoPublico.__dataclass_fields__)
        writer = csv.DictWriter(salida, fieldnames=columnas)
        writer.writeheader()
        for resultado in resultados:
            # Evita que una celda publicada por un sitio se ejecute como fórmula en Excel.
            writer.writerow({k: ("'" + v if isinstance(v, str) and v.lstrip().startswith(
                ("=", "+", "-", "@")
            ) else v) for k, v in resultado.items()})
        return salida.getvalue()
    if not resultados:
        return "El sitio informó que no hay coincidencias.\n"
    return "Datos obtenidos:\n" + "\n\n".join(
        "\n".join(f"{clave}: {valor if valor is not None else ''}" for clave, valor in resultado.items())
        for resultado in resultados
    ) + "\n"


async def main() -> int:
    parser = argparse.ArgumentParser(description="Consulta datos públicos por DNI, CUIT/CUIL o nombre.")
    parser.add_argument("consulta", nargs="?", help="DNI, CUIT/CUIL o nombre entre comillas; si se omite, se solicita un DNI")
    parser.add_argument("--fuente", choices=("cuitonline", "nosis", "dateas", "todas"), default="cuitonline", help="todas compara las tres fuentes, una por una")
    parser.add_argument("--navegador", choices=NAVEGADORES, default=NAVEGADOR_PREDETERMINADO,
                        help="navegador usado para la consulta (por defecto firefox)")
    parser.add_argument(
        "--visible",
        action="store_true",
        help="muestra el navegador elegido; por defecto se ejecuta sin ventana",
    )
    parser.add_argument("--formato", choices=("texto", "json", "csv"), help="por defecto texto, o según extensión de --salida")
    parser.add_argument("--salida", type=Path, help="archivo .json, .csv o .txt")
    parser.add_argument("--domicilios", type=Path, metavar="ARCHIVO",
                        help="agrega domicilios declarados de un archivo local, por CUIT/CUIL completo")
    parser.add_argument("--timeout", type=int, default=30, help="espera en segundos por operación (30)")
    parser.add_argument("--espera-manual", type=int, default=0, metavar="SEGUNDOS", help="espera para resolver un CAPTCHA; requiere --visible")
    parser.add_argument("--diagnostico", type=Path, metavar="DIRECTORIO", help="guarda HTML y captura de errores de cada fuente")
    args = parser.parse_args()
    if not args.consulta:
        args.consulta = input("Ingresá el DNI: ").strip()
    if not args.consulta:
        parser.error("Debés ingresar un DNI.")
    if args.domicilios is None:
        archivo_predeterminado = Path(__file__).with_name("domicilios-declarados.json")
        if archivo_predeterminado.exists():
            args.domicilios = archivo_predeterminado
    if args.timeout <= 0 or args.espera_manual < 0:
        parser.error("--timeout debe ser positivo y --espera-manual no puede ser negativa.")
    if args.espera_manual and not args.visible:
        parser.error("--espera-manual requiere --visible.")
    formato = args.formato or ({".json": "json", ".csv": "csv"}.get(args.salida.suffix.lower(), "texto") if args.salida else "texto")

    try:
        codigo = 0
        registros = None
        if args.domicilios:
            if args.salida and (args.salida.resolve() == args.domicilios.resolve()
                                or (args.salida.exists() and args.salida.samefile(args.domicilios))):
                raise ValueError("--salida debe ser distinto del archivo de --domicilios.")
            registros = cargar_domicilios(args.domicilios)
        consulta_normalizada, clase = normalizar_consulta(args.consulta)
        if clase == "dni" and re.sub(r"\D", "", args.consulta) != consulta_normalizada:
            print(f"DNI completado a 8 dígitos: {consulta_normalizada}", file=sys.stderr)
        if args.fuente == "todas":
            informe = await comparar_fuentes(
                args.consulta, headless=not args.visible, timeout=args.timeout,
                espera_manual=args.espera_manual, diagnostico=args.diagnostico,
                navegador=args.navegador,
            )
            if registros is not None:
                for intento in informe["intentos"]:
                    intento["resultados"] = vincular_domicilios(intento["resultados"], registros)
            resultados = [r for intento in informe["intentos"] for r in intento["resultados"]]
            resumen = resumen_comparacion(informe)
            if formato == "json":
                contenido = json.dumps(informe, ensure_ascii=False, indent=2) + "\n"
            elif formato == "csv":
                contenido = serializar(filas_comparacion(informe), "csv")
            else:
                contenido = resumen + ("\n" + serializar(resultados, "texto") if resultados else "")
            if args.salida or formato != "texto":
                print(resumen, end="", file=sys.stderr)
            if not any(i["estado"] in {"con_datos", "sin_resultados"} for i in informe["intentos"]):
                codigo = 1
        elif args.fuente == "cuitonline":
            resultados = [asdict(r) for r in await consultar_cuits(
                consulta_normalizada, headless=not args.visible, timeout=args.timeout,
                espera_manual=args.espera_manual, diagnostico=args.diagnostico,
                navegador=args.navegador,
            )]
        else:
            resultados = [asdict(r) for r in await consultar_datos(
                consulta_normalizada, fuente=args.fuente, headless=not args.visible,
                timeout=args.timeout, espera_manual=args.espera_manual, diagnostico=args.diagnostico,
                navegador=args.navegador,
            )]
        if args.fuente != "todas":
            if registros is not None:
                resultados = vincular_domicilios(resultados, registros)
            if clase == "dni" and len({r["numero"] for r in resultados}) > 1:
                print(
                    f"Requiere revisión: hay varios CUIT/CUIL para el DNI {consulta_normalizada}. "
                    "Se guardan todas las coincidencias.", file=sys.stderr,
                )
            contenido = serializar(resultados, formato)
        if args.salida:
            args.salida.parent.mkdir(parents=True, exist_ok=True)
            args.salida.write_text(contenido, encoding="utf-8-sig" if formato == "csv" else "utf-8", newline="")
            descripcion = "Comparación guardada" if args.fuente == "todas" else f"{len(resultados)} resultado(s) guardado(s)"
            print(f"{descripcion} en {args.salida.resolve()}", file=sys.stderr)
        else:
            print(contenido, end="")
    except (ValueError, ConsultaError, FuenteError, PlaywrightError, OSError) as error:
        print(f"Consulta no realizada: {error}", file=sys.stderr)
        return 1
    return codigo



if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
