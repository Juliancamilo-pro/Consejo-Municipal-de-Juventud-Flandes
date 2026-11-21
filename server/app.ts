import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express, { Express, NextFunction, Request, Response } from 'express';
import {
  createOriginValidationMiddleware,
  createSecurityHeadersMiddleware,
} from './middleware/security.ts';
import authRouter from './routes/auth.ts';
import documentsRouter from './routes/documents.ts';
import emailNotifyRouter from './routes/emailNotify.ts';
import filesRouter from './routes/files.ts';
import healthRouter from './routes/health.ts';
import mailboxRouter from './routes/mailbox.ts';
import participationRouter from './routes/participation.ts';
import siteContentRouter from './routes/siteContent.ts';
import workspaceLinksRouter from './routes/workspaceLinks.ts';
import { ServerConfigError } from './utils/cryptoHelpers.ts';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(createSecurityHeadersMiddleware());
  app.use(createOriginValidationMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter);
  app.use('/api', siteContentRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/public', mailboxRouter);
  app.use('/api/public', participationRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/workspace', workspaceLinksRouter);
  app.use('/api/notifications', emailNotifyRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Recurso de API no encontrado.' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ServerConfigError) {
      res.status(503).json({
        error: err.message,
        code: 'SERVER_CONFIG_ERROR',
      });
      return;
    }

    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;

    if (status === 400) {
      res.status(400).json({ error: 'El formato de la solicitud enviada no es válido.' });
      return;
    }

    console.error('Error no controlado en API:', err);
    res.status(500).json({
      error: 'Ocurrió un error interno en el servidor. Intenta de nuevo en unos momentos.',
    });
  });

  return app;
}
