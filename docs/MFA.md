# Verificación con aplicación autenticadora

## Problema observado

La pantalla de Personas mostraba «Verificá el código de tu autenticadora para
continuar», sin ofrecer dónde ingresarlo. La app comprobaba email y contraseña,
pero no tenía un paso para completar la verificación MFA.

El mensaje es compatible con un requisito de MFA en la base. No se inspeccionó
la sesión afectada ni la política efectiva de la base real, por lo que esa causa
todavía debe confirmarse en el entorno del proyecto.

## Flujo de la aplicación

Después del ingreso se comprueba el nivel de autenticación. Una sesión que
necesita completar MFA va a `/auth/mfa`. Las visitas a Dashboard, Personas y
Agenda también se comprueban antes de iniciar las consultas de la página.
La redirección conserva las cookies renovadas y la página solicitada con sus filtros.

La pantalla pide el código de seis dígitos de una aplicación TOTP ya verificada.
Si la cuenta tiene varias, permite elegir. El servidor vuelve a comprobar la
sesión y que el factor seleccionado pertenece al usuario y está verificado antes
de crear el desafío y verificarlo con `challengeAndVerify`.

Cuando Supabase acepta el código, su cliente SSR guarda la sesión actualizada en
las cookies. Se confirma el nivel `aal2` antes de regresar a la página solicitada.
Los destinos se limitan a rutas privadas conocidas para impedir redirecciones
externas y bucles hacia login o MFA.

Los errores no devuelven el código ni detalles internos de Auth. El campo se
vacía y recupera el foco para ingresar el código actual; se conserva la elección
de autenticador. Durante el envío se bloquean los controles. Se distinguen código
incorrecto o vencido, límite de intentos, factor eliminado y problemas de conexión.

Si falla la consulta de la sesión, se ofrece reintentar o cerrar sesión. Si no
hay una aplicación TOTP verificada, se muestra una explicación para revisar la
configuración con el administrador. Este flujo no registra ni elimina factores y
no incluye recuperación de cuenta, MFA por teléfono ni WebAuthn.

El aviso de Personas también ofrece **Verificar mi código** cuando la respuesta
de la consulta indica MFA. Los demás fallos muestran un mensaje simple y un
botón para reintentar, sin exponer el mensaje interno de PostgreSQL.

## Límites de seguridad y despliegue

La comprobación de navegación mejora el flujo de las páginas; no reemplaza la
autorización de Server Actions, las APIs ni las políticas de la base. Estas rutas
conservan sus controles existentes. No se modificó RLS ni se relajó el requisito
de MFA. Un usuario sin factores continúa con el comportamiento previo de la app;
si la base exige MFA también para ese usuario, hace falta preparar su enrolamiento.

La MFA del usuario de Legajo Digital es distinta de la MFA de la cuenta con la que
se administra el panel de Supabase. El código debe corresponder a la cuenta de la
aplicación. No se requiere compartir el código con nadie ni guardarlo en archivos.

El 27 de octubre de 2026 se activó la copia `legajo-digital-publicable` en PC-04,
en el puerto 3000, y se actualizó el inicio automático de Windows para usarla.
Se mantiene el modo de desarrollo que ya utilizaba ese equipo. La carpeta
original queda como respaldo, con su inicio automático desactivado.

Se comprobó la conexión a Supabase Auth (respuesta 200) con la configuración local
del proyecto. Por `localhost` y `pc-04` se verificaron login (200), redirección de
Personas y MFA sin sesión (307 al login), y exportación sin sesión (401).
Falta confirmar la verificación MFA desde la sesión del usuario en el navegador.
No se solicitaron ni guardaron su contraseña o código de autenticación.

La configuración `.env.local`, la copia del acceso directo anterior y el script
local para restaurar el arranque previo permanecen excluidos de Git. No se publicó
el código en GitHub ni se modificaron esquemas o políticas de la base.

## Comprobaciones

```bash
pnpm run check
python -B scripts/test-mfa-ui.py
pnpm run build
```

Las pruebas Node verifican sesión ausente, MFA pendiente y completada, factores
propios, rechazo de factores ajenos o no verificados, código con cero inicial,
errores y límites de intentos, destino seguro y conservación de cookies en la
redirección del proxy. Además ejercitan el SDK real de Supabase SSR/Auth contra
una API de Auth simulada: el código aceptado escribe cookies y un cliente nuevo
recupera el nivel `aal2` desde ellas.

La prueba de navegador usa la página y acción reales con un cliente Auth
sintético en un preview aislado en `127.0.0.1:3113`. Comprueba elección del
autenticador, error y foco, estado de envío, reintento, regreso con filtros,
persistencia de la sesión y cierre de sesión. Revisa anchos de 320 a 1280 píxeles.
Requiere Python y Playwright con Chromium. Las capturas se guardan en
`.runtime/mfa/`, excluido de Git. Ninguna prueba usa usuarios ni servicios reales.

## Referencias

- [MFA con aplicaciones TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp).
- [Niveles de autenticación](https://supabase.com/docs/reference/javascript/auth-mfa-getauthenticatorassurancelevel).
- [Desafío y verificación](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify).
- [Cliente Supabase SSR para Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).
