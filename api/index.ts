import type { IncomingMessage, ServerResponse } from 'node:http';
import { ensureServerlessPath, getApiApp } from '../src/server/app.ts';

const app = getApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  ensureServerlessPath(req);
  return app(req as unknown as Parameters<typeof app>[0], res as unknown as Parameters<typeof app>[1]);
}
