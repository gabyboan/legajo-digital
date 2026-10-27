"""Consultas puntuales a CuitOnline, Nosis y Dateas con Playwright."""

import re
import sys
import unicodedata
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright


URLS = {
    "cuitonline": "https://www.cuitonline.com",
    "nosis": "https://informes.nosis.com/",
    "dateas": "https://www.dateas.com/es/consulta_cuit_cuil",
}
NAVEGADORES = ("firefox", "chromium")
NAVEGADOR_PREDETERMINADO = "firefox"
PATRON_CUIT = re.compile(r"(?<!\d)(\d{2}[-\s]?\d{8}[-\s]?\d)(?!\d)")
PATRON_RESULTADO = re.compile(
    r"(?mi)^(?P<nombre>[^\n]+?)\s*\n(?:\s*\n){0,2}"
    r"\s*[•·]?\s*(?P<tipo>CUIT|CUIL)\s*:\s*"
    r"(?P<numero>\d{2}-?\d{8}-?\d)\b"
)


class FuenteError(RuntimeError):
    """La consulta no pudo completarse; no equivale a cero coincidencias."""


class AccesoRestringido(FuenteError):
    pass


@dataclass(frozen=True)
class ResultadoPublico:
    fuente: str
    consulta: str
    nombre: str
    numero: str
    tipo: str
    provincia: str | None
    localidad: str | None
    actividad: str | None
    url_fuente: str


def normalizar_consulta(valor: str) -> tuple[str, str]:
    """Normaliza DNI a ocho dígitos y conserva completos los CUIT/CUIL."""
    valor = " ".join(valor.split())
    if not valor or len(valor) > 150:
        raise ValueError("Ingresá un nombre, DNI o CUIT/CUIL de hasta 150 caracteres.")
    if re.fullmatch(r"[0-9.\s-]+", valor):
        digitos = re.sub(r"\D", "", valor)
        if len(digitos) not in (7, 8, 11):
            raise ValueError("El DNI debe tener 7 u 8 dígitos y el CUIT/CUIL, 11.")
        if len(digitos) < 11:
            return digitos.zfill(8), "dni"
        return digitos, "cuit"
    if not any(c.isalpha() for c in valor):
        raise ValueError("Ingresá un nombre, DNI o CUIT/CUIL válido.")
    return valor, "nombre"


def _limpiar(valor: str | None) -> str:
    return " ".join((valor or "").split())


def _clave(valor: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", valor.lower())
        if not unicodedata.combining(c)
    )


def _resultado(fuente, consulta, clase, nombre, numero, url, **campos):
    encontrado = PATRON_CUIT.search(numero or "")
    nombre = _limpiar(nombre)
    if not encontrado or not nombre or re.search(r"@\w+@", nombre):
        return None
    digitos = re.sub(r"\D", "", encontrado[1])
    # Un resultado ajeno nunca se atribuye al documento consultado.
    if clase == "cuit" and digitos != consulta:
        return None
    if clase == "dni" and (
        digitos[:2] not in {"20", "23", "24", "27"}
        or digitos[2:10] != consulta.zfill(8)
    ):
        return None
    return ResultadoPublico(
        fuente=fuente, consulta=consulta, nombre=nombre,
        numero=f"{digitos[:2]}-{digitos[2:10]}-{digitos[10]}",
        tipo="CUIT/CUIL", url_fuente=url,
        **{k: _limpiar(campos.get(k)) or None for k in
           ("provincia", "localidad", "actividad")},
    )


# Sólo se consideran elementos visibles: Nosis incluye mensajes de CAPTCHA,
# errores, resultados vacíos y una fila de ejemplo ocultos en su HTML inicial.
ESTADO_JS = r"""({fuente, enviado}) => {
    const visible = e => !!e && e.checkVisibility({visibilityProperty: true});
    const texto = document.body?.innerText || '';
    const alguno = s => [...document.querySelectorAll(s)].some(visible);
    if (/Sorry, you have been blocked|Web Page Blocked|Access denied|acceso denegado|demasiadas consultas|too many requests|Bloqueador de Anuncios Detectado/i.test(texto))
        return 'bloqueo';
    const token = [...document.querySelectorAll('[name="g-recaptcha-response"], [name="h-captcha-response"], [name="cf-turnstile-response"]')].some(e => e.value);
    if (!token && (alguno('#contenedorCaptcha, .g-recaptcha, .h-captcha, .cf-turnstile, iframe[src*="recaptcha"][src*="anchor"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"]') ||
        /verifying you are human|verify you are human|verifica que eres humano|verifique que es humano|checking your browser|just a moment|resuelva el siguiente captcha|completa.{0,20}captcha/i.test(texto) ||
        (fuente === 'cuitonline' && /captcha/i.test(texto))))
        return 'captcha';
    if (fuente === 'nosis') {
        if (alguno('#alertDanger')) return 'error';
        if (enviado && alguno('#alertWarning')) return 'vacio';
        if (enviado && alguno('#wrap-resultados .result')) return 'resultados';
        if (enviado && alguno('#alertInfo')) return 'acotar';
        if (!enviado && alguno('#Busqueda_Texto')) return 'formulario';
    } else if (fuente === 'dateas') {
        const tablas = [...document.querySelectorAll('table')].filter(visible);
        if (enviado && tablas.some(t => /CUIT\s*\/\s*CUIL/i.test(t.innerText) && /Nombre|Raz[oó]n Social/i.test(t.innerText) && /\b\d{2}[-\s]?\d{8}[-\s]?\d\b/.test(t.innerText)))
            return 'resultados';
        if (enviado && /no se (?:han )?encontr(?:ado|aron)|no hay (?:resultados|coincidencias)|sin resultados|ning[uú]n resultado/i.test(texto))
            return 'vacio';
        if (!enviado && alguno('form input:not([type="hidden"]):not([type="submit"]):not([type="radio"]):not([type="checkbox"])'))
            return 'formulario';
    } else if (fuente === 'cuitonline') {
        if (/\b(CUIT|CUIL)\s*:\s*\d{2}-?\d{8}-?\d\b/i.test(texto)) return 'resultados';
        if (/no se (?:han )?encontr(?:ado|aron)|no hay (?:resultados|coincidencias)|sin resultados|ning[uú]n resultado|su b[uú]squeda no obtuvo resultados/i.test(texto))
            return 'vacio';
    }
    if (alguno('input[type="password"]')) return 'login';
    return false;
}"""


async def _esperar_estado(page, fuente, *, enviado, timeout, espera_manual):
    async def leer(tiempo):
        handle = await page.wait_for_function(
            ESTADO_JS, arg={"fuente": fuente, "enviado": enviado}, timeout=tiempo
        )
        try:
            return await handle.json_value()
        finally:
            await handle.dispose()

    estado = await leer(timeout)
    if estado == "captcha" and espera_manual:
        print(
            f"{fuente}: resolvé el CAPTCHA en el navegador. "
            f"Se esperará hasta {espera_manual} segundos.", file=sys.stderr,
        )
        # No se pulsa ni resuelve el desafío automáticamente.
        await page.wait_for_function(
            "(arg) => { const estado = (" + ESTADO_JS +
            ")(arg); return estado && estado !== 'captcha'; }",
            arg={"fuente": fuente, "enviado": enviado},
            timeout=espera_manual * 1000,
        )
        estado = await leer(timeout)
    if estado in {"bloqueo", "captcha", "login"}:
        detalle = {
            "bloqueo": "el sitio bloqueó el acceso desde este navegador o conexión",
            "captcha": "el sitio requiere resolver un CAPTCHA; usá --visible --espera-manual 120",
            "login": "el sitio requiere iniciar sesión",
        }[estado]
        raise AccesoRestringido(f"{fuente}: {detalle}.")
    if estado == "error":
        raise FuenteError(f"{fuente}: el buscador informó un error al procesar la consulta.")
    if estado == "acotar":
        raise FuenteError(f"{fuente}: hay demasiadas coincidencias; acotá el nombre o usá CUIT/DNI.")
    return estado


async def _campo_dateas(page, clase):
    patron = re.compile(r"CUIT\s*/\s*CUIL|\bDNI\b", re.I) if clase != "nombre" else re.compile(
        r"Apellido\s*/\s*Nombre|Nombre.*Empresa|Nombre.*Raz[oó]n", re.I
    )
    # Prioridad a etiquetas accesibles; luego atributos del formulario.
    candidatos = [page.get_by_label(patron), page.get_by_placeholder(patron)]
    selector = (
        'input[name="cuit"], input[name="dni"], input[name="cuit_cuil"], input[name="documento"]'
        if clase != "nombre" else 'input[name="name"], input[name="nombre"]'
    )
    candidatos.append(page.locator(selector))
    for candidato in candidatos:
        for i in range(await candidato.count()):
            campo = candidato.nth(i)
            if await campo.is_visible() and await campo.is_editable():
                return campo
    raise FuenteError("dateas: no se encontró el campo de búsqueda; el formulario puede haber cambiado.")


async def _enviar(page, fuente, consulta, clase):
    if fuente == "nosis":
        await page.locator("#Busqueda_Texto").fill(consulta)
        await page.locator(".wrap-buscador .btnBuscar:visible").first.click()
    else:
        campo = await _campo_dateas(page, clase)
        await campo.fill(consulta)
        formulario = campo.locator("xpath=ancestor::form[1]")
        boton = formulario.get_by_role("button", name=re.compile(r"^Buscar$", re.I))
        if await boton.count():
            await boton.first.click()
        else:
            await campo.press("Enter")
        invalido = formulario.locator("input:invalid:visible")
        if await invalido.count():
            raise FuenteError("dateas: el formulario requiere otro dato; probá buscar por nombre.")


async def _extraer_nosis(page, consulta, clase):
    filas = await page.locator("#wrap-resultados .result:visible").evaluate_all("""els => els.map(e => {
        const parrafos = [...e.querySelectorAll('.info-resultado-actividad p')];
        return {
            nombre: e.querySelector('.rz')?.innerText || '',
            numero: e.querySelector('.cuit')?.innerText || '',
            actividad: parrafos[1]?.innerText || '',
            provincia: parrafos[2]?.innerText || ''
        };
    })""")
    return [r for f in filas if (r := _resultado(
        "nosis", consulta, clase, f["nombre"], f["numero"], page.url,
        actividad=f["actividad"], provincia=f["provincia"],
    ))]


async def _extraer_dateas(page, consulta, clase):
    tablas = await page.locator("table:visible").evaluate_all("""els => els.map(t => ({
        cabeceras: [...t.querySelectorAll('tr')][0] ? [...t.querySelector('tr').children].map(e => e.innerText) : [],
        filas: [...t.querySelectorAll('tr')].slice(1).filter(e => e.checkVisibility({visibilityProperty: true})).map(tr => ({
            celdas: [...tr.children].map(e => e.innerText),
            enlaces: [...tr.querySelectorAll('a[href]')].map(e => e.href)
        }))
    }))""")
    resultados = []
    for tabla in tablas:
        cabeceras = [_clave(t) for t in tabla["cabeceras"]]
        indices = {}
        for i, cabecera in enumerate(cabeceras):
            if "nombre" in cabecera or "razon social" in cabecera:
                indices["nombre"] = i
            elif "cuit" in cabecera or "cuil" in cabecera:
                indices["numero"] = i
            elif "provincia" in cabecera:
                indices["provincia"] = i
            elif "localidad" in cabecera:
                indices["localidad"] = i
            elif "actividad" in cabecera:
                indices["actividad"] = i
        if not {"nombre", "numero"} <= indices.keys():
            continue
        for fila in tabla["filas"]:
            campos = {k: fila["celdas"][i] for k, i in indices.items() if i < len(fila["celdas"])}
            url = page.url
            for enlace in fila["enlaces"]:
                candidato = urljoin(page.url, enlace)
                parsed = urlparse(candidato)
                if parsed.scheme == "https" and parsed.hostname in {"dateas.com", "www.dateas.com"} and re.match(r"/es/(persona|empresa)/", parsed.path):
                    url = candidato
                    break
            resultado = _resultado(
                "dateas", consulta, clase, campos.pop("nombre", ""),
                campos.pop("numero", ""), url, **campos,
            )
            if resultado:
                resultados.append(resultado)
    return resultados


async def _extraer_cuitonline(page, consulta, clase):
    texto = await page.locator("body").inner_text()
    resultados = []
    for coincidencia in PATRON_RESULTADO.finditer(texto):
        resultado = _resultado(
            "cuitonline", consulta, clase, coincidencia["nombre"],
            coincidencia["numero"], page.url,
        )
        if resultado:
            # Esta fuente sí publica la etiqueta CUIT o CUIL.
            resultados.append(replace(resultado, tipo=coincidencia["tipo"].upper()))
    return resultados


async def consultar_pagina(page, consulta, fuente, *, timeout=30, espera_manual=0):
    """Recibe una Page de Playwright, útil también para pruebas locales."""
    consulta, clase = normalizar_consulta(consulta)
    if fuente not in URLS:
        raise ValueError("La fuente debe ser cuitonline, nosis o dateas.")
    if fuente == "cuitonline" and clase != "dni":
        raise ValueError("CuitOnline sólo acepta consultas por DNI de 7 u 8 dígitos.")
    url = URLS[fuente]
    if fuente == "cuitonline":
        url += f"/search/{quote(consulta, safe='')}"
    respuesta = await page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)
    if respuesta is not None and respuesta.status >= 400:
        # Un desafío interactivo puede responder 403; un bloqueo duro no se reintenta.
        estado = await page.evaluate(ESTADO_JS, {"fuente": fuente, "enviado": False})
        if estado != "captcha":
            error = AccesoRestringido if estado == "bloqueo" or respuesta.status in {401, 403, 429} else FuenteError
            raise error(f"{fuente}: el sitio devolvió HTTP {respuesta.status}; no se obtuvieron datos.")
    if fuente != "cuitonline":
        await _esperar_estado(page, fuente, enviado=False, timeout=timeout * 1000, espera_manual=espera_manual)
        await _enviar(page, fuente, consulta, clase)
    estado = await _esperar_estado(page, fuente, enviado=True, timeout=timeout * 1000, espera_manual=espera_manual)
    if estado == "vacio":
        return []
    extraer = {"cuitonline": _extraer_cuitonline, "nosis": _extraer_nosis, "dateas": _extraer_dateas}[fuente]
    resultados = await extraer(page, consulta, clase)
    if not resultados:
        raise FuenteError(
            f"{fuente}: la página mostró resultados, pero no se pudieron asociar a la consulta. "
            "El formato pudo cambiar o los identificadores no coinciden."
        )
    # Una tabla adaptada a móvil puede repetir la misma entidad.
    return list({r.numero: r for r in resultados}.values())


async def _diagnosticar(page, fuente, directorio):
    if directorio is None:
        return
    ruta = Path(directorio)
    marca = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    try:
        ruta.mkdir(parents=True, exist_ok=True)
        (ruta / f"{fuente}-{marca}.html").write_text(await page.content(), encoding="utf-8")
        await page.screenshot(path=str(ruta / f"{fuente}-{marca}.png"), timeout=5000)
        print(f"Diagnóstico guardado en {ruta.resolve()}", file=sys.stderr)
    except (OSError, PlaywrightError) as error:
        print(f"No se pudo guardar el diagnóstico: {error}", file=sys.stderr)


async def consultar_datos(consulta, *, fuente="nosis", headless=True, timeout=30,
                         espera_manual=0, diagnostico=None,
                         navegador=NAVEGADOR_PREDETERMINADO):
    """Extrae las coincidencias de la primera página, sin abrir informes pagos."""
    _, clase = normalizar_consulta(consulta)
    if fuente not in URLS:
        raise ValueError("La fuente debe ser cuitonline, nosis o dateas.")
    if navegador not in NAVEGADORES:
        raise ValueError("El navegador debe ser firefox o chromium.")
    if fuente == "cuitonline" and clase != "dni":
        raise ValueError("CuitOnline sólo acepta consultas por DNI de 7 u 8 dígitos.")
    if timeout <= 0 or espera_manual < 0:
        raise ValueError("El timeout debe ser positivo y la espera manual, no negativa.")
    if headless and espera_manual:
        raise ValueError("La espera manual requiere --visible.")
    try:
        async with async_playwright() as playwright:
            motor = getattr(playwright, navegador)
            opciones = {"headless": headless}
            if navegador == "chromium":
                # Usa el Chromium completo tanto con ventana como sin ella.
                opciones["channel"] = "chromium"
            browser = await motor.launch(**opciones)
            try:
                context = await browser.new_context(locale="es-AR", viewport={"width": 1280, "height": 900})
                page = await context.new_page()
                page.set_default_timeout(timeout * 1000)
                page.set_default_navigation_timeout(timeout * 1000)
                try:
                    return await consultar_pagina(
                        page, consulta, fuente, timeout=timeout, espera_manual=espera_manual,
                    )
                except (FuenteError, PlaywrightError):
                    await _diagnosticar(page, fuente, diagnostico)
                    raise
            finally:
                await browser.close()
    except PlaywrightTimeoutError as error:
        raise FuenteError(f"{fuente}: se agotó la espera de la página o de la intervención manual.") from error
    except PlaywrightError as error:
        raise FuenteError(
            f"{fuente}: no se pudo completar la navegación con {navegador}. Revisá la conexión "
            f"y su instalación (python -m playwright install {navegador}). "
            f"Detalle: {error.message.splitlines()[0]}"
        ) from error
