# Portal Oficial — CMJ Flandes, Tolima

Aplicación web oficial y plataforma interna de gestión del **Consejo Municipal de Juventudes (CMJ) de Flandes, Tolima, Colombia**.

## Stack tecnológico

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (modo claro / oscuro y temas festivos configurables)
- Motion (`motion/react`)
- Firebase Authentication (Correo y contraseña), Cloud Firestore (con caché persistente offline) y Firebase Storage
- SheetJS (`xlsx`) para exportación e importación de planillas en Excel y CSV

## Instalación local

```bash
npm install
cp .env.example .env
npm run dev
```

## Configuración de Firebase

1. Verifica que `firebase-applet-config.json` tenga las credenciales de tu proyecto Firebase.
2. En **Firebase Console → Authentication → Sign-in method**, habilita **Correo electrónico/contraseña**.
3. En **Firebase Console → Storage**, activa Storage y publica el contenido de `storage.rules`.
4. En **Firebase Console → Firestore Database → Reglas**, publica el contenido de `firestore.rules`.

## Despliegue en Vercel

1. Sube este repositorio a GitHub/GitLab/Bitbucket e impórtalo en [Vercel](https://vercel.com/).
2. Configuración de compilación:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. El archivo `vercel.json` ya incluye las reescrituras SPA necesarias.
4. Copia tu dominio final de Vercel (por ejemplo `cmj-flandes.vercel.app`) y agrégalo en **Firebase Console → Authentication → Settings → Authorized domains**.
