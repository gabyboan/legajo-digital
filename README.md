# Legajo Digital

[![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-auth_datos-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-estricto-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Panel interno para consultar y administrar legajos de personas, situacion de
revista, carrera, cargos, servicios, asistencia, francos y banco inicial de
horas.

## Valor del proyecto

Legajo Digital digitaliza informacion administrativa sensible en un panel
ordenado, con autenticacion, permisos y separacion por modulos. El objetivo es
reducir busquedas manuales, centralizar datos de personal y preparar una base
ampliable para nuevos flujos de RRHH.

## Modulos

| Modulo | Alcance |
| --- | --- |
| Personas | Alta, consulta y edicion de datos principales. |
| Situacion | Estado administrativo y seguimiento del legajo. |
| Cargos y servicios | Lectura modular de informacion laboral. |
| Asistencia y francos | Consulta, saldo inicial y movimientos. |
| Historial | Vista preparada para trazabilidad. |
| Documentos | Base para documentacion digital. |

## Arquitectura

```txt
app/
  (private)/      rutas protegidas por Supabase Auth
  login/          ingreso y cierre de sesion
  layout.tsx      metadata global y estructura base
utils/supabase/   clientes, server helpers y middleware
proxy.ts          proteccion de rutas y renovacion de sesion
```

## Tecnologias

- Next.js 16 con App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgREST y RPC

## Seguridad

- Las rutas privadas requieren usuario autenticado.
- Las credenciales reales no se versionan.
- No se suben dumps, claves `service_role` ni connection strings.
- Los permisos de lectura/escritura se delegan a roles y funciones de Supabase.
- Las RPC sensibles viven en el proyecto de base correspondiente.

## Configuracion

Copiar la plantilla de variables:

```bash
cp .env.example .env.local
```

Completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=https://bsoftware.pages.dev
```

Tambien se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` como alternativa a
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Validacion

```bash
npm run lint
npm run build
```

## Supabase

El proyecto espera objetos de base y RPC mantenidos en el repositorio de
auditoria/migraciones `gabyboan/hesm-supabase`.

RPC relevantes para francos/asistencia:

- `rpc_francos_horario`
- `rpc_francos_horario_guardar`
- `rpc_francos_saldo_inicial_actual`
- `rpc_francos_saldo_inicial`
- `rpc_francos_saldo_inicial_eliminar`

Permisos esperados:

- Edicion de legajo: roles configurados en `usuario_roles`.
- Lectura de francos: `can_francos_read()`.
- Escritura de francos/asistencia/banco inicial: `can_francos_write()`.

## Estado

Proyecto en desarrollo activo. El repositorio publico muestra arquitectura,
modulos y enfoque tecnico; la configuracion productiva y los datos reales no
forman parte del codigo versionado.
