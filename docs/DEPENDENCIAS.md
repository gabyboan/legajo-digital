# Revisión de dependencias

Actualización local del 27 de octubre de 2026 en la copia con historial limpio.

## Cambios

| Paquete | Antes | Después |
| --- | --- | --- |
| Next.js y eslint-config-next | 16.2.2 | 16.4.3 |
| React y React DOM | 19.2.4 | 19.3.1 |
| SheetJS (`xlsx`) | 0.18.5 | 0.20.3, distribución oficial |
| Tailwind CSS y su plugin PostCSS | 4.3.1 | 4.3.3 |
| Tipos de React y React DOM | 19.2.x | 19.3.0 |

También se actualizaron las versiones resueltas de dependencias indirectas con
avisos: Browserslist, baseline-browser-mapping, source-map-js, brace-expansion,
js-yaml, PostCSS, nanoid y Zod. Se mantienen en el lockfile los cambios necesarios,
sin añadir excepciones a la auditoría ni forzar versiones mediante overrides.

La versión 16.4.3 incluye las correcciones de seguridad publicadas para Next.js
16.4.1 y los parches posteriores. Referencias:
[aviso de seguridad](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
y [versión 16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3).

La versión `xlsx` del registro npm estaba desactualizada. Se usa la URL fijada
del tarball 0.20.3 del CDN oficial, conforme a las
[instrucciones de SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
El lockfile conserva su integridad. Instalar desde cero requiere que esa fuente
esté disponible; no se reemplazó la exportación por otro formato.

## Auditoría

La auditoría inicial de producción informó 49 avisos: 5 críticos, 26 altos,
15 moderados y 3 bajos. Después de la actualización, tanto `pnpm audit --prod`
como la auditoría completa informan **cero avisos conocidos**. Es una fotografía
del registro de avisos de esa fecha y no una garantía de ausencia de vulnerabilidades.

`pnpm run audit:deps` revisa producción y desarrollo y falla ante avisos de nivel
bajo o superior. Se añadió al workflow de GitHub Actions para futuras ejecuciones.

## Comportamiento comprobado

La nueva prueba de exportación usa el escritor y lector XLSX reales con datos
ficticios y un cliente de datos simulado. Comprueba autenticación, errores de
consulta, columnas, acentos, relaciones de carrera, estados, búsqueda por nombre
y DNI, filtros, valores de texto que empiezan con `=` y listados vacíos.

La prueba encontró un error previo: la exportación filtraba por DNI en la consulta
y después buscaba ese mismo número dentro del nombre, dejando el archivo vacío.
Ahora la búsqueda por DNI conserva el resultado de la consulta; la búsqueda por
nombre mantiene su ordenamiento y sus coincidencias.

No se modificaron esquemas ni datos de Supabase. La validación con configuración
de ejemplo no sustituye pruebas de permisos/RLS ni de edición en una base real.
ESLint permanece en la rama 9; su migración a la rama 10 se evalúa por separado.

También se inició la compilación en un servidor temporal con configuración de
ejemplo: portada y login respondieron 200, las rutas privadas redirigieron al
login y la exportación sin sesión respondió 401. En Chromium se comprobó la
navegación al login y el control de mostrar/ocultar contraseña, sin errores de
JavaScript ni de hidratación. No se enviaron formularios ni se usaron datos reales.

La compilación deja de mostrar la advertencia de empaquetado anterior. Las cuatro
trazas de validación incluyen sus cinco archivos Python; ninguna de las 35 trazas
de la compilación revisadas incluye archivos `.env`, historial Git, respaldos,
importaciones o exportaciones locales. Esta comprobación no ejecuta los scrapers
contra fuentes externas.

## Comandos

```sh
pnpm install --frozen-lockfile
pnpm run audit:deps
pnpm audit --prod
pnpm run check
python -B scripts/test-privacy.py
pnpm run build
```

La compilación se validó con URL y clave de ejemplo de Supabase. La copia actualizada
se activó después en el servidor local de PC-04 para probar el acceso MFA.
Las mejoras forman parte de la entrega en la rama `preparacion-publicacion`;
ver [estado del acceso](MFA.md).
