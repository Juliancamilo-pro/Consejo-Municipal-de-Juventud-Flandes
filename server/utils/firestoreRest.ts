import firebaseConfigRaw from '../../firebase-applet-config.json' with { type: 'json' };

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
}

const DEFAULT_FIRESTORE_DATABASE_ID =
  'ai-studio-cmjflandesconsej-7b69e81f-e809-478e-9179-c7bab6dcdb2a';

const rawConfig = firebaseConfigRaw as FirebaseAppletConfig;
const firebaseConfig: FirebaseAppletConfig = {
  ...rawConfig,
  firestoreDatabaseId: rawConfig.firestoreDatabaseId || DEFAULT_FIRESTORE_DATABASE_ID,
};

export function getFirebaseProjectConfig(): FirebaseAppletConfig {
  return firebaseConfig;
}

function buildDocUrl(docPath: string): string {
  const dbId = firebaseConfig.firestoreDatabaseId || DEFAULT_FIRESTORE_DATABASE_ID;
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(dbId)}/documents/${docPath}`;
}

function unwrapFirestoreValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  return undefined;
}

export async function fetchFirestoreDocViaRest(
  docPath: string,
  bearerIdToken?: string,
): Promise<Record<string, unknown> | null> {
  try {
    const headers: Record<string, string> = {};
    if (bearerIdToken) {
      headers.Authorization = `Bearer ${bearerIdToken}`;
    }
    const res = await fetch(buildDocUrl(docPath), { headers });
    if (res.status === 404 || res.status === 403) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      fields?: Record<string, Record<string, unknown>>;
    };
    if (!json.fields) return null;

    const result: Record<string, unknown> = {};
    for (const [key, rawVal] of Object.entries(json.fields)) {
      result[key] = unwrapFirestoreValue(rawVal);
    }
    return result;
  } catch {
    return null;
  }
}
