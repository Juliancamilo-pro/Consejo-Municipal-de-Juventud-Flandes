import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  ensureMinimalStructure,
  ensureServerlessPath,
  isAllowedCorsOrigin,
  STRUCTURAL_COMMISSIONS_BASE,
} from './helpers.ts';
import { registerAuthAndPublicRoutes } from './routes/authAndPublic.ts';
import { registerMediaAndUsersRoutes } from './routes/mediaAndUsers.ts';
import { registerCommissionsAndContentRoutes } from './routes/commissionsAndContent.ts';
import { registerSessionsAndActasRoutes } from './routes/sessionsAndActas.ts';
import { registerVotesAndWorkRoutes } from './routes/votesAndWork.ts';
import { registerPermissionsAndNotificationsRoutes } from './routes/permissionsAndNotifications.ts';
import { registerDocumentsAndPortalRoutes } from './routes/documentsAndPortal.ts';

export { ensureMinimalStructure, ensureServerlessPath, STRUCTURAL_COMMISSIONS_BASE };

let cachedApp: express.Express | null = null;

export function getApiApp(): express.Express {
  if (cachedApp) return cachedApp;

  const app = express();
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    if (origin && isAllowedCorsOrigin(origin, req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With, X-CMJ-Context'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use((req: Request & { _body?: boolean }, _res, next) => {
    if (req.body !== undefined) {
      if (typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch {
          // Mantener texto si no es JSON
        }
      } else if (Buffer.isBuffer(req.body)) {
        try {
          req.body = JSON.parse(req.body.toString('utf8'));
        } catch {
          // Mantener buffer si no es JSON
        }
      }
      req._body = true;
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  });

  app.use((err: { type?: string; status?: number }, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      res.status(413).json({
        error: 'El archivo o solicitud supera el tamaño máximo permitido por el servidor.',
      });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Formato de solicitud inválido.' });
      return;
    }
    next(err);
  });

  registerAuthAndPublicRoutes(app);
  registerMediaAndUsersRoutes(app);
  registerCommissionsAndContentRoutes(app);
  registerDocumentsAndPortalRoutes(app);
  registerSessionsAndActasRoutes(app);
  registerVotesAndWorkRoutes(app);
  registerPermissionsAndNotificationsRoutes(app);

  cachedApp = app;
  return app;
}
