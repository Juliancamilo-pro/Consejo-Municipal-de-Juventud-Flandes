import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import type { RoleLabel } from '../../types/cmj';

export async function recordAudit(params: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  action: string;
  module: string;
  targetTitle: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actorUid: params.uid,
      actorName: params.actorName.slice(0, 120) || 'Consejero CMJ',
      actorRoleLabel: params.actorRoleLabel,
      action: params.action.slice(0, 180),
      module: params.module.slice(0, 80),
      targetTitle: params.targetTitle.slice(0, 180),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Registro no bloqueante
  }
}
