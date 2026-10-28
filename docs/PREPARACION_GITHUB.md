# Preparación de Legajo Digital para GitHub

Primera revisión: 27 de octubre de 2026. El proyecto está en desarrollo y esta
lista separa la publicación del código de la puesta en producción del sistema.

## Privacidad y publicación del repositorio

- [x] Retirar las tres importaciones de personal del historial de las ramas de
  GitHub. Se aplicó el reemplazo autorizado de `agent/ficha-persona-ampliada` y se
  verificó con una nueva descarga del remoto; la referencia actual del PR #1
  también está limpia. `main` conserva su commit. Las copias locales de respaldo
  contienen el historial anterior y deben permanecer fuera del repositorio público.
- [x] Enviar a GitHub Support la solicitud de evaluación de versiones antiguas
  y vistas almacenadas: ticket #4914125.
- [ ] Recibir la resolución del ticket #4914125 y verificar el retiro de las
  versiones antiguas que determine GitHub Support.
- [x] Revisar el historial disponible por secretos e identidades de las
  importaciones conocidas. No se detectaron formatos de credenciales privadas
  contemplados por las reglas. Alcance, límites y pasos restantes en
  [la revisión de privacidad](PRIVACIDAD.md).
- [x] Actualizar las dependencias con avisos de seguridad. La auditoría inicial
  de producción informó 49 avisos (5 críticos); la revisión del 27/10/2026,
  después de las actualizaciones, informa cero en producción y desarrollo.
  La validación local incluye tipos, pruebas y compilación con configuración de
  ejemplo. Los flujos con una base real siguen pendientes en su sección propia.
  Ver [versiones, pruebas y límites](DEPENDENCIAS.md).
- [ ] Confirmar qué código y recursos se pueden publicar y definir su licencia.
- [ ] Preparar capturas y ejemplos con personas completamente ficticias.

La revisión automática de archivos actuales no revisa el historial ni determina
si un nombre o DNI pertenece a una persona real. Un resultado correcto del
control automático no implica que el repositorio esté listo para ser público.

## Base de trabajo preparada

- [x] Conservar los cambios locales que ya estaban en curso.
- [x] Excluir importaciones, exportaciones, cachés de Python, temporales y `.env.local`.
- [x] Ofrecer una plantilla de entorno con URL local y sin credenciales reales.
- [x] Unificar las instrucciones con pnpm y fijar su versión.
- [x] Incorporar `pnpm run check` para repositorio, lint, tipos y pruebas existentes.
- [x] Preparar GitHub Actions con valores de ejemplo y permisos de lectura.
- [x] Documentar los módulos que siguen pendientes.

## Siguiente etapa: instalación reproducible

- [ ] Documentar el esquema mínimo, roles y RPC necesarios desde una base vacía.
  Las migraciones de este repositorio son complementarias y no bastan para
  reconstruir el sistema. El esquema completo se mantiene por separado.
- [ ] Crear datos de demostración sintéticos y una cuenta de prueba aislada.
- [ ] Probar la instalación en un entorno limpio con una base de demostración.
- [x] Separar en el README la instalación principal de los validadores Python opcionales.
- [x] Revisar el empaquetado de los validadores tras actualizar Next.js. La
  compilación termina sin la advertencia anterior; las cuatro trazas de los
  validadores incluyen sus cinco archivos Python. Las 35 trazas revisadas no
  incluyen `.env`, historial Git, respaldos, importaciones ni exportaciones locales.

## Siguiente etapa: experiencia de uso

- [x] Adaptar la navegación lateral a teléfonos y pantallas pequeñas. Menú
  desplegable, sección activa, foco y salto al contenido verificados en un preview
  aislado con contenido ficticio; [detalle de navegación](NAVEGACION.md).
- [ ] Unificar mensajes de error, estados de carga y confirmaciones de formularios.
  La edición completa de persona ya conserva los datos tras errores, muestra
  mensajes por campo y bloquea el envío mientras guarda. Los demás formularios
  siguen pendientes; [alcance y pruebas](FORMULARIOS.md).
- [x] Agrupar los campos de la ficha y centralizar su validación y persistencia
  en el servidor. Teléfono único en el formulario; los registros con dos números
  distintos quedan pendientes de revisión explícita. Verificado con datos sintéticos.
- [x] Dividir la edición de la ficha en seis pestañas numeradas con navegación
  libre, conservación de datos y validación de los obligatorios aunque estén
  en otra pestaña. Comprobado con navegador y datos sintéticos.
- [x] Incorporar una comprobación transaccional de la ficha completa, incluidos
  contacto y domicilio. Verificada con dos conexiones PostgreSQL y una lectura
  autenticada/rechazo sin escritura en el proyecto real; [alcance](CONCURRENCIA.md).
- [ ] Completar el ensayo funcional con dos usuarios del proyecto y todas las
  combinaciones de permisos efectivos, incluido teléfono único.
- [x] Revisar los domicilios informados como desactualizados y proteger la lectura
  y el envío del formulario. Se confirmó una carga masiva previa; [informe](REVISION_DOMICILIOS.md).
- [x] Recuperar, con autorización del propietario y respaldo, las últimas
  actualizaciones de domicilio desplazadas por esa carga. Se restauraron 212,
  se conservaron 204 vigentes y se verificó que no se borrara historial.
- [x] Corregir la conservación de Casa en la RPC e incluir Casa/Torre en consulta,
  edición y comprobación de versión. Migración probada en PostgreSQL temporal;
  aplicación verificada sin modificar fichas ni permisos.
- [ ] Revisar los 100 domicilios aún incompletos, sin completar ubicaciones por
  suposición. Postergado por decisión del propietario.
- [ ] Revisar etiquetas, foco de teclado, contraste y navegación accesible.
- [ ] Ajustar la portada para distinguir funciones operativas de módulos planeados.
- [ ] Priorizar situación, carreras, cargos, funciones, servicios, historial y
  documentos; sus rutas propias todavía usan `ModulePlaceholder`.
- [ ] Preparar páginas de error y de recurso no encontrado con opciones de recuperación.
- [x] Incorporar la pantalla de código MFA y el regreso a la página solicitada
  para cuentas con autenticador configurado. Pruebas con sesiones sintéticas y
  el SDK SSR; [detalle y límites](MFA.md).
- [ ] Probar MFA con una cuenta del proyecto y confirmar las políticas efectivas
  de la base. La versión corregida ya está activa en el servidor local de PC-04;
  falta la confirmación desde la sesión del usuario.

## Antes de usarlo en producción

- [ ] Verificar permisos y RLS con usuarios de lectura y edición en una base de prueba.
  La revisión local del código no valida las políticas efectivas de Supabase.
- [ ] Probar los flujos completos de alta, edición, familiares, asistencia,
  banco de horas, agenda y exportaciones con datos sintéticos.
- [ ] Elegir y probar un servidor compatible con Node.js, Python y los
  navegadores de Playwright si se habilitan los validadores.
- [ ] Definir copias de seguridad, restauración y seguimiento de errores.
- [ ] Usar una compilación de producción y HTTPS. El inicio automático de
  Windows documentado en el README ejecuta el servidor de desarrollo.

## Comandos de revisión

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm audit --prod
```

Las pruebas Node usan datos sintéticos y procesos/base simulados. No
necesitan consultar fuentes externas, iniciar Python ni escribir en Supabase.
La prueba de interfaz Python queda separada porque requiere Playwright y un
servidor de desarrollo. El workflow se ha preparado localmente; su ejecución en
GitHub se comprobará cuando se suban los cambios.
