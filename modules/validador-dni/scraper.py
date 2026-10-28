"""Consulta puntual de CUIT/CUIL por DNI en CuitOnline.

Uso:
    python scraper.py <dni>
    python scraper.py <dni> --visible

La fuente puede cambiar su HTML, limitar consultas o solicitar interacción
humana. Esos casos se informan explícitamente: este programa no intenta
sortear bloqueos, CAPTCHAs ni condiciones de uso del sitio.
"""

import argparse
import asyncio
import re
from dataclasses import asdict, dataclass
from urllib.parse import quote

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright


BASE_URL = "https://www.cuitonline.com"

# El resultado se muestra como, por ejemplo:
#     APELLIDO NOMBRE
#     • CUIT: 20-12345678-9
PATRON_RESULTADO = re.compile(
    r"(?mi)^(?P<nombre>[^\n]+?)\s*\n(?:\s*\n){0,2}"
    r"\s*[•·]?\s*(?P<tipo>CUIT|CUIL)\s*:\s*"
    r"(?P<numero>\d{2}-?\d{8}-?\d)\b"
)


class ConsultaError(RuntimeError):
    """La fuente no permitió obtener un resultado utilizable."""


@dataclass(frozen=True)
class Resultado:
    dni: str
    nombre: str
    tipo: str
    numero: str
    url_fuente: str


def normalizar_dni(valor: str) -> str:
    dni = re.sub(r"\D", "", valor)
    if len(dni) not in (7, 8):
        raise ValueError("El DNI debe tener 7 u 8 dígitos.")
    return dni


def normalizar_identificador(numero: str) -> str:
    digitos = re.sub(r"\D", "", numero)
    return f"{digitos[:2]}-{digitos[2:10]}-{digitos[10:]}"


async def consultar_cuit(dni_busqueda: str, *, headless: bool = True) -> Resultado:
    """Obtiene el primer CUIT/CUIL publicado para el DNI indicado."""
    dni = normalizar_dni(dni_busqueda)
    url = f"{BASE_URL}/search/{quote(dni, safe='')}"

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=headless)
        try:
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
                locale="es-AR",
            )
            page = await context.new_page()

            try:
                respuesta = await page.goto(
                    url, wait_until="domcontentloaded", timeout=30_000
                )
            except PlaywrightError as error:
                raise ConsultaError(
                    "No se pudo abrir la fuente. Revisá la conexión, la URL y los "
                    "límites de acceso del sitio."
                ) from error
            if respuesta is not None and respuesta.status >= 400:
                raise ConsultaError(f"La fuente devolvió HTTP {respuesta.status}.")

            try:
                await page.wait_for_function(
                    """() => {
                        const texto = document.body?.innerText || '';
                        return /\\b(CUIT|CUIL)\\s*:/.test(texto) ||
                            /Bloqueador de Anuncios Detectado|CAPTCHA|demasiadas consultas/i.test(texto);
                    }""",
                    timeout=12_000,
                )
            except PlaywrightTimeoutError as error:
                raise ConsultaError(
                    "La página no mostró resultados dentro de los 12 segundos."
                ) from error

            texto = await page.locator("body").inner_text()
            if re.search(r"Bloqueador de Anuncios Detectado|CAPTCHA|demasiadas consultas", texto, re.I):
                raise ConsultaError(
                    "La fuente restringió la consulta. Hay que usar su acceso autorizado "
                    "o una fuente/API habilitada; no se intentó evadir el bloqueo."
                )

            coincidencia = PATRON_RESULTADO.search(texto)
            if not coincidencia:
                raise ConsultaError("No se encontró una persona para ese DNI en la fuente.")

            return Resultado(
                dni=dni,
                nombre=" ".join(coincidencia.group("nombre").split()),
                tipo=coincidencia.group("tipo").upper(),
                numero=normalizar_identificador(coincidencia.group("numero")),
                url_fuente=url,
            )
        finally:
            await browser.close()


async def main() -> int:
    parser = argparse.ArgumentParser(description="Consulta CUIT/CUIL por DNI.")
    parser.add_argument("dni", help="DNI de 7 u 8 dígitos")
    parser.add_argument(
        "--visible",
        action="store_true",
        help="abre Chromium para diagnosticar visualmente una respuesta de la fuente",
    )
    args = parser.parse_args()

    try:
        resultado = await consultar_cuit(args.dni, headless=not args.visible)
    except (ValueError, ConsultaError) as error:
        print(f"Consulta no realizada: {error}")
        return 1

    print("Datos obtenidos:")
    for clave, valor in asdict(resultado).items():
        print(f"{clave}: {valor}")
    return 0



if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
