"""Browser checks with real form/validation and a synthetic save action; no database."""
from playwright.sync_api import sync_playwright, expect
from ui_preview import preview_server

PAGE = '''import { PersonaForm } from '@/app/(private)/personas/components/persona-form'
import { RefreshFixture } from '../refresh-fixture'
import { validarPersona } from '@/lib/personas/formulario'
import type { PersonaFormState } from '@/lib/personas/types'
async function save(_state: PersonaFormState, formData: FormData): Promise<PersonaFormState> {
  'use server'
  await new Promise((resolve) => setTimeout(resolve, 650))
  const result = validarPersona(formData)
  if (!result.ok) return result.state
  return { status: 'error', message: 'Prueba completada: no se guardaron datos reales.', values: result.values }
}
export default async function Preview({ searchParams }: { searchParams: Promise<{ caso?: string }> }) {
  const params = await searchParams
  const persona = {
    dni: 12345678, legajo: 10, apellido: 'Persona', nombre: 'Ficticia',
    email: 'persona@example.invalid', telefono: '+54 11 5555-0100',
    numero_contacto: params.caso === 'pendiente' ? 1155550200 : 541155550100,
    fecha_nacimiento: null, cuil: null, reloj: null, indice: null, sexo_id: null,
    estado_civil: null, fecha_ingreso: null, formacion_estudio: null, matricula: null,
    nivel_escolaridad: null, estado_escolaridad: null, fecha_inicio_tarea_especifica: null,
    observacion: null,
  }
  const domicilio = ['guardado','refresh'].includes(params.caso || '') ? {
    calle:'Calle conservada', numero:'007', barrio:'Barrio de prueba', piso:'0', casa:'A', torre:'02',
    provincia_georef_id:'01', provincia_nombre:'Provincia de prueba',
    localidad_georef_id:'0101', localidad_nombre:'Localidad ficticia',
    referencias:'Referencia de prueba',
  } : null
  const Form = params.caso === 'refresh' ? RefreshFixture : PersonaForm
  return <main className="mx-auto max-w-3xl p-4"><h1 className="mb-4 text-2xl font-bold">Editar persona de prueba</h1>
    <Form fichaVersion={'1'.repeat(32)} persona={persona} carreras={[{ id:1, nombre:'Carrera de prueba' }]} situaciones={[{id:2,nombre:'Titular'}]} sexos={[]}
      domicilio={domicilio} domicilioError={params.caso === 'error-domicilio' ? 'No se pudo cargar el domicilio vigente.' : null} carreraActualId="1" situacionActualId="2" action={save} />
  </main>
}
'''

REFRESH_FIXTURE = ''''use client'
import {useState, type ComponentProps} from 'react'
import {PersonaForm} from '@/app/(private)/personas/components/persona-form'
export function RefreshFixture(props: ComponentProps<typeof PersonaForm>) {
  const [domicilio,setDomicilio]=useState(props.domicilio)
  const [version,setVersion]=useState(props.fichaVersion)
  return <><button type="button" onClick={() => {setVersion('2'.repeat(32));setDomicilio((old) => ({...old,
    calle:old?.calle === 'Calle actualizada' ? 'Otro cambio externo' : 'Calle actualizada',
    provincia_georef_id:'02',provincia_nombre:'Otra provincia',localidad_georef_id:'0201',localidad_nombre:'Otra localidad',
  }))}}>Simular domicilio actualizado en la base</button><PersonaForm {...props} fichaVersion={version} domicilio={domicilio}/></>
}
'''


def main():
    with preview_server('persona-form', PAGE, 3111, extra_files={'refresh-fixture.tsx':REFRESH_FIXTURE}) as (origin, artifacts):
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            try:
                page=browser.new_page(viewport={'width':390,'height':844})
                errors=[]
                page.on('pageerror',lambda error: errors.append(str(error)))
                page.route('**/api/georef/provincias',lambda route: route.fulfill(json={'options':[{'id':'01','nombre':'Provincia de prueba'}]}))
                page.route('**/api/georef/localidades?**',lambda route: route.fulfill(json={'options':[{'id':'0101','nombre':'Localidad ficticia'}]}))
                page.goto(origin,wait_until='networkidle')
                def choose(name):
                    page.get_by_role('tab',name=name).click()
                    expect(page.get_by_role('tab',name=name)).to_have_attribute('aria-selected','true')

                expect(page.get_by_role('tablist',name='Secciones de la ficha')).to_be_visible()
                expect(page.get_by_role('tab')).to_have_count(6)
                expect(page.get_by_role('tabpanel')).to_have_count(1)
                expect(page.get_by_role('tab',name='Identificación')).to_have_attribute('aria-selected','true')
                expect(page.get_by_role('button',name='Anterior',exact=True)).to_be_disabled()
                expect(page.locator('input[name=domicilio_presente]')).to_have_value('0')
                expect(page.locator('input[type=tel]')).to_have_count(1)
                expect(page.locator('input[name=numero_contacto]')).to_have_count(0)
                expect(page.get_by_text('Contacto pendiente de revisión',exact=True)).to_have_count(0)
                for name in ['Identificación','Contacto','Datos laborales','Formación','Domicilio','Observaciones']:
                    choose(name)
                    expect(page.get_by_role('group',name=name,exact=True)).to_be_visible()
                    expect(page.get_by_role('tabpanel')).to_have_count(1)
                expect(page.get_by_role('button',name='Siguiente',exact=True)).to_be_disabled()
                page.get_by_role('tab',name='Observaciones').press('Home')
                expect(page.get_by_role('tab',name='Identificación')).to_be_focused()
                page.get_by_role('tab',name='Identificación').press('ArrowRight')
                expect(page.get_by_role('tab',name='Contacto')).to_be_focused()
                expect(page.get_by_role('tab',name='Contacto')).to_have_attribute('aria-selected','true')
                page.get_by_role('tab',name='Contacto').press('End')
                expect(page.get_by_role('tab',name='Observaciones')).to_be_focused()
                choose('Identificación')
                page.get_by_role('button',name='Siguiente',exact=True).click()
                expect(page.get_by_role('tab',name='Contacto')).to_have_attribute('aria-selected','true')
                page.get_by_role('button',name='Anterior',exact=True).click()
                page.get_by_label('Nombre *',exact=True).fill('Nombre editado')
                choose('Domicilio')
                page.get_by_label('Calle',exact=True).fill('Calle de prueba')
                page.get_by_label('Casa',exact=True).fill('C-01')
                page.get_by_label('Torre',exact=True).fill('02')
                expect(page.locator('input[name=domicilio_presente]')).to_have_value('1')
                page.get_by_label('Provincia',exact=True).select_option('01')
                page.get_by_label('Ciudad / localidad',exact=True).select_option('0101')
                choose('Contacto')
                page.get_by_label('Email',exact=True).fill('correo incorrecto')
                # Bypass the browser constraint to exercise the real server validation.
                choose('Observaciones')
                page.get_by_label('Email',exact=True).evaluate("(input) => input.type = 'text'")
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(page.get_by_role('button',name='Guardando…',exact=True)).to_be_disabled()
                expect(page.get_by_role('tab',name='Contacto')).to_be_disabled()
                alert=page.get_by_role('alert',name='Error al guardar la ficha')
                expect(alert).to_contain_text('email válido')
                expect(alert).to_be_focused()
                expect(page.get_by_role('tab',name='Contacto')).to_have_attribute('aria-selected','true')
                expect(page.get_by_label('Email',exact=True)).to_have_value('correo incorrecto')
                choose('Identificación')
                expect(page.get_by_label('Nombre *',exact=True)).to_have_value('Nombre editado')
                choose('Domicilio')
                expect(page.get_by_label('Calle',exact=True)).to_have_value('Calle de prueba')
                expect(page.get_by_label('Casa',exact=True)).to_have_value('C-01')
                expect(page.get_by_label('Torre',exact=True)).to_have_value('02')
                expect(page.get_by_label('Provincia',exact=True)).to_have_value('01')
                expect(page.get_by_label('Ciudad / localidad',exact=True)).to_have_value('0101')
                choose('Contacto')
                page.get_by_label('Email',exact=True).fill('corregido@example.invalid')
                choose('Formación')
                page.get_by_label('Matrícula',exact=True).evaluate("(input) => input.value = 'ABCDEFGHIJK'")
                choose('Observaciones')
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(alert).to_contain_text('10 caracteres')
                expect(page.get_by_role('tab',name='Formación')).to_have_attribute('aria-selected','true')
                expect(page.get_by_label('Matrícula',exact=True)).to_have_value('ABCDEFGHIJK')
                page.get_by_label('Matrícula',exact=True).fill('AB123')
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(alert).to_contain_text('no se guardaron datos reales')
                expect(page.get_by_role('tab',name='Formación')).to_have_attribute('aria-selected','true')
                choose('Identificación')
                expect(page.get_by_label('Nombre *',exact=True)).to_have_value('Nombre editado')
                choose('Domicilio')
                expect(page.get_by_label('Calle',exact=True)).to_have_value('Calle de prueba')
                choose('Contacto')
                page.get_by_role('group',name='Contacto',exact=True).screenshot(path=str(artifacts/'contacto.png'))

                # Required fields remain required when their panels are hidden.
                posts=[]
                page.on('request',lambda request: posts.append(request.url) if request.method=='POST' else None)
                choose('Identificación')
                page.get_by_label('Nombre *',exact=True).fill('')
                choose('Datos laborales')
                page.get_by_label('Carrera *',exact=True).select_option('')
                choose('Observaciones')
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(page.get_by_role('tab',name='Identificación')).to_have_attribute('aria-selected','true')
                expect(page.get_by_label('Nombre *',exact=True)).to_be_focused()
                assert len(posts)==0,'Browser validation must block missing hidden required fields'
                page.get_by_label('Nombre *',exact=True).fill('Nombre editado')
                choose('Contacto')
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(page.get_by_role('tab',name='Datos laborales')).to_have_attribute('aria-selected','true')
                expect(page.get_by_label('Carrera *',exact=True)).to_be_focused()
                assert len(posts)==0
                # Server validation still enforces requirements if browser attributes are removed.
                choose('Identificación')
                page.get_by_label('Nombre *',exact=True).fill('')
                choose('Observaciones')
                page.get_by_label('Carrera *',exact=True).evaluate('(input) => input.required = false')
                page.get_by_label('Nombre *',exact=True).evaluate('(input) => input.required = false')
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(alert).to_contain_text('Completá el nombre')
                expect(page.get_by_role('tab',name='Identificación')).to_have_attribute('aria-selected','true')
                alert.get_by_role('link',name='Completá la carrera.').click()
                expect(page.get_by_label('Carrera *',exact=True)).to_be_focused()
                expect(page.get_by_role('tab',name='Datos laborales')).to_have_attribute('aria-selected','true')

                page.goto(origin+'?caso=pendiente',wait_until='networkidle')
                choose('Contacto')
                phone=page.get_by_label('Teléfono / celular',exact=True)
                expect(phone).to_have_attribute('readonly','')
                expect(page.get_by_text('Contacto pendiente de revisión',exact=True)).to_be_visible()
                confirm=page.get_by_role('checkbox')
                confirm.check()
                phone.fill('+54 11 5555-0300')
                confirm.uncheck()
                expect(phone).to_have_value('+54 11 5555-0100')
                expect(phone).to_have_attribute('readonly','')
                page.get_by_role('group',name='Contacto',exact=True).screenshot(path=str(artifacts/'contacto-pendiente.png'))
                for width in [320,390,768,1280]:
                    page.set_viewport_size({'width':width,'height':900})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
                page.set_viewport_size({'width':1280,'height':900})
                choose('Identificación')
                assert page.get_by_role('tablist').evaluate('(tabs) => tabs.scrollWidth <= tabs.clientWidth'),'All six tabs should fit the desktop form'
                page.screenshot(path=str(artifacts/'pestanas-desktop.png'),full_page=True,animations='disabled')
                page.set_viewport_size({'width':390,'height':844})
                choose('Domicilio')
                page.screenshot(path=str(artifacts/'pestanas-mobile.png'),full_page=True,animations='disabled')

                # Existing persisted values survive tab changes and a failed Georef request.
                page.route('**/api/georef/provincias',lambda route: route.fulfill(status=502,json={'error':'Georef no disponible.'}))
                page.route('**/api/georef/localidades?**',lambda route: route.fulfill(status=502,json={'error':'Georef no disponible.'}))
                page.goto(origin+'?caso=guardado',wait_until='networkidle')
                choose('Domicilio')
                expect(page.get_by_label('Calle',exact=True)).to_have_value('Calle conservada')
                expect(page.get_by_label('Número',exact=True)).to_have_value('007')
                expect(page.get_by_label('Piso',exact=True)).to_have_value('0')
                expect(page.get_by_label('Provincia',exact=True)).to_have_value('01')
                expect(page.get_by_label('Ciudad / localidad',exact=True)).to_have_value('0101')
                expect(page.get_by_label('Provincia',exact=True)).to_contain_text('Provincia de prueba')
                expect(page.locator('input[name=domicilio_presente]')).to_have_value('0')
                choose('Contacto')
                page.get_by_label('Email',exact=True).fill('otro@example.invalid')
                expect(page.locator('input[name=domicilio_presente]')).to_have_value('0')
                choose('Domicilio')
                page.get_by_label('Número',exact=True).fill('008')
                expect(page.locator('input[name=domicilio_presente]')).to_have_value('1')
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(alert).to_contain_text('no se guardaron datos reales')
                expect(page.get_by_label('Número',exact=True)).to_have_value('008')
                expect(page.get_by_label('Provincia',exact=True)).to_have_value('01')

                # A read failure is not shown as an editable, blank address.
                page.goto(origin+'?caso=error-domicilio',wait_until='networkidle')
                choose('Domicilio')
                expect(page.get_by_role('group',name='Domicilio',exact=True)).to_contain_text('No se pudo cargar el domicilio vigente')
                expect(page.get_by_label('Calle',exact=True)).to_be_disabled()
                expect(page.locator('input[name=domicilio_presente]')).to_have_value('0')
                expect(page.locator('input[name=domicilio_version]')).to_have_value('')
                choose('Contacto')
                page.get_by_label('Email',exact=True).fill('editable@example.invalid')
                page.get_by_role('button',name='Guardar cambios',exact=True).click()
                expect(alert).to_contain_text('no se guardaron datos reales')
                page.goto(origin+'?caso=refresh',wait_until='networkidle')
                expect(page.locator('input[name=ficha_version]')).to_have_value('1'*32)
                choose('Domicilio')
                expect(page.get_by_label('Calle',exact=True)).to_have_value('Calle conservada')
                page.get_by_role('button',name='Simular domicilio actualizado en la base').click()
                expect(page.locator('input[name=ficha_version]')).to_have_value('1'*32)
                expect(page.get_by_label('Calle',exact=True)).to_have_value('Calle actualizada')
                expect(page.get_by_label('Provincia',exact=True)).to_have_value('02')
                expect(page.get_by_label('Ciudad / localidad',exact=True)).to_have_value('0201')
                expect(page.locator('input[name=domicilio_presente]')).to_have_value('0')
                snapshot=page.locator('input[name=domicilio_version]').input_value()
                page.get_by_label('Calle',exact=True).fill('Borrador sin guardar')
                page.get_by_role('button',name='Simular domicilio actualizado en la base').click()
                expect(page.get_by_label('Calle',exact=True)).to_have_value('Borrador sin guardar')
                expect(page.locator('input[name=domicilio_version]')).to_have_value(snapshot)
                expect(page.get_by_role('status')).to_contain_text('El domicilio guardado cambió')
                assert not errors,errors
                print('Formulario: pestañas y teclado, datos conservados, obligatorios ocultos, errores de servidor y contacto pendiente: OK')
            finally:
                browser.close()


if __name__=='__main__':
    main()
