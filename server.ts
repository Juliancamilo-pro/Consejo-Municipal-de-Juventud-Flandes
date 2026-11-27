import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { getApiApp } from './src/server/app.ts';
import { runRoleTransitionJobOnce } from './src/server/services/roleTransitions.ts';

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
const PORT = Number.isFinite(cliPort) && cliPort > 0 ? cliPort : Number(process.env.PORT || 3000);

async function startServer() {
  const app = getApiApp();
  const httpServer = http.createServer(app);

  const distDir = path.resolve(import.meta.dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CMJ Flandes server listening on port ${PORT}`);
    runRoleTransitionJobOnce().catch((err) => {
      console.error('Initial role transition sync failed:', err);
    });
    const transitionTimer = setInterval(() => {
      runRoleTransitionJobOnce().catch((err) => {
        console.error('Periodic role transition sync failed:', err);
      });
    }, 60_000);
    transitionTimer.unref?.();
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
