import { NextFunction, Request, Response, RequestHandler } from 'express';
import helmet from 'helmet';

export function createSecurityHeadersMiddleware(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://apis.google.com',
          'https://www.gstatic.com',
          'https://www.google.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'https://*.firebaseapp.com',
          'https://*.firebasestorage.app',
          'https://firebasestorage.googleapis.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          'wss://*.firebaseio.com',
          'wss://*.googleapis.com',
        ],
        frameSrc: [
          "'self'",
          'https://*.firebaseapp.com',
          'https://accounts.google.com',
          'https://www.google.com',
          'https://firebasestorage.googleapis.com',
        ],
        frameAncestors: [
          "'self'",
          'https://aistudio.google.com',
          'https://*.google.com',
          'https://*.googleusercontent.com',
          'https://*.usercontent.goog',
          'https://*.run.app',
        ],
        objectSrc: ["'self'", 'blob:'],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
  });
}

function getAllowedOrigins(req: Request): Set<string> {
  const allowed = new Set<string>();
  const host = req.headers.host;
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  const appUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (appUrl) {
    allowed.add(appUrl);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    allowed.add(`https://${vercelUrl}`);
  }

  return allowed;
}

export function createOriginValidationMiddleware(): RequestHandler {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (safeMethods.has(req.method)) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }

    const allowed = getAllowedOrigins(req);
    if (allowed.has(origin)) {
      next();
      return;
    }

    if (
      process.env.NODE_ENV !== 'production' &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
    ) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Origen de solicitud no autorizado para esta operación.',
    });
  };
}
