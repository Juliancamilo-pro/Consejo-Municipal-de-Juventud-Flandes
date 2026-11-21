import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { UserProfile } from '../types/models';
import { InternalNotification } from '../types/participation';
import { recordAuditLog } from './auditService';
import { db } from './firebase';

export async function fetchInternalNotifications(): Promise<InternalNotification[]> {
  const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(40));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<InternalNotification, 'id'>),
  }));
}

export async function createInternalNotification(
  actor: UserProfile,
  input: {
    title: string;
    body: string;
    category: InternalNotification['category'];
    sessionId?: string;
  },
): Promise<string> {
  const ref = await addDoc(collection(db, 'notifications'), {
    title: input.title.trim(),
    body: input.body.trim(),
    category: input.category,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    readByUids: [actor.uid],
    createdByUid: actor.uid,
    createdByName: actor.displayName,
    createdAt: serverTimestamp(),
  });
  await recordAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'NOTIFICATION_SENT',
    targetCollection: 'notifications',
    targetId: ref.id,
    summary: `Aviso interno emitido: ${input.title}`,
  });
  return ref.id;
}

export async function markNotificationAsRead(notificationId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', notificationId), {
    readByUids: arrayUnion(uid),
  });
}
