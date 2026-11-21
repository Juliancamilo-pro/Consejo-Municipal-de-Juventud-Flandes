import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const typedConfig = firebaseConfig as { firestoreDatabaseId?: string };
const FIRESTORE_DATABASE_ID =
  typedConfig.firestoreDatabaseId ||
  'ai-studio-cmjflandesconsej-7b69e81f-e809-478e-9179-c7bab6dcdb2a';

export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.acls',
  'https://www.googleapis.com/auth/calendar.acls.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.calendars.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.owned.readonly',
  'https://www.googleapis.com/auth/calendar.events.public.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
];

// Token OAuth almacenado estrictamente en memoria JavaScript (nunca en localStorage/sessionStorage)
let inMemoryWorkspaceAccessToken: string | null = null;

export function getWorkspaceAccessToken(): string | null {
  return inMemoryWorkspaceAccessToken;
}

export function setWorkspaceAccessToken(token: string | null): void {
  inMemoryWorkspaceAccessToken = token;
}

export function createGoogleWorkspaceProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export async function signInWithGoogleWorkspacePopup(): Promise<{
  credential: UserCredential;
  accessToken: string | null;
}> {
  const provider = createGoogleWorkspaceProvider();
  const current = auth.currentUser;

  let credential: UserCredential;
  if (current) {
    const hasGoogle = current.providerData.some((p) => p.providerId === 'google.com');
    if (hasGoogle) {
      credential = await reauthenticateWithPopup(current, provider);
    } else {
      try {
        credential = await linkWithPopup(current, provider);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('provider-already-linked') || msg.includes('credential-already-in-use')) {
          credential = await reauthenticateWithPopup(current, provider);
        } else {
          throw err;
        }
      }
    }
  } else {
    credential = await signInWithPopup(auth, provider);
  }

  const oauthCred = GoogleAuthProvider.credentialFromResult(credential);
  const accessToken = oauthCred?.accessToken ?? null;
  if (accessToken) {
    setWorkspaceAccessToken(accessToken);
  }
  return { credential, accessToken };
}

let connectionChecked = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionChecked) return;
  connectionChecked = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Error de conexión con Firestore: verifica la configuración de Firebase.');
    }
  }
}

void testFirestoreConnection();
