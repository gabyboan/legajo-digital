# Sesiones en la red local

La aplicación comprueba tanto Supabase Auth como la autorización de la Data API.
La base fija una hora desde el inicio de
sesión para cuentas sin MFA; las cuentas con autenticadora requieren una
verificación reciente dentro de la misma ventana de una hora.

Renovar un JWT vencido no equivale a iniciar una nueva sesión ni reinicia ese
plazo. El proxy conserva las cookies renovadas. Antes de guardar una ficha o
una licencia se comprueba el acceso a datos mediante `verificar_mfa_opcional`.
Un `PT401` de la base se trata como sesión vencida, aunque `getUser()` todavía
devuelva una cuenta válida. Los permisos denegados y las fallas de red conservan
su significado y no se convierten en vencimientos.

Mientras hay una página privada abierta, se comprueba la sesión cada 30 segundos
y al volver a la ventana o recuperar la conexión. Cuando vence, se pasa por
`/auth/expired`, se cierra solamente la sesión de ese navegador y se vuelve al
login con un aviso y la dirección de retorno. No se cierran las sesiones de
otras computadoras. Las consultas de estado no devuelven tokens ni datos del
personal y llevan `Cache-Control: private, no-store`.

Las solicitudes al backend tienen un límite de espera de 20 segundos por
solicitud. No se reintentan escrituras automáticamente: ante una respuesta
perdida hay que comprobar el resultado antes de volver a guardar.

Validación automatizada: `node scripts/test-session.cjs`, las regresiones de
fichas, licencias y MFA, y `python scripts/test-session-ui.py`. Las pruebas usan
cuentas, respuestas y cookies sintéticas y no modifican la base compartida.
