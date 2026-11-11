"""Prueba las páginas y acciones reales con una base sintética en memoria."""
from playwright.sync_api import sync_playwright, expect
from ui_preview import preview_server

SERVER = r'''import { cookies } from 'next/headers'
const base = { dni:12345678, apellido_nombre:'AGENTE ANA', tipo_id:101, tipo:{nombre:'Licencia anual',codigo:'01',columna_ficha:'ANUAL'},desde:'2026-11-10',hasta:'2026-11-12',dias:3,observacion:'Observación original',dni_familiar:null,numero_orden:null,cantidad_ficha:null,anulado_at:null,created_at:'2026-11-11T12:04:05Z',created_by:'carga-ficticia',creado_por:'Operadora Ficticia',updated_at:'2026-11-11T12:04:05Z',actualizado_por:'Operadora Ficticia',anulado_por:null,motivo_borrado:null,origen:'manual',version:'a'.repeat(32) }
const root = globalThis as typeof globalThis & { licenciasDemo?: typeof base[] }
root.licenciasDemo ??= [{...base,id:101},{...base,id:102,dni:87654321,apellido_nombre:'AGENTE BRUNO',created_at:'2026-11-10T12:00:00Z',updated_at:'2026-11-10T12:00:00Z',created_by:null,creado_por:null,origen:'importacion'}] as any
const tipos = [{id:101,nombre:'Licencia anual',codigo:'01',columna_ficha:'ANUAL',descripcion:'Descanso anual',habilitado_para_carga:true}]
const client = {
  from() { return {select(){return this},eq(){return this},order(){return this},maybeSingle:async()=>({data:tipos[0],error:null}),then(resolve:any){return Promise.resolve({data:tipos,error:null}).then(resolve)}} },
  async rpc(name:string,args:any) {
    const record = root.licenciasDemo!.find((item:any)=>item.id===args.p_id) as any
    if (name==='rpc_licencias_editar_versionada') {
      if(record.version!==args.p_version)return {error:{code:'40001'}}
      const d=args.p_datos
      Object.assign(record,{desde:d.p_desde,hasta:d.p_hasta,observacion:d.p_observacion,dni_familiar:d.p_dni_familiar,numero_orden:d.p_numero_orden,cantidad_ficha:d.p_cantidad_ficha,dias:(Date.parse(d.p_hasta)-Date.parse(d.p_desde))/86400000+1,updated_at:'2026-11-11T13:00:00Z',actualizado_por:'Administrador Ficticio',version:'b'.repeat(32)})
      return {data:record.id,error:null}
    }
    if(name==='rpc_licencias_borrar_versionada') {
      if(record.version!==args.p_version)return {error:{code:'40001'}}
      Object.assign(record,{anulado_at:'2026-11-11T14:00:00Z',anulado_por:'Administrador Ficticio',motivo_borrado:args.p_motivo,version:'c'.repeat(32)})
      return {data:record.id,error:null}
    }
    throw new Error('RPC de prueba desconocida')
  }
}
export async function sesionLicencias(){return client}
export async function permisosLicencias(){return {leer:true,cargar:true,ficha:true,administrar:!(await cookies()).has('test-no-admin'),error:false}}
export function mensajeLicencia(error:any){return error.code==='40001'?'La licencia cambió. Volvé al listado.':'No se pudo completar la operación.'}
export async function ultimasLicencias(_client:any,options:any={}) {
 const q=(options.q??'').toLowerCase()
 return {registros:root.licenciasDemo!.filter((item:any)=>(!options.id||item.id===options.id)&&(!q||`${item.apellido_nombre} ${item.dni}`.toLowerCase().includes(q))&&(options.estado==='todas'||(options.estado==='borradas'?!!item.anulado_at:!item.anulado_at))).slice(options.offset??0,(options.offset??0)+26),error:null}
}
'''


def route(source):
    return f'''import Page from '@/app/(private)/licencias/{source}/page'
import {{ PrivateShell }} from '@/app/(private)/components/private-shell'
export default function Preview(props:any) {{ return <PrivateShell account={{<p>Cuenta de prueba</p>}}><Page {{...props}} /></PrivateShell> }}'''


def main():
    listing = route('ultimas')
    extra = {'fixtures/server.ts': SERVER,
             'app/licencias/ultimas/page.tsx': listing,
             'app/licencias/ultimas/[id]/editar/page.tsx': route('ultimas/[id]/editar'),
             'app/licencias/ultimas/[id]/borrar/page.tsx': route('ultimas/[id]/borrar')}
    with preview_server('licencias-administracion', listing, 3112, extra_files=extra,
                        aliases={'@/lib/licencias/server': ['./fixtures/server.ts']}) as (origin, artifacts):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                page = browser.new_page(viewport={'width': 1440, 'height': 1000})
                errors, documents = [], []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('request', lambda request: documents.append(request.url) if request.resource_type == 'document' else None)
                page.goto(origin + '/licencias/ultimas', wait_until='networkidle')
                first = page.get_by_role('article', name='Licencia 101 de AGENTE ANA', exact=True)
                expect(first.get_by_text('Operadora Ficticia', exact=True)).to_be_visible()
                expect(first.get_by_text('11/11/2026, 09:04:05', exact=True)).to_be_visible()
                expect(page.get_by_text('Importación anterior', exact=True)).to_be_visible()
                nav = page.get_by_role('navigation', name='Navegación principal')
                expect(nav.get_by_role('link', name='Últimas cargas', exact=True)).to_have_attribute('aria-current', 'page')
                for width in [320, 390, 768, 1440]:
                    page.set_viewport_size({'width': width, 'height': 1000})
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), f'Desborde a {width}'
                page.screenshot(path=str(artifacts / 'ultimas-cargas.png'), full_page=True)
                initial_documents = len(documents)
                first.get_by_role('link', name='Editar', exact=True).click()
                expect(page.get_by_role('heading', name='Editar licencia #101', exact=True)).to_be_visible()
                expect(page.get_by_label('Tipo de licencia', exact=True)).to_have_value('101')
                expect(page.get_by_label('Cantidad de días', exact=True)).to_have_value('3')
                expect(page.get_by_label('Observación (opcional)', exact=True)).to_have_value('Observación original')
                page.get_by_label('Cantidad de días', exact=True).fill('4')
                page.get_by_label('Observación (opcional)', exact=True).fill('Carga corregida')
                page.get_by_role('button', name='Guardar cambios', exact=True).click()
                expect(page.get_by_text('Los cambios de la licencia se guardaron correctamente.', exact=True)).to_be_visible()
                page.get_by_role('link', name='Volver a últimas cargas', exact=True).click()
                expect(first.get_by_text('Operadora Ficticia', exact=True)).to_be_visible()
                expect(first.get_by_text('Última edición: Administrador Ficticio · 11/11/2026, 10:00:00', exact=True)).to_be_visible()
                expect(first.get_by_text('10/11/2026 al 13/11/2026 · 4 días', exact=True)).to_be_visible()
                first.get_by_role('link', name='Borrar', exact=True).click()
                expect(page.get_by_role('heading', name='Borrar licencia #101', exact=True)).to_be_visible()
                page.get_by_role('link', name='Cancelar', exact=True).click()
                expect(first).to_be_visible()
                first.get_by_role('link', name='Borrar', exact=True).click()
                page.get_by_label('Motivo del borrado', exact=True).fill('Agente equivocado')
                page.get_by_role('button', name='Confirmar borrado', exact=True).click()
                expect(page.get_by_role('heading', name='Borrar licencia #101', exact=True)).to_be_visible()
                page.get_by_role('checkbox').check()
                page.get_by_role('button', name='Confirmar borrado', exact=True).click()
                expect(page.get_by_text('La licencia fue borrada y ya no se cuenta en la ficha del agente.', exact=True)).to_be_visible()
                page.get_by_role('link', name='Volver a últimas cargas', exact=True).click()
                expect(first).to_have_count(0)
                page.get_by_label('Estado', exact=True).select_option('borradas')
                page.get_by_role('button', name='Aplicar filtros', exact=True).click()
                expect(first).to_be_visible()
                expect(first.get_by_text('Motivo: Agente equivocado', exact=True)).to_be_visible()
                expect(first.get_by_text('Borrada por Administrador Ficticio · 11/11/2026, 11:00:00', exact=True)).to_be_visible()
                page.get_by_role('button', name='Actualizar listado', exact=True).click()
                expect(page.get_by_label('Estado', exact=True)).to_have_value('borradas')
                expect(first).to_be_visible()
                expect(first.get_by_role('link', name='Editar', exact=True)).to_have_count(0)
                expect(first.get_by_role('link', name='Borrar', exact=True)).to_have_count(0)
                assert len(documents) == initial_documents, 'Los filtros y las acciones deben mantener navegación interna'
                page.get_by_label('Estado', exact=True).select_option('todas')
                page.get_by_label('Buscar agente en las cargas', exact=True).fill('BRUNO')
                page.get_by_role('button', name='Aplicar filtros', exact=True).click()
                expect(first).to_have_count(0)
                expect(page.get_by_role('article', name='Licencia 102 de AGENTE BRUNO', exact=True)).to_be_visible()
                page.context.add_cookies([{'name': 'test-no-admin', 'value': '1', 'url': origin}])
                page.goto(origin + '/licencias/ultimas')
                expect(page.get_by_role('link', name='Editar', exact=True)).to_have_count(0)
                expect(page.get_by_role('link', name='Borrar', exact=True)).to_have_count(0)
                page.goto(origin + '/licencias/ultimas/102/editar')
                expect(page.get_by_text('No se pudo autorizar la edición.', exact=False)).to_be_visible()
                expect(page.get_by_role('button', name='Guardar cambios', exact=True)).to_have_count(0)
                assert not errors, errors
                print('Licencias UI: autores y hora argentina, edición, cancelación, confirmación de borrado, filtros, permisos, navegación interna y móvil: OK')
            finally:
                browser.close()


if __name__ == '__main__':
    main()
