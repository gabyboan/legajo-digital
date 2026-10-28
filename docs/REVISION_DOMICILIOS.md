# Revisión de domicilios del 28 de octubre de 2026

## Alcance y decisión

Se consultaron el esquema, las funciones de guardado, las cantidades de registros
y el historial de los dos casos indicados por el propietario. Inicialmente se
conservó sólo el diagnóstico y las protecciones. Después, el propietario pidió
expresamente recuperar los domicilios con las actualizaciones guardadas más
recientes. La restauración acotada descrita abajo se aplicó con esa autorización.

La carpeta original y la copia activa de PC-04 usan la misma URL y la misma clave
publicable de Supabase. No se trasladaron los datos a otra base al cambiar la
carpeta de ejecución. El proyecto usado por Legajo es el que figura en la
configuración local, no el proyecto del formulario separado.

## Hallazgos confirmados en la base

- `persona_domicilios` contiene 1110 versiones para 416 personas, con 416
  domicilios vigentes al momento de la consulta.
- Una carga con la misma marca de tiempo del **16/10/2026** creó **313 versiones**;
  **293 de ellas seguían vigentes** durante la revisión.
- Había **294 domicilios vigentes sin provincia** y **294 sin localidad**.
- En el primer caso, el domicilio confirmado por el propietario está en una
  versión del **14/10/2026**. Esa versión se cerró el **16/10/2026**, al crear el
  domicilio que todavía figuraba vigente. El dato anterior sigue en el historial.
- En el segundo caso, la calle indicada como actual ya figura vigente en la base
  desde el **26/10/2026**. No corresponde reemplazar ese registro por uno histórico.
- La tabla real también tiene `casa` y `torre`. La función inspeccionada conserva
  Torre cuando un formulario anterior omite ese campo, pero no conserva Casa al
  crear una nueva versión. Había 33 domicilios vigentes con un dato de Casa.

La carga masiva explica el reemplazo del primer caso. No se atribuyó esa carga a
una persona o proceso: que `created_by` esté vacío no identifica al responsable.
Tampoco se asumió que todas sus versiones sean incorrectas ni que los domicilios
faltantes deban completarse automáticamente con una ciudad o provincia fija.

## Restauración autorizada y verificada

Se respaldaron las **1110 versiones de las 416 personas** antes de modificar datos.
Para los domicilios que seguían vigentes desde el lote identificado del 16/10,
se buscó la última versión guardada antes de ese lote y de sus dos cargas previas
del mismo día. Se recuperaron **212 actualizaciones** con una calle estructurada.
Esto incluye el primer caso confirmado por el propietario.

Se conservaron **204 domicilios vigentes** sin cambios:

- 123 estaban fuera del lote afectado, incluidos los cambios posteriores y el
  segundo caso confirmado, actualizado el 26/10.
- 80 sólo tenían como alternativa histórica un registro de origen sin calle
  estructurada, cuyo contenido estaba en «Otros datos». Volver a esa versión
  habría quitado campos actualmente disponibles.
- Uno ya coincidía con su versión anterior.

La operación comprobó antes de escribir que las 212 parejas de versión vigente
y versión de origen coincidían con el respaldo. Una única transacción bloqueó
los registros correspondientes, cerró sus versiones vigentes e insertó nuevas
versiones con todos los campos de la última actualización guardada. No se
eliminaron registros ni se modificó la función de guardado, RLS o los permisos.

La verificación posterior confirmó:

- **212 de 212 domicilios** coinciden exactamente en sus 16 campos con la versión
  elegida, incluidos Casa y Torre.
- Siguen existiendo **416 personas con un único domicilio vigente** cada una.
- El historial pasó de **1110 a 1322 versiones**, sin borrar ninguna anterior.
- Los registros fuera del plan permanecieron idénticos al respaldo. De los
  registros anteriores modificados, sólo cambiaron la fecha de cierre y los
  metadatos de esa operación; sus campos de domicilio se conservaron.
- El primer caso coincide con la dirección, piso y departamento confirmados.
  El segundo caso sigue idéntico a su versión vigente anterior a la restauración.
- Los domicilios vigentes sin provincia pasaron de **294 a 100**. Siguen existiendo
  **100 sin localidad**. No se completaron mediante una ubicación supuesta.

## Protecciones aplicadas a la app

- La lectura del domicilio vigente está centralizada y sus errores se muestran
  en consulta y edición. Un fallo de lectura no se presenta como ausencia de datos.
- Si la lectura falla, la sección queda bloqueada y guardar las otras secciones
  no envía un domicilio vacío.
- El domicilio sólo se envía al guardar si se editó su sección. Una dirección
  que no cambió tampoco genera una nueva versión.
- Antes de modificarlo, el servidor relee el vigente y compara sus campos con
  la versión que se mostró al abrir la edición. Rechaza una versión desactualizada,
  la falta de comprobación o el vaciado completo de una dirección existente.
- Después de un cambio, se relee el domicilio. La app no confirma la actualización
  si el dato leído no coincide con lo enviado. Si la ficha ya se guardó pero falla
  esa comprobación, el mensaje lo distingue y conserva el formulario.
- Se corrigió la función de guardado para incluir Casa en la comparación y en
  cada nueva versión del domicilio. Si un cliente anterior no envía Casa o Torre,
  se conservan sus valores vigentes. La consulta y edición incluyen ambos campos
  y la comparación de versión los protege de formularios desactualizados.
- Si llegan datos actualizados al formulario y Domicilio no tiene un borrador,
  sus controles se actualizan, incluidos provincia y localidad. Si hay un borrador,
  se conserva su contenido y su versión de origen; no se sobrescribe silenciosamente.

La comparación final de versión se realiza dentro de la transacción de guardado,
con bloqueo de la persona y sus relaciones. La verificación posterior complementa
esa protección. El [control de concurrencia](CONCURRENCIA.md) documenta sus pruebas
y límites frente a clientes anteriores e importaciones administrativas.

## Pruebas y evidencias locales

Las pruebas sintéticas verifican la conservación al guardar otra pestaña,
la dirección precargada, un fallo de Georef, errores de lectura, versiones
desactualizadas, vaciado accidental, conservación de Casa y lectura posterior.
También verifican la recepción de una dirección actualizada mientras el formulario
está abierto, tanto sin borrador como con cambios sin guardar.

Los resultados de los dos casos, consultas e informes con datos personales se
conservan exclusivamente en `.runtime/domicilios/`, excluido de Git. No se copian
direcciones, nombres ni DNI reales a pruebas o documentación pública.

El respaldo previo, el plan autorizado, el SQL aplicado y la verificación
posterior están en `.runtime/domicilios/`, excluido de Git. Ninguno forma parte
del arranque automático.

## Corrección del guardado de Casa y Torre

Al continuar con el formulario se probó y aplicó la migración
`20261028110057_preservar_casa_domicilio.sql`. Su guard verifica la definición
anterior antes de reemplazarla y rechaza cambios ajenos o reaplicaciones.
Conserva firma, propietario, permisos, `SECURITY INVOKER` y `search_path`.

Una prueba en PostgreSQL local, con datos sintéticos, verificó alta, actualización,
historial, clientes que no envían Casa/Torre, limpieza explícita de esos campos,
guardado de otras secciones y controles de autenticación y permiso. La aplicación
real se realizó dentro de una transacción que verificó que no cambió ningún dato
de personas ni domicilios, y una consulta posterior confirmó la definición aplicada.
El respaldo y la reversión protegida de la función quedan en `.runtime/domicilios/`.
Los 100 domicilios incompletos permanecen pendientes por decisión del propietario.

## Trabajo pendiente

1. Revisar los domicilios aún incompletos frente a fuentes confirmadas. No
   reemplazarlos por registros históricos menos estructurados ni inventar datos.
2. Identificar el origen operativo de la carga del 16/10 para evitar que vuelva
   a desplazar actualizaciones guardadas.
3. Probar edición y permisos con usuarios de prueba; las consultas administrativas
   de esta revisión no validan todas las políticas efectivas de cada usuario.
