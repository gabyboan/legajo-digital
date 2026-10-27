# Legajo Digital

[![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-auth_datos-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-estricto-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Panel interno para consultar y administrar legajos de personas, situacion de
revista, carrera, cargos, servicios, asistencia, francos y banco inicial de
horas.

**Estado: en desarrollo.** La base de datos se configura por separado y varias
secciones de la ficha todavía son pantallas pendientes. Antes de hacer público
el repositorio, revisar la [preparación para GitHub](docs/PREPARACION_GITHUB.md).

## Valor del proyecto

Legajo Digital digitaliza informacion administrativa sensible en un panel
ordenado, con autenticacion, permisos y separacion por modulos. El objetivo es
reducir busquedas manuales, centralizar datos de personal y preparar una base
ampliable para nuevos flujos de RRHH.

## Modulos

| Modulo | Alcance actual |
| --- | --- |
| Personas | Alta, consulta y edicion de datos principales. |
| Familiares | Consulta, edición y comprobación de identidad por DNI. |
| Asistencia y francos | Datos de asistencia y administración del banco inicial de horas. |
| Agenda | Calendario de feriados y días no laborables. |
| Validación de DNI | Comprobación externa y confirmación manual de personas y familiares. |
| Situación, carreras, cargos, funciones y servicios | Rutas reservadas; pendientes de implementación como módulos propios. |
| Historial y documentos | Rutas reservadas; pendientes de implementación. |

## Arquitectura

```txt
app/
  (private)/      rutas protegidas por Supabase Auth
  login/          ingreso y cierre de sesion
  layout.tsx      metadata global y estructura base
utils/supabase/   clientes, server helpers y middleware
proxy.ts          proteccion de rutas y renovacion de sesion
lib/              validación y utilidades compartidas
modules/          scrapers Python para comprobaciones de DNI
scripts/          pruebas, importaciones y herramientas locales
supabase/         migraciones complementarias; no contiene la base completa
docs/             prioridades y preparación para publicar
```

## Tecnologias

- Next.js 16 con App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgREST y RPC

## Seguridad

- Las rutas privadas requieren usuario autenticado.
- Las credenciales reales deben permanecer fuera de Git; usar `.env.local`.
- Las importaciones y exportaciones con datos de personal deben permanecer locales.
- No publicar dumps, claves `service_role` ni connection strings.
- Los permisos de lectura/escritura se delegan a roles y funciones de Supabase.
- Las RPC sensibles viven en el proyecto de base correspondiente.

`pnpm run check:repo` detecta archivos locales y algunos formatos de secretos en
los archivos que Git incluiría. Es un control preventivo limitado: no examina el
historial ni reemplaza una revisión de datos personales. Se encontraron
importaciones de personal en commits anteriores y se retiraron del historial de
las ramas de GitHub. Ver la [revisión de privacidad](docs/PRIVACIDAD.md) para el
alcance verificado y la gestión pendiente de versiones antiguas con GitHub Support.

## Configuracion

Copiar la plantilla de variables:

```bash
cp .env.example .env.local
```

Completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Tambien se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` como alternativa a
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### Validador de DNI local

El módulo `/personas/validacion-dni` inicia el scraper incluido en este proyecto al
presionar **Comprobar**. Requiere un servidor Next.js con Python y Playwright instalados.

```env
DNI_VALIDATOR_CWD=modules/validador-dni
DNI_VALIDATOR_SCRIPT=scraper.py
DNI_VALIDATOR_PYTHON=python
```

El check **Validar** no almacena el nombre publicado: sólo conserva la primera
confirmación manual, su fecha y el usuario que la realizó.

## Desarrollo

Requiere Node.js 22.13 o superior (se usa Node.js 24 en CI) y pnpm 11.8.0.
Python y Playwright sólo son necesarios para las comprobaciones externas de DNI.
La instalación necesita además un proyecto Supabase con el esquema y las RPC
esperadas; clonar este repositorio no crea una base funcional por sí solo.

```bash
npm install --global pnpm@11.8.0
pnpm install --frozen-lockfile
pnpm run dev
```

Abrir:

```text
http://localhost:3000
```

Para acceder desde otra computadora de la misma red, usar la IPv4 de esta
computadora, por ejemplo `http://192.168.1.10:3000`. La red de Windows debe
estar configurada como **Privada** y el puerto TCP `3000` debe estar permitido
en el firewall. PowerShell debe ejecutarse como administrador para crear la
regla:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private
New-NetFirewallRule -DisplayName "Legajo Digital (TCP 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

La configuración de inicio automático intenta crear esta regla cuando se
ejecuta con permisos suficientes y muestra las URLs disponibles.

## Validacion

```bash
pnpm run check
pnpm run build
```

`check` revisa los archivos del repositorio, ejecuta ESLint sin advertencias,
genera los tipos de rutas de Next.js, comprueba TypeScript y ejecuta las pruebas
Node del control de repositorio, DNI y familiares. Estas pruebas usan datos sintéticos y dobles de prueba;
no verifican RLS ni el funcionamiento de una base real.

GitHub Actions ejecuta los mismos controles y la compilación con configuración
de ejemplo, sin credenciales productivas. La auditoría de dependencias se
ejecuta por separado con `pnpm audit --prod`; sus pendientes se registran en la
[preparación para GitHub](docs/PREPARACION_GITHUB.md).

Para ejecutar la compilación localmente:

```bash
pnpm run build
pnpm run start
```

El servidor completo necesita Node.js y, para los validadores, Python y los
navegadores de Playwright. GitHub aloja el código; la aplicación con sus acciones
y procesos Python requiere un entorno de servidor.

## Supabase

El proyecto espera objetos de base y RPC mantenidos en el repositorio de
auditoria/migraciones `gabyboan/hesm-supabase`.

RPC relevantes para francos/asistencia:

- `rpc_francos_horario`
- `rpc_francos_horario_guardar`
- `rpc_francos_saldo_inicial_actual`
- `rpc_francos_saldo_inicial`
- `rpc_francos_saldo_inicial_eliminar`

Permisos esperados:

- Edicion de legajo: roles configurados en `usuario_roles`.
- Lectura de francos: `can_francos_read()`.
- Escritura de francos/asistencia/banco inicial: `can_francos_write()`.

## Estado

Proyecto en desarrollo activo. El repositorio publico muestra arquitectura,
modulos y enfoque tecnico; la configuracion productiva y los datos reales no
forman parte del codigo versionado.

## Módulo de validación de DNI

El scraper está incluido en `modules/validador-dni`. Requiere un servidor Node.js con Python y Chromium:

```sh
python -m pip install -r modules/validador-dni/requirements.txt
python -m playwright install chromium
```

La carpeta predeterminada pertenece a este proyecto. `DNI_VALIDATOR_CWD`, `DNI_VALIDATOR_SCRIPT` y `DNI_VALIDATOR_PYTHON` permiten configurar el entorno. No es compatible con runtimes que no permiten iniciar procesos Python.

Aplicar `supabase/migrations/20260907113237_modulo_validador_familiares.sql` antes de usar la validación de familiares. Agrega CUIT/CUIL y fecha de validación a familiares, invalida la confirmación al cambiar su identidad y protege el CUIT existente de personas dentro de la transacción.

La comprobación muestra inconsistencias de CUIT antes de guardar. Un CUIT vacío se completa al validar; uno distinto bloquea el guardado hasta revisar el dato. La validación de familiares está en `/personas/validacion-dni/familiares`.

En **Datos de Familiares**, ingresá sólo el número de documento y presioná
**Consultar apellido y nombre por DNI**. Se usa el scraper incluido en
[`modules/validador-familiares`](modules/validador-familiares/README.md).
Consulta CuitOnline, Nosis y Dateas secuencialmente con Firefox en segundo plano
y muestra los nombres, CUIT/CUIL de referencia y estado de cada fuente.
Conserva todas las coincidencias y distingue una búsqueda sin datos de un bloqueo.

```powershell
python -m pip install -r modules/validador-familiares/requirements.txt
python -m playwright install firefox
```

La consulta funciona antes de completar apellido y nombre. Si ya están
cargados, compara cada resultado; se mantienen visibles mientras se corrigen
los nombres y se descartan al cambiar el DNI. No guarda ni valida al familiar.
`DNI_FAMILIARES_CWD` permite configurar una copia compatible del scraper;
por defecto usa la incluida. `DNI_VALIDATOR_PYTHON` selecciona Python.
La consulta requiere sesión y permiso de edición; limita a una búsqueda
simultánea por proceso y a cuatro minutos por consulta.

Pruebas de la integración:

```powershell
node scripts/test-consulta-nombre-familiar.cjs
node scripts/test-familiar-verificacion.cjs
# Con pnpm run dev en localhost:3000; usa respuestas sintéticas.
python -B scripts/test-consulta-familiar-ui.py
```

En la validación de familiares existentes se conserva únicamente la fecha de
confirmación; el CUIT/CUIL continúa siendo parte del flujo del personal.

## Inicio automatico en Windows

En esta computadora, Legajo Digital puede iniciarse en segundo plano al entrar
a Windows con el usuario que activa la configuracion. Ejecuta el mismo servidor
de desarrollo que `pnpm run dev`, en `http://localhost:3000`, y vuelve a iniciarlo
10 segundos despues de que se cierre. No requiere una terminal abierta.

Activar o volver a iniciar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/configurar-inicio-automatico.ps1
```

Desactivar y detener el servidor administrado:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/configurar-inicio-automatico.ps1 -Desactivar
```

La configuracion crea `Legajo Digital.lnk` en la carpeta Inicio del usuario.
Los registros se guardan en `.runtime/` y no se versionan. Se evita iniciar
copias simultaneas y no se detienen otros procesos que ocupen el puerto 3000.
La computadora debe estar encendida, sin suspender y con la sesion de Windows
abierta. Esto inicia el servidor; el acceso al sistema conserva su autenticacion
habitual.
