import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { UserProfile } from '../types/models';
import { PollQuestion, PublicPoll } from '../types/participation';
import { recordAuditLog } from './auditService';
import { db } from './firebase';

function getBrowserDeviceToken(): string {
  if (typeof window === 'undefined') return 'ssr';
  const key = 'cmj_flandes_voter_token';
  try {
    let token = window.localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      window.localStorage.setItem(key, token);
    }
    return token;
  } catch {
    return 'mem-device';
  }
}

export async function fetchPublishedPolls(): Promise<PublicPoll[]> {
  const q = query(
    collection(db, 'public_polls'),
    where('status', 'in', ['abierta', 'cerrada']),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicPoll, 'id'>) }));
}

export async function fetchAllPolls(): Promise<PublicPoll[]> {
  const snap = await getDocs(query(collection(db, 'public_polls'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicPoll, 'id'>) }));
}

export interface CreatePollInput {
  title: string;
  description: string;
  options: string[];
  questions?: PollQuestion[];
  audience?: 'publica' | 'consejeros';
  anonymity?: 'anonima' | 'identificada';
  opensAt?: string;
  closesAt?: string;
  thankYouMessage?: string;
  status?: 'borrador' | 'abierta';
}

export async function createPublicPoll(actor: UserProfile, input: CreatePollInput): Promise<string> {
  const fallbackOptions =
    input.questions && input.questions.length > 0 && input.questions[0].options.length >= 2
      ? input.questions[0].options
      : input.options
          .map((label, idx) => ({ id: `opt_${idx + 1}`, label: label.trim(), votes: 0 }))
          .filter((o) => o.label.length > 0);

  const safeOptions =
    fallbackOptions.length >= 2
      ? fallbackOptions
      : [
          { id: 'opt_1', label: 'De acuerdo', votes: 0 },
          { id: 'opt_2', label: 'En desacuerdo', votes: 0 },
        ];

  const ref = await addDoc(collection(db, 'public_polls'), {
    title: input.title.trim(),
    description: input.description.trim(),
    options: safeOptions,
    ...(input.questions?.length ? { questions: input.questions } : {}),
    audience: input.audience || 'publica',
    anonymity: input.anonymity || 'anonima',
    ...(input.opensAt?.trim() ? { opensAt: input.opensAt.trim() } : {}),
    closesAt: input.closesAt?.trim() || '',
    ...(input.thankYouMessage?.trim() ? { thankYouMessage: input.thankYouMessage.trim() } : {}),
    responseCount: 0,
    status: input.status || 'abierta',
    createdByUid: actor.uid,
    createdByName: actor.displayName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await recordAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'POLL_CREATE',
    targetCollection: 'public_polls',
    targetId: ref.id,
    summary: `Encuesta creada: ${input.title}`,
  });
  return ref.id;
}

export async function duplicatePublicPoll(actor: UserProfile, source: PublicPoll): Promise<string> {
  const resetQuestions = source.questions?.map((q) => ({
    ...q,
    options: q.options.map((o) => ({ ...o, votes: 0 })),
    textResponses: [],
  }));
  return createPublicPoll(actor, {
    title: `${source.title} (Copia)`.slice(0, 180),
    description: source.description,
    options: source.options.map((o) => o.label),
    questions: resetQuestions,
    audience: source.audience,
    anonymity: source.anonymity,
    thankYouMessage: source.thankYouMessage,
    status: 'borrador',
  });
}

export async function updatePollStatus(
  actor: UserProfile,
  pollId: string,
  status: PublicPoll['status'],
): Promise<void> {
  await updateDoc(doc(db, 'public_polls', pollId), { status, updatedAt: serverTimestamp() });
  await recordAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'POLL_STATUS',
    targetCollection: 'public_polls',
    targetId: pollId,
    summary: `Encuesta ${status}`,
  });
}

export async function submitCitizenPollResponse(
  pollId: string,
  answers: Record<string, string | string[]>,
  honeypot = '',
): Promise<{ voterFingerprint: string }> {
  const deviceToken = getBrowserDeviceToken();
  const res = await fetch('/api/public/polls/submit-vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ pollId, answers, deviceToken, honeypot }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    serverPersisted?: boolean;
    voterFingerprint?: string;
    sanitizedAnswers?: Record<string, string | string[]>;
  };
  if (!res.ok || !data.voterFingerprint) {
    throw new Error(data.error || 'No se pudo validar tu participación.');
  }

  if (data.serverPersisted) {
    return { voterFingerprint: data.voterFingerprint };
  }

  const sanitized = data.sanitizedAnswers || answers;
  const pollRef = doc(db, 'public_polls', pollId);
  const voteReceiptRef = doc(db, 'public_polls', pollId, 'votes', data.voterFingerprint);

  await runTransaction(db, async (tx) => {
    const [pollSnap, voteSnap] = await Promise.all([tx.get(pollRef), tx.get(voteReceiptRef)]);
    if (!pollSnap.exists()) throw new Error('La encuesta ya no está disponible.');
    const pollData = pollSnap.data() as PublicPoll;
    if (pollData.status !== 'abierta') {
      throw new Error('Esta encuesta ya fue cerrada.');
    }
    if (voteSnap.exists()) {
      throw new Error('Ya se registró una participación desde este dispositivo/red.');
    }

    if (pollData.questions && pollData.questions.length > 0) {
      const nextQuestions = pollData.questions.map((q) => {
        const ans = sanitized[q.id];
        if (q.type === 'short_text') {
          const text = typeof ans === 'string' ? ans.trim() : '';
          const prev = q.textResponses || [];
          return text ? { ...q, textResponses: [...prev, text].slice(-200) } : q;
        }
        const selected = new Set(Array.isArray(ans) ? ans : ans ? [ans] : []);
        return {
          ...q,
          options: q.options.map((opt) =>
            selected.has(opt.id) ? { ...opt, votes: (opt.votes || 0) + 1 } : opt,
          ),
        };
      });
      tx.set(voteReceiptRef, { optionId: 'multi', createdAt: serverTimestamp() });
      tx.update(pollRef, {
        questions: nextQuestions,
        options: nextQuestions[0].options.length >= 2 ? nextQuestions[0].options : pollData.options,
        responseCount: (pollData.responseCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      const first = Object.values(sanitized)[0];
      const optionId = Array.isArray(first) ? first[0] : first;
      const updatedOptions = pollData.options.map((opt) =>
        opt.id === optionId ? { ...opt, votes: (opt.votes || 0) + 1 } : opt,
      );
      tx.set(voteReceiptRef, { optionId: optionId || 'opt', createdAt: serverTimestamp() });
      tx.update(pollRef, {
        options: updatedOptions,
        responseCount: (pollData.responseCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return { voterFingerprint: data.voterFingerprint };
}

export async function submitCitizenPollVote(
  pollId: string,
  optionId: string,
  honeypot = '',
): Promise<void> {
  await submitCitizenPollResponse(pollId, { q_main: optionId }, honeypot);
}

export {
  createPublicCall,
  fetchAllCalls,
  fetchCallRegistrations,
  fetchPublishedCalls,
  submitPublicCallRegistration,
  updateCallStatus,
} from './participationCallsService';
