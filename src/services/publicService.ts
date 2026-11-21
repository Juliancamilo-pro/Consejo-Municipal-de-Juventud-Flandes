import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  CalendarEventItem,
  Commission,
  CouncilInfo,
  InstitutionalDocument,
  MailboxTrackingPublic,
  NewsItem,
  PlenarySession,
  ProjectItem,
  PublicDirectoryMember,
} from '../types/models';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export async function fetchCouncilInfo(): Promise<CouncilInfo | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'council_info'));
    if (!snap.exists()) return null;
    return snap.data() as CouncilInfo;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/council_info');
  }
}

export async function fetchPublicDirectory(): Promise<PublicDirectoryMember[]> {
  try {
    const q = query(
      collection(db, 'public_directory'),
      where('status', '==', 'activo'),
      orderBy('displayName', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as PublicDirectoryMember), uid: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'public_directory');
  }
}

export async function fetchPublicCommissions(): Promise<Commission[]> {
  try {
    const q = query(
      collection(db, 'commissions'),
      where('status', '==', 'activa'),
      orderBy('name', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<Commission, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'commissions');
  }
}

export async function fetchPublishedNews(): Promise<NewsItem[]> {
  try {
    const q = query(
      collection(db, 'news'),
      where('status', '==', 'publicada'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<NewsItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'news');
  }
}

export async function fetchPublishedProjects(): Promise<ProjectItem[]> {
  try {
    const q = query(
      collection(db, 'projects'),
      where('status', '==', 'publicada'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<ProjectItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'projects');
  }
}

export async function fetchPublicSessions(): Promise<PlenarySession[]> {
  try {
    const q = query(
      collection(db, 'sessions'),
      where('visibility', '==', 'publico'),
      where('status', 'in', ['programada', 'realizada', 'cancelada']),
      orderBy('dateIso', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<PlenarySession, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sessions');
  }
}

export async function fetchPublicDocuments(): Promise<InstitutionalDocument[]> {
  try {
    const q = query(
      collection(db, 'documents'),
      where('visibility', '==', 'publico'),
      where('status', '==', 'publicada'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Omit<InstitutionalDocument, 'id'>),
      id: d.id,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'documents');
  }
}

export async function fetchPublicCalendarEvents(): Promise<CalendarEventItem[]> {
  try {
    const q = query(
      collection(db, 'calendar_events'),
      where('visibility', '==', 'publico'),
      orderBy('startIso', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<CalendarEventItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'calendar_events');
  }
}

export async function persistValidatedMailboxEntry(payload: {
  trackingCode: string;
  category: 'propuesta' | 'inquietud' | 'denuncia' | 'pqrsd';
  isAnonymous: boolean;
  senderName?: string;
  senderEmail?: string;
  senderNeighborhood?: string;
  subject: string;
  message: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    const entryRef = doc(collection(db, 'mailbox'));
    const trackingRef = doc(db, 'mailbox_tracking', payload.trackingCode);

    batch.set(entryRef, {
      trackingCode: payload.trackingCode,
      category: payload.category,
      isAnonymous: payload.isAnonymous,
      ...(payload.senderName ? { senderName: payload.senderName } : {}),
      ...(payload.senderEmail ? { senderEmail: payload.senderEmail } : {}),
      ...(payload.senderNeighborhood ? { senderNeighborhood: payload.senderNeighborhood } : {}),
      subject: payload.subject,
      message: payload.message,
      status: 'radicado',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(trackingRef, {
      trackingCode: payload.trackingCode,
      category: payload.category,
      status: 'radicado',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `mailbox_tracking/${payload.trackingCode}`);
  }
}

export async function lookupMailboxByCode(
  trackingCode: string,
): Promise<MailboxTrackingPublic | null> {
  const normalized = trackingCode.trim().toUpperCase();
  if (!/^PJ-FLA-[0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
    return null;
  }
  try {
    const snap = await getDoc(doc(db, 'mailbox_tracking', normalized));
    if (!snap.exists()) return null;
    return snap.data() as MailboxTrackingPublic;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `mailbox_tracking/${normalized}`);
  }
}
