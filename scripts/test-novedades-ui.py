"""Prueba pantallas y acción reales con RPC sintéticas, sin datos del personal."""
from playwright.sync_api import sync_playwright, expect
from ui_preview import preview_server

CLIENT = r'''import {cookies} from 'next/headers'
const base={origen:'franco',id:101,dni:12345678,persona:'PERSONA FICTICIA',legajo:10,carrera_id:1,desde:'2026-11-12',hasta:'2026-11-12',minutos:120,cantidad:null,unidad:'minutos',tipo:'Uso de franco',usuario_carga:'otra-cuenta',cargado_por:'Operadora Ficticia',cargado_at:'2026-11-12T12:00:00Z',version:'a'.repeat(32),control_id:0,calendario_version:'b'.repeat(32),estado:'pendiente',anulada:false,recarga:false,puede_confirmar:true,carga_propia:false,control_desactualizado:false,confirmado_por:null,controlado_at:null,observacion:null,licencia_id:null,feriados:[{fecha:'2026-11-12',nombre:'Feriado ficticio'}],documento:{},coincidencias:[{origen:'hora',id:201,desde:'2026-11-12',hasta:'2026-11-12',minutos:90,cantidad:null,unidad:'minutos',tipo:'GREMIAL',version:'c'.repeat(32)}],historial:[]}
const root=globalThis as any;root.novedadesDemo??=[base,{...base,id:102,recarga:true,tipo:'Recarga de banco',estado:'recarga_verificada',puede_confirmar:false}]
export async function createClient(){const jar=await cookies();return {
 auth:{async getUser(){return {data:{user:{id:'revisor-ficticio'}},error:null}}},
 async rpc(name:string,args:any={}){
  if(name==='verificar_mfa_opcional')return {error:null}
  if(name.startsWith('can_'))return {data:!(name==='can_novedades_confirm'&&jar.has('solo-lectura')),error:null}
  if(name==='rpc_novedades_listar')return {data:root.novedadesDemo.filter((n:any)=>args.p_estado==='todas'||n.estado===args.p_estado),error:null}
  if(name==='rpc_novedades_detalle')return {data:root.novedadesDemo.find((n:any)=>n.id===args.p_id),error:null}
  if(name==='rpc_novedades_controlar'){
   const n=root.novedadesDemo.find((n:any)=>n.id===args.p_id)
   if(n.control_id!==args.p_control_id)return {error:{code:'40001'}}
   Object.assign(n,{control_id:n.control_id+1,estado:args.p_estado,confirmado_por:'Revisor Ficticio',controlado_at:'2026-11-13T12:00:00Z',observacion:args.p_observacion})
   n.historial.push({id:n.control_id,estado:args.p_estado,usuario:'Revisor Ficticio',fecha:n.controlado_at,observacion:n.observacion,licencia_id:null,version:n.version})
   return {data:{id:n.control_id},error:null}
  }
  throw new Error('RPC desconocida en fixture')
 }
}}
export async function sesionLicencias(){return createClient()}
'''


def wrapper(path):
    return f"""import Page from '@/app/(private)/licencias/control-novedades/{path}page'
import {{ AppNavigation }} from '@/app/(private)/components/app-navigation'
export default function Preview(props:any){{return <div className="min-h-screen bg-zinc-950 text-white"><div className="min-h-screen md:flex"><AppNavigation account={{<p>Cuenta ficticia</p>}}/><main className="min-w-0 flex-1 p-4"><Page {{...props}}/></main></div></div>}}"""


def main():
    listing=wrapper('')
    files={'fixtures/client.ts':CLIENT,'app/licencias/control-novedades/page.tsx':listing,
           'app/licencias/control-novedades/[origen]/[id]/page.tsx':wrapper('[origen]/[id]/')}
    aliases={'@/utils/supabase/server':['./fixtures/client.ts'],'@/lib/licencias/server':['./fixtures/client.ts']}
    with preview_server('control-novedades-ui',listing,3123,extra_files=files,aliases=aliases) as (origin,artifacts):
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            try:
                page=browser.new_page(viewport={'width':1440,'height':1000})
                errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(origin+'/licencias/control-novedades',wait_until='networkidle')
                expect(page.get_by_role('heading',name='Control de novedades',exact=True)).to_be_visible()
                expect(page.get_by_text('Feriado en Agenda: 12/11/2026 · Feriado ficticio',exact=True)).to_be_visible()
                expect(page.get_by_text('Recarga de banco',exact=True)).to_have_count(0)
                page.get_by_role('link',name='Abrir control y coincidencias →').first.click()
                expect(page.get_by_role('heading',name='Registrar control')).to_be_visible(timeout=60000)
                expect(page.get_by_role('link',name='Horas #201 · GREMIAL')).to_be_visible()
                for width in [320,390,768,1440]:
                    page.set_viewport_size({'width':width,'height':1000})
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Desborde a {width}'
                page.screenshot(path=str(artifacts/'control-franco.png'),full_page=True)
                page.get_by_label('Corroboré si la persona tomó este franco y contrasté la carga.').check()
                page.get_by_label('Revisé las coincidencias y los avisos del calendario que se muestran en esta página.').check()
                page.get_by_role('button',name='Guardar control',exact=True).click()
                expect(page.get_by_text('Confirmada',exact=True).first).to_be_visible()
                expect(page.get_by_text('Control: Revisor Ficticio',exact=False)).to_be_visible()
                expect(page.get_by_text('2 h 00 min',exact=False).first).to_be_visible()
                page.screenshot(path=str(artifacts/'franco-confirmada.png'),full_page=True)
                page.goto(origin+'/licencias/control-novedades/franco/102',wait_until='networkidle')
                expect(page.get_by_text('Recarga verificada',exact=True)).to_be_visible()
                expect(page.get_by_role('button',name='Guardar control')).to_have_count(0)
                page.context.add_cookies([{'name':'solo-lectura','value':'1','url':origin}])
                page.goto(origin+'/licencias/control-novedades/franco/101',wait_until='networkidle')
                expect(page.get_by_role('button',name='Guardar control')).to_have_count(0)
                assert not errors,errors
                print('Control de novedades UI: navegación, feriado, cruce de Horas, confirmación, autoría, recarga, lectura y móvil: OK')
            finally:browser.close()


if __name__=='__main__':main()
