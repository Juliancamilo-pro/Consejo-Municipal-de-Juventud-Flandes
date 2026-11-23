import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createFirestoreClient(targetApp: FirebaseApp): Firestore {
  try {
    return initializeFirestore(
      targetApp,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(targetApp, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreClient(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Persistencia de sesión local para evitar cierres inesperados al recargar
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Instancia secundaria en memoria para crear cuentas de consejeros sin cerrar la sesión actual
const secondaryApp =
  getApps().find((a) => a.name === 'cmj-provisioning') ||
  initializeApp(firebaseConfig, 'cmj-provisioning');
export const secondaryAuth = getAuth(secondaryApp);
setPersistence(secondaryAuth, inMemoryPersistence).catch(() => {});

export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline')) {
      return { ok: false, error: 'Sin conexión con Firestore.' };
    }
    return { ok: true };
  }
}
