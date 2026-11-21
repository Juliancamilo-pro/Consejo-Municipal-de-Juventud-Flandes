import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { UserProfile } from '../types/models';
import { CallRegistration, PublicCall } from '../types/participation';
import { recordAuditLog } from './auditService';
import { db } from './firebase';

export async function fetchPublishedCalls(): Promise<PublicCall[]> {
  const q = query(
    collection(db, 'public_calls'),
    where('status', 'in', ['abierta', 'cerrada']),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicCall, 'id'>) }));
}

export async function fetchAllCalls(): Promise<PublicCall[]> {
  const snap = await getDocs(query(collection(db, 'public_calls'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicCall, 'id'>) }));
}

export async function createPublicCall(
  actor: UserProfile,
  input: Omit<PublicCall, 'id' | 'status' | 'createdByUid' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'public_calls'), {
    ...input,
    status: 'abierta',
    createdByUid: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await recordAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'CALL_CREATE',
    targetCollection: 'public_calls',
    targetId: ref.id,
    summary: `Convocatoria creada: ${input.title}`,
  });
  return ref.id;
}

export async function updateCallStatus(
  actor: UserProfile,
  callId: string,
  status: PublicCall['status'],
): Promise<void> {
  await updateDoc(doc(db, 'public_calls', callId), { status, updatedAt: serverTimestamp() });
  await recordAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'CALL_STATUS',
    targetCollection: 'public_calls',
    targetId: callId,
    summary: `Convocatoria ${status}`,
  });
}

export async function submitPublicCallRegistration(input: {
  callId: string;
  callTitle: string;
  fullName: string;
  age: number;
  neighborhood: string;
  email: string;
  phone?: string;
  notes?: string;
  extraAnswers?: Record<string, string>;
  honeypot?: string;
}): Promise<{ id: string; emailDelivered: boolean }> {
  const res = await fetch('/api/public/calls/validate-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    emailDelivered?: boolean;
    sanitized?: Omit<CallRegistration, 'id' | 'createdAt'>;
  };
  if (!res.ok || !data.sanitized) {
    throw new Error(data.error || 'No se pudo validar tu inscripción.');
  }

  const ref = await addDoc(collection(db, 'call_registrations'), {
    ...data.sanitized,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, emailDelivered: Boolean(data.emailDelivered) };
}

export async function fetchCallRegistrations(callId?: string): Promise<CallRegistration[]> {
  const q = callId
    ? query(
        collection(db, 'call_registrations'),
        where('callId', '==', callId),
        orderBy('createdAt', 'desc'),
      )
    : query(collection(db, 'call_registrations'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CallRegistration, 'id'>) }));
}
