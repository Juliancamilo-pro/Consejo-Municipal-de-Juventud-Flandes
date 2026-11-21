import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { InitiativeStatus, UserProfile, YouthInitiative } from '../types/models';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

function getDeviceFingerprint(): string {
  const key = 'cmj_flandes_device_id';
  const existing = localStorage.getItem(key);
  if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
  const fresh = crypto.randomUUID().replace(/-/g, '');
  localStorage.setItem(key, fresh);
  return fresh;
}

export async function fetchYouthInitiatives(): Promise<YouthInitiative[]> {
  try {
    const q = query(collection(db, 'youth_initiatives'), orderBy('supportCount', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Omit<YouthInitiative, 'id'>),
      id: d.id,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'youth_initiatives');
  }
}

export async function submitYouthInitiative(payload: {
  title: string;
  summary: string;
  neighborhood: string;
  thematicArea: string;
  proposerAlias?: string;
}): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'youth_initiatives'), {
      title: payload.title.trim().slice(0, 160),
      summary: payload.summary.trim().slice(0, 1500),
      neighborhood: payload.neighborhood.trim().slice(0, 120),
      thematicArea: payload.thematicArea.trim().slice(0, 80),
      proposerAlias: (payload.proposerAlias?.trim() || 'Juventud de Flandes').slice(0, 80),
      status: 'recibida',
      supportCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'youth_initiatives');
  }
}

export async function supportYouthInitiative(initiativeId: string): Promise<'supported' | 'already'> {
  const deviceId = getDeviceFingerprint();
  const supportRef = doc(db, 'youth_initiatives', initiativeId, 'support', deviceId);
  const initRef = doc(db, 'youth_initiatives', initiativeId);

  const existingSupport = await getDoc(supportRef);
  if (existingSupport.exists()) {
    return 'already';
  }

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(supportRef);
      if (snap.exists()) {
        throw new Error('ALREADY_SUPPORTED');
      }
      tx.set(supportRef, { createdAt: serverTimestamp() });
      tx.update(initRef, {
        supportCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    });
    return 'supported';
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ALREADY_SUPPORTED') {
      return 'already';
    }
    throw err;
  }
}

export async function updateInitiativeStatus(
  actor: UserProfile,
  initiativeId: string,
  status: InitiativeStatus,
  boardResponse?: string,
  assignedCommissionId?: string,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'youth_initiatives', initiativeId), {
      status,
      ...(boardResponse?.trim() ? { boardResponse: boardResponse.trim().slice(0, 1200) } : {}),
      ...(assignedCommissionId ? { assignedCommissionId } : {}),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `INITIATIVE_${status.toUpperCase()}`,
      targetCollection: 'youth_initiatives',
      targetId: initiativeId,
      summary: `Iniciativa ciudadana actualizada a estado ${status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `youth_initiatives/${initiativeId}`);
  }
}
