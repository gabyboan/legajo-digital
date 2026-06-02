# Legajo Digital

Panel interno para consultar y administrar legajos de personas, situacion de
revista, carrera, asistencia y banco inicial de horas.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgREST y RPC

## Requisitos

- Node.js `>=20.9.0`
- npm
- Acceso al proyecto Supabase correspondiente

## Configuracion

Copiar la plantilla de variables:

```bash
cp .env.example .env.local
```

Completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
```

Tambien se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` como alternativa a
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

No commitear `.env.local`, claves `service_role`, connection strings ni dumps
con datos reales.

## Desarrollo

Instalar dependencias:

```bash
npm install
```

Levantar el servidor:

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Supabase

El proyecto espera objetos de base y RPC mantenidos en el repositorio de
auditoria/migraciones `gabyboan/hesm-supabase`.

RPC relevantes para el modulo de francos/asistencia:

- `rpc_francos_horario`
- `rpc_francos_horario_guardar`
- `rpc_francos_saldo_inicial_actual`
- `rpc_francos_saldo_inicial`
- `rpc_francos_saldo_inicial_eliminar`

Permisos esperados:

- Edicion de legajo: roles de legajo configurados en `usuario_roles`.
- Lectura de francos: `can_francos_read()`.
- Escritura de francos/asistencia/banco inicial: `can_francos_write()`.

## Higiene del repo

Antes de subir cambios:

```bash
npm run lint
git status --short
```

Verificar que no haya credenciales ni archivos generados en el commit.
