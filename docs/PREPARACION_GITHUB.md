# Preparación de Legajo Digital para GitHub

Primera revisión: 27 de octubre de 2026. El proyecto está en desarrollo y esta
lista separa la publicación del código de la puesta en producción del sistema.

## Antes de hacer público el repositorio

- [ ] Resolver los datos personales que ya están en el historial. Se encontraron
  tres archivos versionados en `supabase/imports/`, incluido un CSV de 262 filas
  con DNI, nombres y horas. Sus copias locales se conservan y su eliminación de
  Git está preparada, pero eso no elimina los commits anteriores. Antes de
  publicar, aplicar la limpieza ya preparada en una copia aislada del historial.
  La rama afectada es `agent/ficha-persona-ampliada` y su PR #1; `main` queda
  intacta. El remoto público todavía conserva los datos hasta autorizar ese paso.
- [x] Revisar el historial disponible por secretos e identidades de las
  importaciones conocidas. No se detectaron formatos de credenciales privadas
  contemplados por las reglas. Alcance, límites y pasos restantes en
  [la revisión de privacidad](PRIVACIDAD.md).
- [ ] Actualizar las dependencias con avisos de seguridad y validar los flujos
  afectados. `pnpm audit --prod` informó 49 avisos en esta revisión: 5 críticos,
  26 altos, 15 moderados y 3 bajos. Entre los paquetes señalados están Next.js
  16.2.2, sus dependencias transitivas y `xlsx` 0.18.5. No se actualizaron paquetes
  en esta primera preparación. Repetir la auditoría al abordar este punto, ya
  que la cantidad y las versiones corregidas pueden cambiar.
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
  reconstruir el sistema. La documentación actual remite a `gabyboan/hesm-supabase`.
- [ ] Crear datos de demostración sintéticos y una cuenta de prueba aislada.
- [ ] Probar la instalación en un entorno limpio con una base de demostración.
- [ ] Separar con claridad los pasos esenciales de los validadores Python opcionales.
- [ ] Revisar el empaquetado de los validadores: la compilación actual termina,
  pero Turbopack advierte que una referencia dinámica desde `lib/cuitonline.ts`
  puede incluir archivos de todo el proyecto. Comprobar el contenido del artefacto
  antes de desplegarlo.

## Siguiente etapa: experiencia de uso

- [ ] Adaptar la navegación lateral a teléfonos y pantallas pequeñas.
- [ ] Unificar mensajes de error, estados de carga y confirmaciones de formularios.
- [ ] Revisar etiquetas, foco de teclado, contraste y navegación accesible.
- [ ] Ajustar la portada para distinguir funciones operativas de módulos planeados.
- [ ] Priorizar situación, carreras, cargos, funciones, servicios, historial y
  documentos; sus rutas propias todavía usan `ModulePlaceholder`.
- [ ] Preparar páginas de error y de recurso no encontrado con opciones de recuperación.

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
