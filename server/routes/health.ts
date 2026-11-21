import { Router } from 'express';
import { getAdminConfigError, isAdminCredentialConfigured } from '../utils/authHelpers.ts';
import { isSessionSecretValid } from '../utils/cryptoHelpers.ts';

const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const adminReady = isAdminCredentialConfigured();
  const adminError = getAdminConfigError();
  const adminEmailConfigured = Boolean(process.env.ADMIN_EMAIL?.trim());
  const invitationCodeConfigured = Boolean(process.env.CMJ_INVITATION_CODE?.trim());
  const sessionSecretValid = isSessionSecretValid();

  const missingVars: string[] = [];
  if (!adminEmailConfigured) missingVars.push('ADMIN_EMAIL');
  if (!invitationCodeConfigured) missingVars.push('CMJ_INVITATION_CODE');
  if (!sessionSecretValid) missingVars.push('SESSION_SECRET');
  if (!adminReady) missingVars.push('FIREBASE_SERVICE_ACCOUNT');

  res.status(200).json({
    status: adminReady && missingVars.length === 0 ? 'ok' : 'degraded',
    service: 'cmj-flandes-platform',
    municipality: 'Flandes, Tolima',
    period: '2026-2029',
    firebaseAdminConfigured: adminReady,
    adminEmailConfigured,
    invitationCodeConfigured,
    sessionSecretValid,
    ...(adminError ? { firebaseAdminMessage: adminError } : {}),
    missingEnvironmentVariables: missingVars,
  });
});

export default healthRouter;
