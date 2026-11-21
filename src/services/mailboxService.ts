import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { MailboxEntry, MailboxHistoryItem, UserProfile } from '../types/models';

export async function fetchAllMailboxEntries(): Promise<MailboxEntry[]> {
  try {
    const q = query(collection(db, 'mailbox'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<MailboxEntry, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'mailbox');
  }
}

export async function assignMailboxEntry(
  actor: UserProfile,
  entry: MailboxEntry,
  assignedToUid: string,
  assignedToName: string,
): Promise<void> {
  try {
    const nextHistory: MailboxHistoryItem[] = [
      ...(entry.history || []).slice(-19),
      {
        action: assignedToUid ? `Asignado a ${assignedToName}` : 'Asignación retirada',
        actorName: actor.displayName,
        atIso: new Date().toISOString(),
      },
    ];
    await updateDoc(doc(db, 'mailbox', entry.id), {
      assignedToUid,
      assignedToName,
      history: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mailbox/${entry.id}`);
  }
}

export async function respondMailboxEntry(
  actor: UserProfile,
  entry: MailboxEntry,
  status: MailboxEntry['status'],
  officialResponse: string,
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const nextHistory: MailboxHistoryItem[] = [
      ...(entry.history || []).slice(-19),
      {
        action: `Estado cambiado a ${status}`,
        actorName: actor.displayName,
        atIso: new Date().toISOString(),
      },
    ];
    batch.update(doc(db, 'mailbox', entry.id), {
      status,
      officialResponse: officialResponse.trim(),
      respondedByUid: actor.uid,
      history: nextHistory,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'mailbox_tracking', entry.trackingCode), {
      status,
      officialResponse: officialResponse.trim(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'MAILBOX_RESPONDED',
      targetCollection: 'mailbox',
      targetId: entry.id,
      summary: `Respuesta a radicado ${entry.trackingCode} (${status}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `mailbox/${entry.id}`);
  }
}
