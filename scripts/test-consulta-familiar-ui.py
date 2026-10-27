"""Browser regression checks with synthetic API responses; requires npm run dev."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright, expect, Error as PlaywrightError

ROOT = Path(__file__).resolve().parents[1]
PAGE_DIR = ROOT / "app" / "prueba-familiar-temporal"
PAGE = PAGE_DIR / "page.tsx"
FIXTURE = """import { FamiliaresEditForm } from '../(private)/personas/[dni]/editar/components/familiares-edit-form'
export default function PruebaFamiliar() {
  return <FamiliaresEditForm personaDni={12345678} familiares={[]} returnTo="/personas/familiares" />
}
"""


def report(dni, mode):
    intentos = [
        {"fuente": f, "estado": "sin_resultados", "detalle": None, "resultados": []}
        for f in ("cuitonline", "nosis", "dateas")
    ]
    if mode == "datos":
        intentos[0].update(estado="bloqueado", detalle="La fuente restringió el acceso.")
        intentos[1].update(estado="con_datos", resultados=[
            {"nombre": "PEREZ ANA", "numero": "20059567283"},
            {"nombre": "GOMEZ LUCIA", "numero": "27059567288"},
        ])
    elif mode == "bloqueado":
        for intento in intentos:
            intento.update(estado="bloqueado", detalle="La fuente restringió el acceso.")
    return {"dni": dni.zfill(8), "comprobadoEn": "2026-09-10T12:00:00Z",
            "requiereRevision": mode == "datos", "intentos": intentos}


def main():
    if PAGE_DIR.exists():
        raise RuntimeError("La ruta temporal ya existe; no se sobrescribe.")
    PAGE_DIR.mkdir()
    PAGE.write_text(FIXTURE, encoding="utf-8")
    try:
        with sync_playwright() as playwright:
            browser = playwright.firefox.launch(headless=True)
            try:
                page = browser.new_page()
                errores = []
                page.on("pageerror", lambda error: errores.append(str(error)))
                state = {"mode": "datos", "calls": [], "held": None}

                def consultar(route):
                    payload = route.request.post_data_json
                    state["calls"].append(payload)
                    if state["mode"] == "demorado":
                        state["held"] = route
                        return
                    if state["mode"] == "error":
                        route.fulfill(status=422, json={"error": "Consulta no disponible."})
                        return
                    route.fulfill(json=report(payload["dni"], state["mode"]))

                page.route("**/api/validacion-dni/familiar", consultar)
                page.goto("http://localhost:3000/prueba-familiar-temporal", wait_until="networkidle", timeout=90000)
                consultar_button = page.get_by_role("button", name="Consultar apellido y nombre por DNI")
                dni = page.locator("#familiar_dni_nuevo")
                expect(consultar_button).to_be_disabled()
                dni.fill("5956728")
                expect(consultar_button).to_be_enabled()
                consultar_button.click()
                expect(page.get_by_text("Resultados para el DNI 05.956.728")).to_be_visible()
                expect(page.get_by_text("Apellido y nombre: Perez Ana")).to_be_visible()
                expect(page.get_by_text("Apellido y nombre: Gomez Lucia")).to_be_visible()
                expect(page.get_by_text("Hay distintos CUIT/CUIL", exact=False)).to_be_visible()
                expect(page.get_by_text("Acceso restringido", exact=True)).to_be_visible()
                assert state["calls"][0] == {"accion": "comprobar-nombre", "personaDni": 12345678, "dni": "5956728"}
                page.locator("#familiar_apellido_nuevo").fill("Perez")
                page.locator("#familiar_nombre_nuevo").fill("Ana")
                expect(page.get_by_text("El apellido y nombre coinciden con lo ingresado.")).to_be_visible()
                expect(page.get_by_text("Hay diferencias con el apellido y nombre ingresados.")).to_be_visible()
                assert len(state["calls"]) == 1

                dni.fill("12345678")
                expect(page.get_by_text("Apellido y nombre: Perez Ana")).to_have_count(0)
                state["mode"] = "demorado"
                consultar_button.click()
                expect(page.get_by_role("button", name="Consultando DNI…")).to_be_disabled()
                page.wait_for_function("document.querySelector('[aria-busy=true]') !== null")
                dni.fill("87654321")
                expect(consultar_button).to_be_enabled()
                if state["held"]:
                    try:
                        state["held"].fulfill(json=report("12345678", "datos"))
                    except PlaywrightError:
                        pass
                expect(page.get_by_text("Apellido y nombre: Perez Ana")).to_have_count(0)

                state["mode"] = "vacio"
                consultar_button.click()
                expect(page.get_by_text("Las fuentes consultadas no encontraron coincidencias para este DNI.")).to_be_visible()
                state["mode"] = "bloqueado"
                consultar_button.click()
                expect(page.get_by_text("No se obtuvieron nombres.", exact=False)).to_be_visible()
                expect(page.get_by_text("Las fuentes consultadas no encontraron coincidencias para este DNI.")).to_have_count(0)
                state["mode"] = "error"
                consultar_button.click()
                expect(page.get_by_role("alert").filter(has_text="Consulta no disponible.")).to_be_visible()
                assert not errores, json.dumps(errores)
                print("Interfaz Firefox: DNI solo, varias coincidencias, comparación editable, cambio de DNI, sin datos y errores: OK")
            finally:
                browser.close()
    finally:
        PAGE.unlink()
        PAGE_DIR.rmdir()


if __name__ == "__main__":
    main()
