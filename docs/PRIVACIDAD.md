# Revisión de privacidad para publicación

Revisión del 27 de octubre de 2026.

## Alcance y resultado

Se revisaron las ramas y la referencia del PR #1 disponibles en GitHub, además
de las referencias locales, sus archivos históricos, mensajes de commit y los
archivos actuales que Git incluiría.

El repositorio de GitHub ya era público. Se identificaron tres importaciones de
personal en el historial de `agent/ficha-persona-ampliada`, incluido un CSV de
262 registros con 250 DNI no vacíos. `main` no contiene esas importaciones.
La referencia del PR #1 también apuntaba a la historia afectada.

La copia del historial preparada localmente conserva los 14 commits del remoto
y elimina los tres archivos de datos de todas sus versiones. Cambian tres
commits de la rama afectada. El commit de `main` se mantiene idéntico.
La nueva revisión de esa copia no detectó las identidades conocidas ni los
formatos de credenciales privadas contemplados por las reglas.

En los archivos actuales también se retiró un DNI real que aparecía en ejemplos
de dos scrapers. Las rutas de archivos de personal y los hosts de desarrollo
dejaron de estar fijados al entorno de una computadora.

Los controles no detectaron credenciales privadas conocidas. No se comprobaron
credenciales contra servicios externos. La búsqueda de identidades se compara
con las importaciones encontradas y no permite afirmar que se hayan detectado
todos los datos personales posibles.

## Estado de la limpieza

El reemplazo de `agent/ficha-persona-ampliada` se aplicó en GitHub el 27 de octubre
de 2026, con autorización del propietario y comprobación de la versión anterior.
Una nueva copia descargada del remoto conserva los 14 commits y pasa la revisión
de los 164 blobs sin detectar las identidades conocidas ni los formatos de
credenciales privadas contemplados. `main` conserva su commit y la referencia
actual del PR #1 ya apunta a la historia limpia. Las copias de seguridad contienen
el historial original y deben permanecer locales, fuera del repositorio público.

Se envió a GitHub Support el ticket #4914125 para evaluar la eliminación de las
versiones anteriores y vistas almacenadas con datos personales; falta su resolución.
La URL de un commit anterior todavía respondió HTTP 200 tras el reemplazo;
no se debe dar por completada la eliminación de las versiones antiguas.
Un cambio de rama por sí solo no elimina copias previas, forks o cachés.
Ver la [guía oficial para retirar datos sensibles](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

Las personas que tengan clones anteriores deben volver a clonar desde el
historial limpio para evitar reintroducirlo. No mezclar la historia de un clon
antiguo mediante un merge o un push posterior.

La carpeta original se conserva como respaldo con una protección local que
bloquea sus pushes. La copia de desarrollo limpia está en
`C:/legajo/legajo-digital-publicable`; sus cambios de preparación siguen locales.
El inicio automático de PC-04 utiliza esta copia limpia desde el 27/10/2026.
La configuración real se conserva en `.env.local`, excluido de Git; la carpeta
original ya no inicia el servidor automáticamente.

## Cómo repetir la revisión

El auditor usa Python estándar. No consulta fuentes externas ni bases de datos.
Los informes incluyen rutas, identificadores de objetos y cantidades; no copian
documentos, nombres ni credenciales encontrados.

```sh
python -B scripts/audit_privacy.py --report .runtime/privacy/audit.json
python -B scripts/test-privacy.py
```

Para comparar con una lista local conocida, añadir `--reference-csv` con un CSV
que tenga las columnas `dni` y `apellido_nombres`. Mantener esa referencia fuera
de Git. La opción puede repetirse para varias listas. El auditor revisa las
referencias y reflogs disponibles; no examina por defecto objetos inalcanzables
ni descifra formatos binarios/documentos adjuntos.

## Herramientas de importación locales

Las fuentes se pasan explícitamente para que sus ubicaciones no aparezcan en
el código publicado. Los scripts generan archivos y no ejecutan SQL:

```sh
python -B scripts/generar_importacion_empleados.py supabase/imports/empleados.sql --source /ruta/local/empleados.xlsx
python -B scripts/extract_francos_pdf.py /ruta/local/saldos.pdf
```

El extractor PDF necesita PyMuPDF (`fitz`), una herramienta opcional del entorno
local. Mantener sus resultados dentro de `supabase/imports/`, que está ignorado.
Las variables de hosts adicionales para desarrollo van en `.env.local` como
`DEV_ALLOWED_ORIGINS=host-local,otro-host`; no se incluyen en la copia publicable.
