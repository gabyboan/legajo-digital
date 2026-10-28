# Ediciones simultáneas de la ficha

La edición completa utiliza una versión de origen obtenida de PostgreSQL al abrir
la ficha. Incluye datos personales y de contacto, carrera, situación y domicilio
vigente, con Casa y Torre. No es una credencial ni reemplaza permisos o MFA.

## Lectura y guardado

`rpc_persona_ficha_edicion` obtiene esos datos en una sola consulta coherente y
devuelve un identificador de comparación calculado por la base. El formulario
mantiene esa versión durante toda la vida del borrador, incluidos errores de
validación o actualizaciones de las propiedades del componente.

La acción conserva sus validaciones y comprobaciones de contacto y domicilio,
pero delega la decisión final a `rpc_persona_editar_versionada`. Dentro de la
transacción, esta función:

1. Comprueba identidad y permiso de edición.
2. Bloquea la fila de la persona y sus relaciones vigentes.
3. Vuelve a obtener los datos y compara su versión con la del formulario.
4. Si coinciden, llama a la persistencia existente, que guarda toda la ficha y
   mantiene el historial del domicilio.

Un segundo editor espera a que termine la primera transacción. Si la ficha cambió,
recibe `P4090` y no se ejecuta el guardado. La app informa el conflicto, conserva
lo escrito y pide revisar la versión actual. No reintenta automáticamente con
una versión nueva ni mezcla datos sin revisión.

Si no se puede leer una ficha completa para editar, no se abre un formulario con
valores incompletos. Cambiar de persona reinicia el borrador. Los bloqueos tienen
un límite de espera de cinco segundos y los errores de bloqueo no se presentan
como un guardado exitoso.

## Permisos y alcance

Las funciones nuevas son `SECURITY INVOKER`, usan `search_path` vacío y sólo
conceden ejecución a `authenticated`; `anon` y `PUBLIC` no pueden ejecutarlas.
Las políticas RLS y los permisos de las funciones existentes siguen vigentes.
El helper de snapshot permanece en el esquema `private`.

La protección se aplica al formulario de **Editar persona**. Alta, familiares,
asistencia y banco inicial conservan sus flujos propios. Clientes antiguos que
sigan llamando directamente a la RPC anterior no aportan una versión y no reciben
esta protección. Tampoco se impide que una importación administrativa posterior
modifique datos: la siguiente edición del formulario detectará esa diferencia.
Los cambios fuera de los campos y relaciones incluidos no forman parte del token.

## Verificación

```bash
node scripts/test-persona-formulario.cjs
python -B scripts/test-domicilio-rpc.py
python -B scripts/test-persona-form-ui.py
```

La prueba de PostgreSQL inicia un servidor temporal con fixtures sintéticos.
Usa dos conexiones: la primera guarda y mantiene la transacción abierta; la
segunda intenta guardar con la versión anterior, espera y recibe el conflicto.
Comprueba que quede el primer valor, que el rechazo no modifique datos, que una
recarga permita guardar y que un cambio directo del domicilio invalide la ficha.
También comprueba ocultamiento por una política RLS sintética y falta de acceso anónimo.

En el proyecto real se aplicaron únicamente las funciones y sus permisos. Se
verificó dentro de la transacción que no se alteraran personas, domicilios ni
relaciones. Se probó una lectura con rol autenticado y el rechazo de una versión
desactualizada, sin escribir datos personales. Las políticas sintéticas no cubren
todas las combinaciones de roles del proyecto ni sustituyen un ensayo completo
con dos usuarios de prueba.
