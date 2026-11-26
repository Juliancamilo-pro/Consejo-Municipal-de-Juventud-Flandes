# Portal Oficial — CMJ Flandes, Tolima

Aplicación web oficial y plataforma interna de gestión del **Consejo Municipal de Juventudes (CMJ) de Flandes, Tolima, Colombia**.

## Stack tecnológico

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (modo claro / oscuro y temas festivos configurables)
- Motion (`motion/react`)
- Express + Drizzle ORM + PostgreSQL (sesiones con cookies HttpOnly y token en memoria)
- SheetJS (`xlsx`) para exportación e importación de planillas en Excel y CSV

## Instalación local

```bash
npm install
cp .env.example .env
npm run dev
```

## Variables de entorno requeridas (PostgreSQL)

Configura una base de datos PostgreSQL (por ejemplo Neon, Supabase, Vercel Postgres o Cloud SQL):

- `DATABASE_URL` (cadena de conexión PostgreSQL, recomendada para Vercel), **o bien**
- `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`
- Opcional recomendado en producción: `CMJ_SESSION_SECRET` (clave aleatoria larga para firmar sesiones)
- Para habilitar la pestaña pública **"Registrarme"** (auto-registro de consejeros):
  - `CMJ_REGISTRATION_PASSWORD`: contraseña inicial institucional exigida en el formulario de registro.
  - `CMJ_ACTIVATION_CODE`: código de activación institucional exigido en el formulario de registro.

Al arrancar, el servidor crea automáticamente las tablas necesarias en PostgreSQL si aún no existen.

## Despliegue en Vercel

1. Sube este repositorio a GitHub/GitLab/Bitbucket e impórtalo en [Vercel](https://vercel.com/).
2. En **Vercel → Project Settings → Environment Variables**, agrega `DATABASE_URL` (o las variables `SQL_*`), `CMJ_SESSION_SECRET`, `CMJ_REGISTRATION_PASSWORD` y `CMJ_ACTIVATION_CODE`.
3. Configuración de compilación:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. El archivo `vercel.json` enruta automáticamente `/api/*` hacia `api/index.ts` y las demás rutas hacia `index.html`.
5. Puedes verificar el estado de la base de datos abriendo `https://tu-dominio.vercel.app/api/health?db=1`.
