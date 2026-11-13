# Control de novedades en Legajo Digital

Implementación del 13 de noviembre de 2026. La pantalla está en
`/licencias/control-novedades`, con listado, detalle, confirmación e historial.
La base requiere la migración complementaria indicada al final del documento.

## Ubicación y finalidad

El control de novedades se realiza obligatoriamente en **Legajo Digital**,
dentro de Licencias, con una entrada propia en su menú. Gestión RRHH conserva
las cargas de Francos, Horas, Médicos e Imprevistos en sus módulos de origen.
La bandeja permite corroborar las novedades y vincular las que correspondan
con Licencias, sin pedir una segunda carga ni duplicar el cómputo.

## Reglas confirmadas

| Origen | Qué muestra el control | Qué significa Confirmada |
| --- | --- | --- |
| Uso de franco | Persona, fecha, carrera, horas/minutos utilizados y autor de la carga. | Se corroboró que la persona tomó ese franco. |
| Recarga de banco | Movimiento de recarga, autor y fecha, como información separada. | No requiere una nueva confirmación del revisor: las recargas del circuito indicado ya están verificadas. |
| Horas | Persona, fecha, tipo original y minutos; Particular, Enfermedad, Oficial y Gremial. | Se completó el control administrativo de esa novedad, conservando su unidad y origen. |
| Médicos | Parte, estado de devolución, período y días del último control, y licencia vinculada cuando exista. | Se corroboró su correspondencia administrativa; no sustituye el control médico. |
| Licencias e Imprevistos | Registro vigente, persona, tipo, fechas, cantidad y procedencia. | Se completó el control administrativo de esa versión del registro. |

Las recargas verificadas no entran en la cola de francos pendientes de tomar.
Pueden verse con la etiqueta **Recarga verificada**, conservando su autoría
original. No se atribuye una confirmación al revisor si este no la realizó.
No se convierte una recarga ni un movimiento en minutos en días de licencia.

## Estados y trazabilidad

- **Pendiente de confirmación**: falta corroborar la novedad. En un franco,
  significa comprobar que efectivamente se tomó, no volver a autorizar la recarga.
- **Confirmada**: muestra quién confirmó y cuándo, además de quién cargó y cuándo.
- **Observada**: conserva el motivo para que se revise o corrija en el origen.
- Una anulación de origen se identifica como tal y deja de ser confirmable.

El control es posterior a la carga. Confirmar no vuelve a consumir el saldo,
agrega días ni modifica los cálculos del módulo de origen. Una carga futura
no se presenta automáticamente como un franco ya tomado.

Una modificación de los datos controlados —persona, fecha, tipo, duración,
devolución o anulación— invalida la confirmación anterior y requiere revisar
la versión actual. La evidencia del control anterior se conserva.
Dos revisores o una edición simultánea no pueden confirmar una versión distinta
de la que se mostró: comparación de versión y escritura en una transacción.

El nuevo estado no reutiliza `importacion_confirmada` de Licencias. Ese campo
ya controla la incorporación de importaciones al historial y tiene otra finalidad.
Tampoco equivale a la documentación pendiente ni a una aprobación profesional.

## Cruce de novedades y feriados

La bandeja muestra las novedades de la misma persona y fecha o período para
ayudar a detectar posibles duplicados o coincidencias: franco y licencia,
horas y licencia médica, o registros semejantes en más de un origen.
Una coincidencia de fecha es una advertencia, no prueba por sí sola una
incompatibilidad de horarios ni genera una segunda licencia.

Los avisos de feriados utilizan la tabla `feriados` que administra Agenda:

- Mostrar fecha y nombre del feriado cuando una novedad coincida con él.
- En períodos de varios días, identificar los feriados comprendidos.
- Advertir al consultar la carga y al confirmarla, sin rechazarla automáticamente:
  en el hospital puede corresponder trabajar o tomar un franco en esas fechas.
- Distinguir sábados y domingos de los feriados registrados. El resultado de
  `es_dia_laborable` no basta para llamar feriado a cualquier fin de semana.
- Si falla la consulta del calendario, mostrar que el control de feriados no
  pudo realizarse; una consulta fallida no equivale a un período sin feriados.

El documento no incorpora fechas de feriados nuevas ni modifica sus reglas.
La pantalla advierte que la ausencia de feriados registrados no acredita que
el calendario del año esté completo. Un cambio del calendario del período
invalida el control anterior y exige una nueva revisión.

## Relación con Médicos y Licencias

Un parte emitido no genera automáticamente una licencia ni días aprobados.
La pantalla debe distinguir **Parte emitido**, **Devolución pendiente o registrada**,
**Licencia vinculada** y el estado independiente del control de novedades.
La devolución conserva la versión y los días del control médico correspondiente.

La vinculación con una licencia existente debe comprobarse antes de crear otra.
La coincidencia de persona y fecha solo propone una revisión: no basta para
asociar automáticamente dos registros ni para deducir el código de licencia.
La regla de traslado de cada tipo de parte al catálogo de licencias requiere
su definición operativa antes de automatizar esa parte del circuito.

## Acceso e implementación

El responsable de control utiliza su propia cuenta, con permiso específico para
consultar y confirmar. La configuración de las cuentas responsables se mantiene
fuera de la lógica y de los documentos públicos: no se comprueban nombres escritos
en el código. La migración crea los roles, sin asignarlos a ninguna cuenta.
La facultad de confirmar no concede editar, borrar ni registrar controles médicos.
No se permite confirmar una carga propia.

Las lecturas y confirmaciones deben validar permisos, sesión y MFA en el servidor.
Se consulta cada origen con su identificador y versión, conservando el historial
de confirmaciones sin copiar registros operativos a una segunda tabla de licencias.
La bandeja muestra los datos administrativos necesarios; no amplía el acceso a
información médica por el solo permiso de confirmar novedades.

## Criterios de aceptación

1. La entrada **Control de novedades** aparece en Legajo Digital y respeta sus permisos.
2. Un uso de franco puede quedar **Confirmada**, con revisor y hora del servidor,
   sin crear otra licencia ni consumir nuevamente el banco.
3. Las recargas verificadas se distinguen y no aparecen como francos por corroborar.
4. Las Horas conservan su tipo y minutos y muestran las coincidencias pertinentes.
5. Los feriados registrados aparecen como advertencia; los fines de semana no se
   etiquetan por sí solos como feriados y un fallo de calendario no se oculta.
6. Una corrección o anulación del origen impide reutilizar una confirmación anterior.
7. Una cuenta sin permiso, una carga propia y una versión desactualizada no se confirman.
8. Los partes, sus devoluciones y las licencias vinculadas tienen estados diferenciados.

## Instalación y verificación

1. Hacer y comprobar un respaldo; ensayar la migración sobre una restauración
   aislada antes de modificar la base compartida con Gestión.
2. Aplicar `supabase/migrations/20261113105527_control_novedades.sql` preservando
   el historial de migraciones del proyecto existente.
3. Asignar `LICENCIAS_LECTURA` y `NOVEDADES_CONFIRMAR` a la cuenta responsable.
   Para consulta sin confirmación, usar `LICENCIAS_LECTURA` y `NOVEDADES_LECTURA`.
   No se conceden permisos de edición ni control médico por estas asignaciones.
4. Publicar el código y verificar la entrada de Licencias con una sesión autorizada.

La consulta abarca novedades desde 2026, con períodos de hasta 366 días y páginas
de 25 registros. El detalle muestra hasta 50 coincidencias y 50 controles recientes;
avisa si existen más coincidencias. El historial completo permanece en la tabla
privada `novedades_controles`, sin acceso directo desde el cliente.

Los controles guardan versión del origen, calendario y licencia vinculada, fecha
del servidor y un identificador de operación. Un reintento idéntico no duplica el
control; dos revisores sobre la misma versión no se sobrescriben. La asociación
de una licencia a un parte es explícita y comprueba persona, período y versión.
No automatiza el traslado del parte al catálogo de licencias.

Verificaciones con datos ficticios:

- `pnpm run check` y `pnpm run build`.
- `python -B scripts/test-novedades-db.py`: migración real en PostgreSQL temporal,
  permisos, autoría, calendario, versiones, vinculación y escrituras concurrentes.
- `python -B scripts/test-novedades-ui.py`: pantalla y acción de servidor reales
  con RPC sintéticas; navegación, confirmación, recargas, consulta y ancho móvil.

Estas pruebas no confirman novedades reales ni modifican datos del personal.
