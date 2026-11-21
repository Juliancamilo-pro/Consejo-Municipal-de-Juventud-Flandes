# Plataforma Institucional — CMJ Flandes, Tolima (2026–2029)

Portal ciudadano y panel privado del Consejo Municipal de Juventud de Flandes, Tolima (Colombia), construido con React 19, TypeScript, Tailwind CSS v4, Express, Firebase Authentication y Cloud Firestore.

## Configuración previa en Firebase Console

1. En **Firebase Console**, abre el proyecto configurado en `firebase-applet-config.json`.
2. Ve a **Authentication -> Sign-in method** y habilita el proveedor **Correo electrónico / Contraseña**.
3. Verifica que las reglas de `firestore.rules` estén desplegadas (se incluyen listas para producción).

## Variables de entorno (Secrets y Vercel)

Configura estas variables en tu panel de **Vercel → Settings → Environment Variables** o en tu `.env` local (nunca subas secretos al repositorio):

- `ADMIN_EMAIL`: Correo electrónico de la persona autorizada para la activación inicial única del **Secretario Administrador**.
- `CMJ_INVITATION_CODE`: Código de invitación inicial para que los consejeros creen su cuenta.
- `SESSION_SECRET`: Cadena aleatoria larga (mínimo 32 caracteres) para firmar cookies `httpOnly` de sesión y cifrar la rotación de códigos.
- `FIREBASE_SERVICE_ACCOUNT`: JSON de la cuenta de servicio de Firebase codificado en **Base64** (necesario en Vercel para `firebase-admin`, URLs firmadas de documentos internos y verificación del servidor).
- `APP_URL`: URL pública de producción (ej. `https://cmj-flandes.vercel.app`) para validar el encabezado `Origin`.
- `PORT`: Puerto HTTP del servidor Express local (por defecto `3000`).

> **Importante para Vercel y Firebase Storage**:
> 1. Agrega tu dominio de Vercel (`tu-proyecto.vercel.app`) en **Firebase Console → Authentication → Settings → Authorized domains**.
> 2. Despliega las reglas de `firestore.rules` y `storage.rules` desde Firebase Console o CLI.
> 3. El proyecto incluye `vercel.json` y `api/index.ts` para servir la SPA y las rutas `/api/*` como funciones serverless.

## Primer ingreso del Administrador

1. Ingresa a `/portal` y selecciona la pestaña **Activar Administrador**.
2. Digita el correo configurado en `ADMIN_EMAIL` y define una contraseña de mínimo 12 caracteres.
3. Tras activarse la cuenta, la ruta de activación se deshabilita automáticamente en el servidor y en Firestore (`/settings/bootstrap`).

## Registro de Consejeros

1. En `/portal` -> **Crear cuenta de consejero**, ingresa nombre completo, correo, contraseña (mínimo 12 caracteres) y el código `CMJ_INVITATION_CODE`.
2. El código se valida únicamente en el servidor con comparación en tiempo constante y bloqueo de 15 minutos tras 5 fallos.
3. La cuenta queda en estado **pendiente** hasta que el Presidente, Vicepresidente o Secretario Administrador la aprueben desde **Usuarios y Mesa**.

## Integración con Google Workspace (Docs, Sheets y Calendar)

- La integración de **Google Docs, Google Sheets y Google Calendar** utiliza **OAuth 2.0 del navegador** administrado por el usuario desde `/portal` → **Google Workspace**, con tokens mantenidos únicamente en memoria JavaScript (nunca se almacenan en Firestore ni en `localStorage`).
- Las acciones de creación, exportación de directorios/asistencias/compromisos/plan o escritura sobre rangos en **Google Sheets** exigen confirmación explícita del usuario y leen previamente el nombre real de las pestañas de la hoja de cálculo.
- Los enlaces institucionales (`workspace_links`) se registran a través del servidor Express validando sesión y token CSRF.

## Compilación, pruebas y despliegue

```bash
npm install
npm run lint
npm test
npm run build
npx eslint firestore.rules
npm start
```

### Suite de verificación adicional

- `npm test`: ejecuta pruebas unitarias y de seguridad (`tests/utils.test.ts`, `tests/authSecurity.test.ts`, `tests/profileUtils.test.ts`, `tests/documentsValidation.test.ts`, `tests/participation.test.ts`, `tests/seasonalThemes.test.ts`, `tests/workspaceSheets.test.ts`), validación de contratos en `firestore.rules` y `storage.rules` (`tests/rules.test.ts`), validación de salud del servidor (`tests/serverProd.test.ts`) y accesibilidad WCAG AA con `axe-core` (`tests/accessibility.test.tsx`).
- `npm run test:rules`: ejecuta la validación de contratos en `firestore.rules` y `storage.rules`.
- `npx eslint firestore.rules`: audita `firestore.rules` con `@firebase/eslint-plugin-security-rules`.
- `npm run test:e2e`: con el servidor corriendo en `http://127.0.0.1:3000`, verifica `/api/health` y las rutas públicas `/`, `/consejeros`, `/comisiones`, `/gestion`, `/actualidad`, `/participacion` y `/portal`.

