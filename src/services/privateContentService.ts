import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import {
  AuditLogEntry,
  CalendarEventItem,
  NewsItem,
  ProjectItem,
  UserProfile,
} from '../types/models';

export { fetchAllCommissions, saveCommission } from './commissionsService';

export async function fetchAllNews(): Promise<NewsItem[]> {
  try {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<NewsItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'news');
  }
}

export async function saveNewsItem(
  actor: UserProfile,
  payload: {
    id?: string;
    title: string;
    type: 'noticia' | 'comunicado' | 'galeria';
    summary: string;
    content: string;
    imageUrl?: string;
    tags?: string[];
    seoTitle?: string;
    seoDescription?: string;
    status: 'borrador' | 'publicada' | 'archivada';
    scheduledPublishAt?: string;
  },
): Promise<void> {
  try {
    const cleanTags = (payload.tags || [])
      .map((t) => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 8);
    const baseFields = {
      title: payload.title.trim(),
      type: payload.type,
      summary: payload.summary.trim(),
      content: payload.content.trim(),
      ...(payload.imageUrl?.trim() ? { imageUrl: payload.imageUrl.trim() } : {}),
      ...(cleanTags.length > 0 ? { tags: cleanTags } : {}),
      ...(payload.seoTitle?.trim() ? { seoTitle: payload.seoTitle.trim().slice(0, 120) } : {}),
      ...(payload.seoDescription?.trim()
        ? { seoDescription: payload.seoDescription.trim().slice(0, 200) }
        : {}),
      ...(payload.scheduledPublishAt?.trim()
        ? { scheduledPublishAt: payload.scheduledPublishAt.trim() }
        : {}),
      status: payload.status,
      updatedAt: serverTimestamp(),
    };

    if (payload.id) {
      await updateDoc(doc(db, 'news', payload.id), baseFields);
    } else {
      await addDoc(collection(db, 'news'), {
        ...baseFields,
        authorUid: actor.uid,
        authorName: actor.displayName,
        createdAt: serverTimestamp(),
      });
    }

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `NEWS_${payload.status.toUpperCase()}`,
      targetCollection: 'news',
      targetId: payload.id,
      summary: `${payload.type} "${payload.title.trim()}" en estado ${payload.status}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'news');
  }
}

export async function deleteNewsItem(actor: UserProfile, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'news', id));
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'NEWS_DELETED',
      targetCollection: 'news',
      targetId: id,
      summary: 'Eliminación de publicación.',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `news/${id}`);
  }
}

export async function fetchAllProjects(): Promise<ProjectItem[]> {
  try {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<ProjectItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'projects');
  }
}

export async function saveProjectItem(
  actor: UserProfile,
  payload: {
    id?: string;
    title: string;
    summary: string;
    objective: string;
    commissionId?: string;
    status: 'borrador' | 'publicada' | 'archivada';
    progressPercent: number;
  },
): Promise<void> {
  try {
    if (payload.id) {
      await updateDoc(doc(db, 'projects', payload.id), {
        title: payload.title.trim(),
        summary: payload.summary.trim(),
        objective: payload.objective.trim(),
        ...(payload.commissionId ? { commissionId: payload.commissionId } : {}),
        status: payload.status,
        progressPercent: payload.progressPercent,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, 'projects'), {
        title: payload.title.trim(),
        summary: payload.summary.trim(),
        objective: payload.objective.trim(),
        ...(payload.commissionId ? { commissionId: payload.commissionId } : {}),
        status: payload.status,
        progressPercent: payload.progressPercent,
        authorUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `PROJECT_${payload.status.toUpperCase()}`,
      targetCollection: 'projects',
      targetId: payload.id,
      summary: `Proyecto "${payload.title.trim()}" (${payload.progressPercent}%).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'projects');
  }
}

export async function fetchAllCalendarEvents(): Promise<CalendarEventItem[]> {
  try {
    const q = query(collection(db, 'calendar_events'), orderBy('startIso', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<CalendarEventItem, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'calendar_events');
  }
}

export async function createCalendarEvent(
  actor: UserProfile,
  payload: {
    title: string;
    description?: string;
    eventType: 'sesion' | 'reunion' | 'actividad';
    startIso: string;
    endIso: string;
    location: string;
    visibility: 'publico' | 'interno';
    reminderNote?: string;
  },
): Promise<void> {
  try {
    await addDoc(collection(db, 'calendar_events'), {
      title: payload.title.trim(),
      ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
      eventType: payload.eventType,
      startIso: payload.startIso,
      endIso: payload.endIso,
      location: payload.location.trim(),
      visibility: payload.visibility,
      ...(payload.reminderNote?.trim() ? { reminderNote: payload.reminderNote.trim() } : {}),
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CALENDAR_EVENT_CREATED',
      targetCollection: 'calendar_events',
      summary: `Evento "${payload.title.trim()}" (${payload.visibility}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'calendar_events');
  }
}

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<AuditLogEntry, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
  }
}
