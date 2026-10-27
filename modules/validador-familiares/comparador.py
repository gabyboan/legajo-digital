"""Prueba las fuentes secuencialmente y conserva los datos y fallos de cada una."""

import re
import sys
import asyncio
import unicodedata
from dataclasses import asdict
from datetime import datetime, timezone
from time import perf_counter

from playwright.async_api import Error as PlaywrightError

from fuentes import (
    AccesoRestringido, FuenteError, NAVEGADORES, NAVEGADOR_PREDETERMINADO,
    consultar_datos, normalizar_consulta,
)


ORDEN_FUENTES = ("cuitonline", "nosis", "dateas")
ESTADOS = {
    "con_datos": "Con datos",
    "sin_resultados": "Sin coincidencias",
    "bloqueado": "Acceso restringido",
    "error": "Error",
    "no_compatible": "Consulta no compatible",
}


def _nombre_comparable(nombre):
    texto = unicodedata.normalize("NFKD", nombre.casefold())
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^\w\s]", " ", texto).split())


def agrupar_coincidencias(intentos):
    """Agrupa por identificador sin decidir qué proveedor dice la verdad."""
    grupos = {}
    for intento in intentos:
        for resultado in intento["resultados"]:
            numero = resultado["numero"]
            grupo = grupos.setdefault(numero, {"numero": numero, "fuentes": [], "nombres": {}})
            fuente = intento["fuente"]
            if fuente not in grupo["fuentes"]:
                grupo["fuentes"].append(fuente)
            nombres = grupo["nombres"].setdefault(fuente, [])
            if resultado["nombre"] not in nombres:
                nombres.append(resultado["nombre"])
    for grupo in grupos.values():
        grupo["cantidad_fuentes"] = len(grupo["fuentes"])
        grupo["nombres_difieren"] = len({
            _nombre_comparable(nombre)
            for nombres in grupo["nombres"].values() for nombre in nombres
        }) > 1
    return list(grupos.values())


async def comparar_fuentes(consulta, *, headless=True, timeout=30, espera_manual=0,
                          diagnostico=None, navegador=NAVEGADOR_PREDETERMINADO):
    consulta_original = consulta
    consulta, clase = normalizar_consulta(consulta)
    if navegador not in NAVEGADORES:
        raise ValueError("El navegador debe ser firefox o chromium.")
    if timeout <= 0 or espera_manual < 0:
        raise ValueError("El timeout debe ser positivo y la espera manual, no negativa.")
    if headless and espera_manual:
        raise ValueError("La espera manual requiere --visible.")
    informe = {
        "consulta_original": consulta_original,
        "consulta": consulta,
        "tipo_consulta": clase,
        "navegador": navegador,
        "modo": "sin_ventana" if headless else "visible",
        "fecha_utc": datetime.now(timezone.utc).isoformat(),
        "intentos": [],
    }
    async def consultar_fuente(indice, fuente):
        print(f"[{indice}/3] Consultando {fuente}...", file=sys.stderr, flush=True)
        inicio = perf_counter()
        intento = {"fuente": fuente, "estado": "no_compatible", "cantidad": 0,
                   "duracion_segundos": 0, "detalle": None, "resultados": [],
                   "requiere_revision": False}
        if fuente == "cuitonline" and clase != "dni":
            intento["detalle"] = "CuitOnline sólo acepta DNI; para comparar las tres fuentes ingresá un DNI."
        else:
            try:
                resultados = await consultar_datos(
                    consulta, fuente=fuente, headless=headless, timeout=timeout,
                    espera_manual=espera_manual, diagnostico=diagnostico,
                    navegador=navegador,
                )
                intento.update(
                    estado="con_datos" if resultados else "sin_resultados",
                    cantidad=len(resultados), resultados=[asdict(r) for r in resultados],
                    requiere_revision=clase == "dni" and len({r.numero for r in resultados}) > 1,
                )
            except AccesoRestringido as error:
                intento.update(estado="bloqueado", detalle=str(error))
            except (FuenteError, PlaywrightError, OSError) as error:
                intento.update(estado="error", detalle=str(error))
        intento["duracion_segundos"] = round(perf_counter() - inicio, 2)
        print(f"    {ESTADOS[intento['estado']]}: {intento['cantidad']} resultado(s).", file=sys.stderr, flush=True)
        if intento["requiere_revision"]:
            print("    Hay varios CUIT/CUIL para ese DNI; se conservan todos para revisión.", file=sys.stderr, flush=True)
        return intento

    informe["intentos"] = await asyncio.gather(*(
        consultar_fuente(indice, fuente)
        for indice, fuente in enumerate(ORDEN_FUENTES, 1)
    ))
    informe["coincidencias"] = agrupar_coincidencias(informe["intentos"])
    informe["requiere_revision"] = clase == "dni" and len(informe["coincidencias"]) > 1
    return informe


def resumen_comparacion(informe):
    lineas = [f"Comparación para: {informe['consulta']}"]
    if informe.get("consulta_original", informe["consulta"]) != informe["consulta"]:
        lineas.append(f"Consulta ingresada: {informe['consulta_original']}")
    if "navegador" in informe:
        lineas.append(f"Navegador: {informe['navegador']} | Modo: {informe['modo']}")
    lineas.append(f"{'Fuente':<12} {'Estado':<24} {'Resultados':>10} {'Segundos':>9}")
    for intento in informe["intentos"]:
        lineas.append(
            f"{intento['fuente']:<12} {ESTADOS[intento['estado']]:<24} "
            f"{intento['cantidad']:>10} {intento['duracion_segundos']:>9.2f}"
        )
        if intento["detalle"]:
            lineas.append(f"  {intento['detalle']}")
    if informe.get("requiere_revision"):
        lineas.append(
            f"Requiere revisión: el DNI {informe['consulta']} tiene "
            f"{len(informe['coincidencias'])} CUIT/CUIL distintos entre los resultados."
        )
    for grupo in informe["coincidencias"]:
        if grupo["cantidad_fuentes"] > 1:
            lineas.append(f"{grupo['numero']}: aparece en {', '.join(grupo['fuentes'])}.")
        if grupo["nombres_difieren"]:
            lineas.append(f"{grupo['numero']}: hay diferencias entre los nombres publicados; revisar los resultados.")
    if informe["coincidencias"]:
        lineas.append("Las coincidencias permiten comparar lo publicado; no certifican que los datos sean correctos o actuales.")
    return "\n".join(lineas) + "\n"


def filas_comparacion(informe):
    """El CSV incluye una fila de estado incluso para fuentes sin datos."""
    filas = []
    for intento in informe["intentos"]:
        for resultado in intento["resultados"] or [{}]:
            filas.append({
                "consulta_original": informe.get("consulta_original", informe["consulta"]),
                "consulta": informe["consulta"], "fuente": intento["fuente"],
                "requiere_revision": informe.get("requiere_revision", False),
                "fuente_requiere_revision": intento.get("requiere_revision", False),
                "navegador": informe.get("navegador"), "modo": informe.get("modo"),
                "estado": intento["estado"], "cantidad": intento["cantidad"],
                "duracion_segundos": intento["duracion_segundos"], "detalle": intento["detalle"],
                **{k: resultado.get(k) for k in (
                    "nombre", "numero", "tipo", "provincia", "localidad", "actividad", "url_fuente",
                )},
                **({"domicilio_declarado": resultado["domicilio_declarado"]}
                   if "domicilio_declarado" in resultado else {}),
            })
    return filas
