# Ficha de persona: formulario y servidor

La edición completa del legajo usa seis grupos: identificación, contacto, datos
laborales, formación, domicilio y observaciones. La ficha de consulta sigue la
misma separación. Asistencia y banco de horas conservan sus formularios propios.

## Carga por pestañas

La edición muestra una sola sección por vez con seis pestañas numeradas arriba.
Se puede elegir cualquier pestaña o avanzar con **Anterior** y **Siguiente**.
Cambiar de pestaña conserva lo escrito y no guarda automáticamente. El botón
**Guardar cambios** envía los datos de todas las secciones juntas.

Se mantienen los requisitos de la ficha: DNI válido, apellido, nombre, carrera y
situación de revista. No hace falta completar los campos opcionales para pasar
de sección. Antes de guardar, se revisan también los controles obligatorios de
las pestañas ocultas; si alguno falta o es inválido, se abre su sección y recibe
el foco. El servidor conserva su validación independiente de todos los campos.

Si el servidor devuelve errores, se abre la primera pestaña afectada, se indica
la cantidad de campos por revisar en cada pestaña y los enlaces del resumen
abren la sección y enfocan el campo. La navegación sigue disponible para corregir
en cualquier orden. Mientras guarda, se bloquean pestañas y controles.

Los paneles permanecen montados al ocultarse para conservar los valores y
selectores. La ficha se reinicia al cambiar de persona, evitando reutilizar el
borrador de otro DNI. En celular, la barra se desliza horizontalmente dentro del
formulario. Las flechas izquierda/derecha y las teclas Home/End permiten navegar
por las pestañas con el teclado.

## Teléfono único y revisión de registros anteriores

El formulario ofrece un solo campo **Teléfono / celular**. Es texto para conservar
el signo `+`, ceros iniciales, código de área, espacios y extensiones.

Las columnas existentes `personas.telefono` y `personas.numero_contacto` se leen
por compatibilidad. No se eliminaron columnas ni se ejecutó una migración masiva.

| Datos anteriores | Comportamiento al guardar la ficha |
| --- | --- |
| Sólo teléfono | Guarda el teléfono como texto. |
| Sólo número de contacto | Lo muestra en el campo único y lo guarda en `telefono`. |
| Ambos con los mismos dígitos | Muestra un teléfono y lo guarda en `telefono`. |
| Dos números con dígitos distintos | Muestra «Contacto pendiente de revisión» y conserva ambos. |

Los espacios y signos se ignoran sólo al comparar números. No se deduce que dos
números sean iguales por sus prefijos nacionales o internacionales.

En los casos pendientes se puede guardar el resto del legajo sin modificar los
dos valores anteriores. Para resolverlos, quien edita debe marcar la confirmación
de revisión y escribir el teléfono que debe quedar. Sólo entonces se guarda ese
texto en `telefono` y se envía `numero_contacto = null` a la RPC existente.
La consolidación sucede al guardar cada ficha, no al abrirla.

El servidor vuelve a leer ambos valores antes de guardar. Si cambiaron desde
que se abrió el formulario, devuelve un aviso y requiere recargar. La decisión
final se toma en `rpc_persona_editar_versionada`, que bloquea y compara la ficha
completa dentro de la misma transacción que la escritura. Una segunda edición
desactualizada se rechaza sin sobrescribir los cambios confirmados.
El [control de concurrencia](CONCURRENCIA.md) documenta su alcance y pruebas.

## Organización del código

- `lib/personas/types.ts`: contrato de campos y grupos del legajo.
- `lib/personas/contacto.ts`: interpretación del contacto anterior y comparación.
- `lib/personas/formulario.ts`: lectura y validación de `FormData` en el servidor.
- `lib/personas/persistencia.ts`: lectura del contacto actual, reglas de revisión
  y conversión de los grupos a los argumentos de `rpc_persona_guardar_con_escolaridad`.
- `lib/personas/consultas.ts`: consulta de la ficha y lectura consistente de su versión para editar.
- `app/(private)/personas/actions.ts`: autorización, coordinación del guardado,
  revalidación y navegación.
- `app/(private)/personas/components/persona-form.tsx`: grupos, estado de carga,
  resumen de errores y revisión del teléfono.

La validación comprueba fechas reales, enteros positivos seguros, formato de DNI
y CUIL, email, teléfono y longitud de matrícula. Rechaza archivos y campos
duplicados donde espera un valor de texto. La matrícula demasiado larga produce
un error; no se recorta silenciosamente. El CUIL se valida por formato en este
formulario; la comprobación de identidad sigue en el módulo específico.

La acción verifica permiso de edición antes de consultar o guardar. La respuesta
de error conserva los datos cargados, mueve el foco al resumen y relaciona los
mensajes con los campos. Durante el envío se bloquean los controles para evitar
cambios o envíos repetidos. La edición traduce errores de permisos, duplicados y
referencias a mensajes simples, sin mostrar el mensaje interno de PostgreSQL.

## Protección del domicilio guardado

Guardar otra pestaña no vuelve a enviar el domicilio. Un domicilio editado requiere
una lectura correcta y una versión de origen; el servidor comprueba el vigente
antes de escribir y vuelve a leer después. No se permite vaciar accidentalmente
una dirección existente ni ocultar un error de consulta como campos vacíos.
Si llegan datos nuevos mientras el usuario edita, se conserva su borrador y se
evita mover silenciosamente su versión de origen.

La edición y la ficha muestran también **Casa** y **Torre**, como texto para
conservar letras y ceros iniciales. Ambos forman parte de la validación de versión
y de la comprobación posterior al guardado. Se corrigió la RPC que omitía Casa:
ahora la guarda, la compara y la conserva si un cliente anterior no envía ese campo.
Se retiró el bloqueo temporal que impedía editar domicilios con Casa.

La [revisión de domicilios](REVISION_DOMICILIOS.md) documenta el reemplazo masivo
detectado en el historial, la corrección del dato de Casa y la decisión
del propietario de recuperar las actualizaciones guardadas. Se restauraron y
verificaron 212 domicilios, conservando los demás y todo el historial.

## Comprobaciones y límites

```bash
pnpm run check
python -B scripts/test-persona-form-ui.py
python -B scripts/test-domicilio-rpc.py
pnpm run build
```

Las pruebas Node incluyen agrupamiento y validación, autorización antes de guardar,
teléfono único, duplicados, conservación de dos números distintos, revisión explícita,
formulario desactualizado y errores de persistencia. Utilizan dobles de Supabase.

La prueba del navegador usa un preview aislado en `127.0.0.1:3111`, el formulario
real y datos sintéticos. Comprueba pestañas, teclado, una sola sección visible,
carga pendiente, obligatorios en secciones ocultas, validación del servidor y foco,
conservación de datos y selectores tras errores, revisión del teléfono y anchos de
320, 390, 768 y 1280 píxeles. Requiere Python y Playwright con Chromium instalado.
El preview no conecta a Supabase y se elimina al terminar; las capturas quedan en
`.runtime/persona-form/`, excluido de Git.

La prueba de la RPC requiere los binarios locales de PostgreSQL (`--pg-bin` si no
se detectan). Crea y detiene un servidor temporal, enlazado sólo a localhost,
sin conectarse al proyecto. Ejecuta la migración real y comprueba Casa/Torre,
compatibilidad con clientes anteriores, historial, guardados sin cambios y
conservación de firma y permisos. El esquema sintético no reproduce las políticas
RLS del proyecto. También se ejecuta en CI.

Todavía debe comprobarse el flujo completo con dos usuarios de lectura y edición
en una base de prueba del proyecto y todas sus combinaciones de RLS. Las pruebas
locales de PostgreSQL ya verifican el contrato de la RPC, el historial, permisos
sintéticos y guardado simultáneo. No se escribieron datos de personas en la base
real durante estas pruebas. La corrección
de la función de Casa se aplicó y se verificó por separado: conservó los datos,
permisos, firma y modo de ejecución existentes. La copia actualizada se activó
en el servidor local de PC-04. En la base real se verificaron la lectura autenticada
y el rechazo de una versión desactualizada, sin ejecutar un guardado de datos reales.

La mejora de errores y estados se aplica a la edición completa de persona. Los
formularios de identidad inicial, familiares, asistencia y banco de horas todavía
requieren su revisión específica.
