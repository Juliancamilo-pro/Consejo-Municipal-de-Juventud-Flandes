import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

interface AuditInput {
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  summary: string;
}

export async function recordAuditLog(input: AuditInput): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actorUid: input.actorUid,
      actorEmail: input.actorEmail.slice(0, 160),
      actorRole: input.actorRole.slice(0, 40),
      action: input.action.slice(0, 120),
      targetCollection: input.targetCollection.slice(0, 80),
      ...(input.targetId ? { targetId: input.targetId.slice(0, 128) } : {}),
      summary: input.summary.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('No fue posible registrar evento de auditoría:', error);
  }
}
