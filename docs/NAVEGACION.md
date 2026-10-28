# Navegación y pantallas pequeñas

Cambios preparados localmente el 27 de octubre de 2026.

- En pantallas menores a 768 px, el menú comienza cerrado y se abre con el botón
  **Menú**. Se despliega dentro de la página, sin tapar el contenido con una ventana modal.
- Desde 768 px, el panel lateral permanece visible y deja espacio flexible al contenido.
- La sección actual se resalta y se identifica con `aria-current`. En rutas
  anidadas se elige sólo la coincidencia más específica.
- Al navegar, el menú móvil se cierra; también se restablece al usar Atrás o Adelante.
- Escape cierra el menú y devuelve el foco a su botón. Los enlaces y el botón
  tienen foco visible, y **Saltar al contenido** permite omitir la navegación.
- Los enlaces y el cierre de sesión tienen una altura mínima de 44 px.
- La tabla de Personas se desplaza dentro de su panel y muestra una indicación
  en pantallas pequeñas para descubrir las columnas restantes.

`PrivateLayout` conserva la comprobación de sesión en el servidor y la acción de
cierre de sesión. `PrivateShell` organiza la presentación; `AppNavigation`
contiene únicamente el estado de apertura y la selección de enlaces.

## Verificación de interfaz

```sh
python -B scripts/test-navegacion-ui.py
```

Requiere Python con Playwright y Chromium. La prueba crea un proyecto de preview
aislado bajo `.runtime/navigation/preview`, importa los componentes reales y usa
contenido ficticio. Se inicia sólo en `127.0.0.1:3109`, sin conexión a Supabase,
sin crear rutas públicas dentro de la aplicación ni alterar su servidor habitual.
El proyecto temporal se elimina al terminar; quedan capturas y registro en
`.runtime/navigation/`, fuera de Git.

Se comprueban apertura/cierre, navegación, selección de una sección anidada,
Escape, retorno del foco, salto al contenido, historial del navegador y ausencia
de desbordes de página entre 320 y 1280 px. Las capturas son ejemplos de los
componentes con datos sintéticos, no pantallas de personas reales.

La vista completa de las páginas con una cuenta autenticada y los flujos de
edición con datos de demostración siguen pendientes de la prueba integral del sistema.
