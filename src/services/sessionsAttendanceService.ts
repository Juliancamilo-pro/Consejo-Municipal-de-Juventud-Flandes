import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import {
  AttendanceRecord,
  JustificationRecord,
  PlenarySession,
  UserProfile,
} from '../types/models';

export async function fetchAllSessions(): Promise<PlenarySession[]> {
  try {
    const q = query(collection(db, 'sessions'), orderBy('dateIso', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<PlenarySession, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sessions');
  }
}

export async function createPlenarySession(
  actor: UserProfile,
  payload: Omit<PlenarySession, 'id' | 'createdByUid' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  try {
    await addDoc(collection(db, 'sessions'), {
      ...payload,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SESSION_CREATED',
      targetCollection: 'sessions',
      summary: `Sesión "${payload.title}" programada para ${payload.dateIso}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'sessions');
  }
}

export async function updatePlenarySession(
  actor: UserProfile,
  sessionId: string,
  patch: Partial<
    Pick<PlenarySession, 'title' | 'sessionType' | 'dateIso' | 'location' | 'agenda' | 'visibility' | 'status'>
  >,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SESSION_UPDATED',
      targetCollection: 'sessions',
      targetId: sessionId,
      summary: `Actualización de sesión "${patch.title || sessionId}".`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function cancelPlenarySession(
  actor: UserProfile,
  sessionId: string,
  sessionTitle: string,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'cancelada',
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'SESSION_CANCELLED',
      targetCollection: 'sessions',
      targetId: sessionId,
      summary: `Sesión "${sessionTitle}" marcada como cancelada.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function fetchAllAttendance(): Promise<AttendanceRecord[]> {
  try {
    const q = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<AttendanceRecord, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'attendance');
  }
}

export async function recordAttendance(
  actor: UserProfile,
  payload: {
    sessionId: string;
    userUid: string;
    userName: string;
    status: 'presente' | 'ausente' | 'justificada';
    notes?: string;
  },
): Promise<void> {
  try {
    await addDoc(collection(db, 'attendance'), {
      sessionId: payload.sessionId,
      userUid: payload.userUid,
      userName: payload.userName,
      status: payload.status,
      recordedByUid: actor.uid,
      ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'attendance');
  }
}

export async function generateSessionCheckinCode(
  actor: UserProfile,
  sessionId: string,
): Promise<string> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await updateDoc(doc(db, 'sessions', sessionId), {
    checkinCode: code,
    updatedAt: serverTimestamp(),
  });
  await recordAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'SESSION_QR_CODE',
    targetCollection: 'sessions',
    targetId: sessionId,
    summary: `Código de asistencia habilitado para sesión ${sessionId}.`,
  });
  return code;
}

export async function selfCheckInWithSessionCode(
  actor: UserProfile,
  session: PlenarySession,
  submittedCode: string,
  existingAttendance: AttendanceRecord[],
): Promise<void> {
  if (!session.checkinCode) {
    throw new Error('La Mesa Directiva aún no ha activado un código QR para esta sesión.');
  }
  if (submittedCode.trim().toUpperCase() !== session.checkinCode.toUpperCase()) {
    throw new Error('El código ingresado no coincide con el código activo de la sesión.');
  }
  const already = existingAttendance.some(
    (a) => a.sessionId === session.id && a.userUid === actor.uid,
  );
  if (already) {
    throw new Error('Tu asistencia ya fue registrada para esta sesión.');
  }
  await recordAttendance(actor, {
    sessionId: session.id,
    userUid: actor.uid,
    userName: actor.displayName,
    status: 'presente',
    notes: 'Registro por código QR / clave de sesión',
  });
}

export async function fetchAllJustifications(): Promise<JustificationRecord[]> {
  try {
    const q = query(collection(db, 'justifications'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Omit<JustificationRecord, 'id'>),
      id: d.id,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'justifications');
  }
}

export async function submitJustification(
  actor: UserProfile,
  payload: {
    sessionId: string;
    reason: string;
    attachmentId?: string;
    attachmentName?: string;
    attachmentPath?: string;
  },
): Promise<void> {
  try {
    await addDoc(collection(db, 'justifications'), {
      sessionId: payload.sessionId,
      userUid: actor.uid,
      userName: actor.displayName,
      reason: payload.reason.trim(),
      ...(payload.attachmentId ? { attachmentId: payload.attachmentId } : {}),
      ...(payload.attachmentName ? { attachmentName: payload.attachmentName } : {}),
      ...(payload.attachmentPath ? { attachmentPath: payload.attachmentPath } : {}),
      reviewStatus: 'pendiente',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'justifications');
  }
}

export async function reviewJustification(
  actor: UserProfile,
  id: string,
  reviewStatus: 'aprobada' | 'rechazada',
): Promise<void> {
  try {
    await updateDoc(doc(db, 'justifications', id), {
      reviewStatus,
      reviewedByUid: actor.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `justifications/${id}`);
  }
}
