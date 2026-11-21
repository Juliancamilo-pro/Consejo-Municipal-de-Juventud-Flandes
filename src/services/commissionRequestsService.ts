import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  Commission,
  CommissionJoinRequest,
  CommissionMemberEntry,
  UserProfile,
} from '../types/models';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { createInternalNotification } from './notificationsService';

export async function fetchCommissionJoinRequests(
  commissionId: string,
): Promise<CommissionJoinRequest[]> {
  try {
    const q = query(
      collection(db, 'commissions', commissionId, 'join_requests'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Omit<CommissionJoinRequest, 'id'>),
      id: d.id,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `commissions/${commissionId}/join_requests`);
  }
}

export async function requestJoinCommission(
  actor: UserProfile,
  commission: Commission,
  message?: string,
): Promise<void> {
  try {
    await setDoc(doc(db, 'commissions', commission.id, 'join_requests', actor.uid), {
      commissionId: commission.id,
      userUid: actor.uid,
      userName: actor.displayName,
      ...(actor.photoUrl ? { userPhotoUrl: actor.photoUrl } : {}),
      ...(message?.trim() ? { message: message.trim().slice(0, 400) } : {}),
      status: 'pendiente',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'COMMISSION_JOIN_REQUESTED',
      targetCollection: 'commissions',
      targetId: commission.id,
      summary: `${actor.displayName} solicitó unirse a "${commission.name}".`,
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `commissions/${commission.id}/join_requests/${actor.uid}`,
    );
  }
}

export async function reviewCommissionJoinRequest(
  actor: UserProfile,
  commission: Commission,
  requestItem: CommissionJoinRequest,
  decision: 'aprobada' | 'rechazada',
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const reqRef = doc(db, 'commissions', commission.id, 'join_requests', requestItem.id);
    batch.update(reqRef, {
      status: decision,
      reviewedByUid: actor.uid,
      updatedAt: serverTimestamp(),
    });

    if (decision === 'aprobada') {
      const currentMembers = commission.members || [];
      const exists = currentMembers.some((m) => m.uid === requestItem.userUid);
      const nextMembers: CommissionMemberEntry[] = exists
        ? currentMembers
        : [
            ...currentMembers,
            {
              uid: requestItem.userUid,
              displayName: requestItem.userName,
              ...(requestItem.userPhotoUrl ? { photoUrl: requestItem.userPhotoUrl } : {}),
              role: 'integrante',
              joinedAtIso: new Date().toISOString().slice(0, 10),
            },
          ];
      const nextUids = Array.from(
        new Set([...(commission.memberUids || []), requestItem.userUid]),
      );
      batch.update(doc(db, 'commissions', commission.id), {
        members: nextMembers.slice(0, 40),
        memberUids: nextUids.slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await createInternalNotification(actor, {
      title: `Solicitud en comisión: ${commission.name}`,
      body: `${requestItem.userName}: tu solicitud de ingreso fue ${decision} por ${actor.displayName}.`,
      category: 'aviso',
    }).catch(() => undefined);

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `COMMISSION_JOIN_${decision.toUpperCase()}`,
      targetCollection: 'commissions',
      targetId: commission.id,
      summary: `Solicitud de ${requestItem.userName} en "${commission.name}": ${decision}.`,
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `commissions/${commission.id}/join_requests/${requestItem.id}`,
    );
  }
}
