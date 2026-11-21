import { cert, getApp, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getFirebaseProjectConfig } from './firestoreRest.ts';

let cachedServiceAccountError: string | null = null;
let parsedServiceAccount: ServiceAccount | null = null;
let initializedWithCredential = false;

function loadServiceAccountFromEnv(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) {
    cachedServiceAccountError =
      'La variable FIREBASE_SERVICE_ACCOUNT no está configurada (JSON de cuenta de servicio en base64).';
    return null;
  }

  try {
    const jsonText = raw.startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonText) as ServiceAccount & { project_id?: string };
    if (!parsed || typeof parsed !== 'object' || (!parsed.projectId && !parsed.project_id)) {
      cachedServiceAccountError =
        'FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido de cuenta de servicio de Firebase.';
      return null;
    }
    cachedServiceAccountError = null;
    return parsed;
  } catch {
    cachedServiceAccountError =
      'No se pudo decodificar FIREBASE_SERVICE_ACCOUNT. Verifica que esté codificada en base64 válido.';
    return null;
  }
}

export function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const config = getFirebaseProjectConfig();
  parsedServiceAccount = loadServiceAccountFromEnv();

  if (parsedServiceAccount) {
    initializedWithCredential = true;
    return initializeApp({
      credential: cert(parsedServiceAccount),
      projectId: config.projectId,
      storageBucket: config.storageBucket,
    });
  }

  initializedWithCredential = false;
  return initializeApp({
    projectId: config.projectId,
    storageBucket: config.storageBucket,
  });
}

export function isAdminCredentialConfigured(): boolean {
  if (getApps().length === 0) {
    getAdminApp();
  }
  return initializedWithCredential;
}

export function getAdminConfigError(): string | null {
  if (getApps().length === 0) {
    getAdminApp();
  }
  return cachedServiceAccountError;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  const app = getAdminApp();
  const { firestoreDatabaseId } = getFirebaseProjectConfig();
  return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
}

export function getAdminStorage() {
  const app = getAdminApp();
  const { storageBucket } = getFirebaseProjectConfig();
  return getStorage(app).bucket(storageBucket);
}

export function getClientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}
