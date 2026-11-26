import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function disableViteClientWsPlugin(): Plugin {
  let isWsDisabled = false;
  return {
    name: 'disable-vite-client-ws',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      isWsDisabled = config.server.ws === false || config.server.hmr === false;
    },
    transform(code, id) {
      if (!isWsDisabled) return null;
      if (id.includes('vite/dist/client/client.mjs') || id.endsWith('/@vite/client')) {
        return code.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* WebSocket HMR disabled */'
        );
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  const enableHmr = process.env.ENABLE_HMR === 'true';
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [
      disableViteClientWsPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'CMJ Flandes — Consejo Municipal de Juventudes',
          short_name: 'CMJ Flandes',
          description:
            'Portal oficial del Consejo Municipal de Juventudes de Flandes, Tolima. Comisiones, actas, asistencia, votaciones y participación juvenil.',
          theme_color: '#047857',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          lang: 'es-CO',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/public\/state$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'cmj-public-state-cache',
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/xlsx/')) {
              return 'xlsx-vendor';
            }
            if (id.includes('/motion/') || id.includes('/framer-motion/')) {
              return 'motion-vendor';
            }
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      hmr: enableHmr,
      ws: enableHmr ? undefined : false,
      watch: enableHmr ? {} : null,
    },
  };
});
