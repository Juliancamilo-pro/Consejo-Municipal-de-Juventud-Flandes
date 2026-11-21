import {
  addDoc,
  collection,
  doc,
  getDoc,
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
import {
  CommitmentComment,
  CommitmentItem,
  ElectionItem,
  UserProfile,
} from '../types/models';
export {
  assignMailboxEntry,
  fetchAllMailboxEntries,
  respondMailboxEntry,
} from './mailboxService';

export async function fetchAllElections(): Promise<ElectionItem[]> {
  try {
    const q = query(collection(db, 'elections'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<ElectionItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'elections');
  }
}

export async function createElection(
  actor: UserProfile,
  payload: { title: string; description: string; options: string[]; closesAt?: string },
): Promise<void> {
  try {
    await addDoc(collection(db, 'elections'), {
      title: payload.title.trim(),
      description: payload.description.trim(),
      options: payload.options,
      status: 'abierta',
      ...(payload.closesAt?.trim() ? { closesAt: payload.closesAt.trim() } : {}),
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ELECTION_CREATED',
      targetCollection: 'elections',
      summary: `Votación "${payload.title.trim()}" abierta.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'elections');
  }
}

export async function closeElection(actor: UserProfile, electionId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'elections', electionId), {
      status: 'cerrada',
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ELECTION_CLOSED',
      targetCollection: 'elections',
      targetId: electionId,
      summary: 'Cierre de votación interna y publicación de escrutinio.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `elections/${electionId}`);
  }
}

export async function checkHasVoted(electionId: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'elections', electionId, 'ballot_receipts', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function castSecretBallot(
  actor: UserProfile,
  electionId: string,
  optionIndex: number,
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const receiptRef = doc(db, 'elections', electionId, 'ballot_receipts', actor.uid);
    const ballotRef = doc(collection(db, 'elections', electionId, 'ballots'));

    batch.set(receiptRef, {
      votedAt: serverTimestamp(),
    });
    batch.set(ballotRef, {
      optionIndex,
      castAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `elections/${electionId}/ballots`);
  }
}

export async function fetchElectionTally(electionId: string, optionCount: number): Promise<number[]> {
  try {
    const snap = await getDocs(collection(db, 'elections', electionId, 'ballots'));
    const counts = Array.from({ length: optionCount }, () => 0);
    for (const d of snap.docs) {
      const idx = d.data().optionIndex as number;
      if (typeof idx === 'number' && idx >= 0 && idx < optionCount) {
        counts[idx] += 1;
      }
    }
    return counts;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `elections/${electionId}/ballots`);
  }
}

export async function fetchAllCommitments(): Promise<CommitmentItem[]> {
  try {
    const q = query(collection(db, 'commitments'), orderBy('dueDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<CommitmentItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'commitments');
  }
}

export async function createCommitment(
  actor: UserProfile,
  payload: {
    title: string;
    description: string;
    assigneeUid: string;
    assigneeName: string;
    dueDate: string;
    commissionId?: string;
  },
): Promise<void> {
  try {
    await addDoc(collection(db, 'commitments'), {
      title: payload.title.trim(),
      description: payload.description.trim(),
      ...(payload.commissionId ? { commissionId: payload.commissionId } : {}),
      assigneeUid: payload.assigneeUid,
      assigneeName: payload.assigneeName,
      dueDate: payload.dueDate,
      progressPercent: 0,
      status: 'pendiente',
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'commitments');
  }
}

export async function updateCommitmentProgress(
  id: string,
  progressPercent: number,
  status: CommitmentItem['status'],
): Promise<void> {
  try {
    await updateDoc(doc(db, 'commitments', id), {
      progressPercent,
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commitments/${id}`);
  }
}

export async function updateCommitmentDetails(
  id: string,
  patch: Partial<
    Pick<
      CommitmentItem,
      'title' | 'description' | 'assigneeUid' | 'assigneeName' | 'dueDate' | 'progressPercent' | 'status' | 'commissionId'
    >
  >,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'commitments', id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commitments/${id}`);
  }
}

export async function addCommitmentComment(
  actor: UserProfile,
  id: string,
  existingComments: CommitmentComment[] = [],
  text: string,
): Promise<void> {
  const clean = text.trim().slice(0, 800);
  if (!clean) return;
  const nextComment: CommitmentComment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    authorUid: actor.uid,
    authorName: actor.displayName,
    text: clean,
    createdAtIso: new Date().toISOString(),
  };
  try {
    await updateDoc(doc(db, 'commitments', id), {
      comments: [...existingComments.slice(-49), nextComment],
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commitments/${id}`);
  }
}
