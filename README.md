# Legajo Digital

Panel interno para consultar y administrar legajos de personal, datos de
contacto, domicilios, familiares, asistencia y banco de horas.

**En desarrollo.** El repositorio contiene el código y pruebas con datos
sintéticos. La aplicación requiere un servidor y un proyecto Supabase configurado;
GitHub aloja el código, no los legajos ni una aplicación lista para usar.

## Funciones disponibles

| Módulo | Alcance actual |
| --- | --- |
| Personas | Alta, búsqueda, consulta, edición y exportación XLSX. |
| Edición de ficha | Seis pestañas: identificación, contacto, datos laborales, formación, domicilio y observaciones. |
| Contacto | Teléfono único; los registros anteriores con dos números distintos requieren revisión explícita. |
| Domicilio | Dirección estructurada, Casa/Torre, provincia/localidad e historial de cambios. |
| Familiares | Consulta, edición y comprobación externa de identidad por DNI. |
| Asistencia y francos | Horarios y administración del banco inicial de horas, con permisos propios. |
| Agenda | Calendario de feriados y días no laborables. |
| Acceso | Supabase Auth y paso de código para cuentas con aplicación autenticadora configurada. |

Se puede cambiar de pestaña sin perder lo escrito. **Guardar cambios** envía todas
las secciones y valida también los obligatorios de las pestañas ocultas.
Si otra edición modificó la ficha, el guardado se rechaza sin sobrescribirla y el
borrador permanece visible. La comparación y la escritura se realizan dentro de
la misma transacción de PostgreSQL.

Situación, carreras, cargos, funciones, servicios, historial general y documentos
tienen rutas reservadas; sus módulos propios todavía no están implementados.
La ficha sí muestra los datos disponibles de carrera y situación.

## Requisitos

- Node.js 22.13 o superior; CI utiliza Node.js 24.
- pnpm 11.8.0.
- Supabase con el esquema, roles, RLS y funciones esperados por el proyecto.
- Python y Playwright para las consultas externas de DNI y las pruebas de navegador.
- Binarios de PostgreSQL para las pruebas de guardado y concurrencia en una base temporal.

Versiones y criterios de actualización: [dependencias](docs/DEPENDENCIAS.md).

## Instalación local

```bash
git clone https://github.com/gabyboan/legajo-digital.git
cd legajo-digital
npm install --global pnpm@11.8.0
pnpm install --frozen-lockfile
```

Copiar `.env.example` a `.env.local` (`cp` en Bash o `Copy-Item` en PowerShell)
y completar los valores del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

También se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` como alternativa a la clave
publicable. Las variables adicionales para validadores y acceso por red están
documentadas en [.env.example](.env.example).

```bash
pnpm run dev
```

Abrir `http://localhost:3000` e ingresar con una cuenta del proyecto Supabase.
Si esa cuenta tiene MFA configurada, el sistema solicita su código antes de
acceder al panel. Este flujo no configura ni recupera autenticadores.

### Base de datos

Las migraciones incluidas son **complementarias**: todavía no permiten construir
todo el esquema desde una base vacía. La configuración de la base se mantiene
por separado. Se necesitan, entre otros, `personas`, catálogos, relaciones de
carrera y situación, `persona_domicilios`, familiares y los objetos de asistencia.

La lectura y escritura respetan RLS y los roles del proyecto. La edición de
legajo utiliza `private.has_legajo_edit_role()`; asistencia y francos conservan
`can_francos_read()` y `can_francos_write()`.

Funciones relevantes para la ficha:

- `rpc_persona_ficha_edicion`: obtiene una ficha y su versión en una sola lectura.
- `rpc_persona_editar_versionada`: bloquea, comprueba la versión y guarda la edición.
- `rpc_persona_guardar_con_escolaridad` y `rpc_persona_guardar`: persistencia e historial existentes.

El control de concurrencia requiere la migración
[`20261028111643_proteger_edicion_simultanea_persona.sql`](supabase/migrations/20261028111643_proteger_edicion_simultanea_persona.sql),
después del ajuste de [conservación de Casa](supabase/migrations/20261028110057_preservar_casa_domicilio.sql).
Estas migraciones requieren los objetos anteriores; el ajuste de Casa verifica
la definición de origen para evitar reemplazar una función diferente.

Contrato, comportamiento y límites: [formularios](docs/FORMULARIOS.md) y
[concurrencia](docs/CONCURRENCIA.md).

### Consultas externas de DNI

Los validadores ejecutan procesos Python desde el servidor Next.js:

```bash
python -m pip install -r modules/validador-dni/requirements.txt
python -m pip install -r modules/validador-familiares/requirements.txt
python -m playwright install chromium firefox
```

La consulta por DNI muestra resultados y su correspondencia con los nombres;
la confirmación manual es un paso separado. Consultar un familiar no lo da de
alta ni lo valida automáticamente. Las fuentes externas pueden fallar o bloquear
consultas. Detalles en [validador de familiares](modules/validador-familiares/README.md).

## Comprobaciones

```bash
pnpm run check
pnpm run audit:deps
pnpm run build
python -B scripts/test-domicilio-rpc.py
```

`check` revisa archivos, ESLint, tipos y pruebas Node de formulario, MFA,
exportación y validadores. Las pruebas de PostgreSQL crean una base temporal con
datos ficticios y comprueban historial, permisos y dos ediciones simultáneas.
Usar `--pg-bin /ruta/a/postgresql/bin` si no se detectan los binarios.

Pruebas de interfaz aisladas, con Playwright instalado:

```bash
python -B scripts/test-persona-form-ui.py
python -B scripts/test-mfa-ui.py
python -B scripts/test-navegacion-ui.py
```

GitHub Actions ejecuta las comprobaciones Node, la auditoría de dependencias,
las pruebas de PostgreSQL y la compilación con configuración de ejemplo.
Las pruebas de interfaz se ejecutan por separado. Los fixtures no sustituyen
las comprobaciones de permisos efectivos y flujos completos con usuarios del proyecto.

## Servidor

```bash
pnpm run build
pnpm run start
```

El entorno debe permitir procesos Python y navegadores de Playwright si se usan
los validadores. La aplicación completa no es una exportación estática para
GitHub Pages.

Para el inicio automático de desarrollo en Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/configurar-inicio-automatico.ps1
```

El script configura un acceso en Inicio, ejecuta el servidor en segundo plano y
guarda registros locales en `.runtime/`. Para desactivarlo, agregar `-Desactivar`.
La computadora debe permanecer encendida y con la sesión de Windows abierta.

## Organización

```text
app/(private)/    páginas y acciones del panel
app/auth/mfa/    verificación con autenticador
app/api/         exportación, Georef y validadores
lib/personas/    contratos, validación, consultas y persistencia de fichas
lib/auth/        decisiones y acciones del flujo MFA
utils/supabase/  clientes de servidor, navegador y renovación de sesión
modules/         consultas externas en Python
scripts/         verificaciones y herramientas locales
supabase/        migraciones complementarias
docs/            decisiones, comprobaciones y pendientes
```

## Datos y pendientes

`.env.local`, `.runtime/`, importaciones, exportaciones y respaldos con datos reales
quedan fuera de Git. `pnpm run check:repo` comprueba archivos y algunos formatos
de secretos; el análisis adicional del historial está en la
[revisión de privacidad](docs/PRIVACIDAD.md). La retirada de vistas antiguas del
historial sigue gestionándose con GitHub Support.

Los próximos trabajos incluyen un esquema reproducible desde cero, completar los
módulos reservados y ampliar la validación de permisos en el entorno de prueba.
La lista completa está en [preparación para GitHub](docs/PREPARACION_GITHUB.md).
