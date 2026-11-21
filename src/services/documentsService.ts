import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  DocumentCategory,
  DocumentStatus,
  DocumentVersion,
  InstitutionalDocument,
  UserProfile,
} from '../types/models';
import { formatConsecutiveNumber } from '../utils/documentUtils';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { createInternalNotification } from './notificationsService';
import { getMemoryCsrfToken } from './sessionApi';

export async function fetchAllDocuments(): Promise<InstitutionalDocument[]> {
  try {
    const q = query(collection(db, 'documents'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<InstitutionalDocument, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'documents');
  }
}

export async function fetchDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  try {
    const q = query(collection(db, 'documents', documentId, 'versions'), orderBy('versionNumber', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<DocumentVersion, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `documents/${documentId}/versions`);
  }
}

export async function reserveConsecutiveDocumentNumber(
  category: DocumentCategory,
  year: number,
): Promise<string> {
  try {
    const res = await fetch('/api/documents/next-number', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getMemoryCsrfToken(),
      },
      credentials: 'include',
      body: JSON.stringify({ category, year }),
    });
    const data = (await res.json()) as {
      consecutiveNumber?: string;
      fallbackClientTransaction?: boolean;
      error?: string;
    };
    if (res.ok && data.consecutiveNumber) {
      return data.consecutiveNumber;
    }
    if (!data.fallbackClientTransaction && res.status !== 503) {
      throw new Error(data.error || 'No se pudo generar el consecutivo documental.');
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch')) {
      // Continúa a transacción atómica en Firestore si el endpoint respondió 503
    }
  }

  const counterRef = doc(db, 'document_counters', `${category}_${year}`);
  const nextSeq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? Number(snap.data()?.seq || 0) : 0;
    const next = current + 1;
    tx.set(counterRef, {
      category,
      year,
      seq: next,
      updatedAt: serverTimestamp(),
    });
    return next;
  });

  return formatConsecutiveNumber(category, nextSeq, year);
}

export async function createDocumentWithVersion(
  actor: UserProfile,
  payload: {
    title: string;
    category: DocumentCategory;
    description?: string;
    tags?: string[];
    consecutiveNumber?: string;
    year?: number;
    commissionId?: string;
    sessionId?: string;
    projectId?: string;
    status: DocumentStatus;
    visibility: 'publico' | 'interno';
    fileId: string;
    storagePath?: string;
    downloadUrl?: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    contentSha256?: string;
  },
): Promise<string> {
  try {
    const docRef = doc(collection(db, 'documents'));
    const verRef = doc(collection(db, 'documents', docRef.id, 'versions'));
    const batch = writeBatch(db);

    batch.set(docRef, {
      title: payload.title.trim(),
      category: payload.category,
      ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
      ...(payload.tags?.length ? { tags: payload.tags.slice(0, 10) } : {}),
      ...(payload.consecutiveNumber?.trim()
        ? { consecutiveNumber: payload.consecutiveNumber.trim() }
        : {}),
      year: payload.year || new Date().getFullYear(),
      ...(payload.commissionId ? { commissionId: payload.commissionId } : {}),
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
      ...(payload.projectId ? { projectId: payload.projectId } : {}),
      downloadCount: 0,
      status: payload.status,
      visibility: payload.visibility,
      currentVersion: 1,
      fileId: payload.fileId,
      ...(payload.storagePath ? { storagePath: payload.storagePath } : {}),
      ...(payload.downloadUrl ? { downloadUrl: payload.downloadUrl } : {}),
      fileName: payload.fileName,
      fileMime: payload.fileMime,
      fileSize: payload.fileSize,
      ...(payload.contentSha256 ? { contentSha256: payload.contentSha256 } : {}),
      authorUid: actor.uid,
      authorName: actor.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(verRef, {
      versionNumber: 1,
      fileId: payload.fileId,
      ...(payload.storagePath ? { storagePath: payload.storagePath } : {}),
      ...(payload.downloadUrl ? { downloadUrl: payload.downloadUrl } : {}),
      fileName: payload.fileName,
      fileMime: payload.fileMime,
      fileSize: payload.fileSize,
      ...(payload.contentSha256 ? { contentSha256: payload.contentSha256 } : {}),
      changelog: 'Carga inicial del documento.',
      uploadedByUid: actor.uid,
      uploadedByName: actor.displayName,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DOCUMENT_CREATED',
      targetCollection: 'documents',
      targetId: docRef.id,
      summary: `Documento "${payload.title.trim()}" (${payload.category}, ${payload.visibility}, ${payload.status}).`,
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'documents');
  }
}

export async function addDocumentNewVersion(
  actor: UserProfile,
  docItem: InstitutionalDocument,
  fileMeta: {
    fileId: string;
    storagePath?: string;
    downloadUrl?: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    changelog: string;
    nextStatus: DocumentStatus;
    nextVisibility: 'publico' | 'interno';
  },
): Promise<void> {
  const nextVersion = docItem.currentVersion + 1;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'documents', docItem.id), {
      currentVersion: nextVersion,
      fileId: fileMeta.fileId,
      ...(fileMeta.storagePath ? { storagePath: fileMeta.storagePath } : {}),
      ...(fileMeta.downloadUrl ? { downloadUrl: fileMeta.downloadUrl } : {}),
      fileName: fileMeta.fileName,
      fileMime: fileMeta.fileMime,
      fileSize: fileMeta.fileSize,
      status: fileMeta.nextStatus,
      visibility: fileMeta.nextVisibility,
      updatedAt: serverTimestamp(),
    });

    const verRef = doc(collection(db, 'documents', docItem.id, 'versions'));
    batch.set(verRef, {
      versionNumber: nextVersion,
      fileId: fileMeta.fileId,
      ...(fileMeta.storagePath ? { storagePath: fileMeta.storagePath } : {}),
      ...(fileMeta.downloadUrl ? { downloadUrl: fileMeta.downloadUrl } : {}),
      fileName: fileMeta.fileName,
      fileMime: fileMeta.fileMime,
      fileSize: fileMeta.fileSize,
      changelog: fileMeta.changelog.trim() || `Actualización versión ${nextVersion}`,
      uploadedByUid: actor.uid,
      uploadedByName: actor.displayName,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DOCUMENT_VERSION_ADDED',
      targetCollection: 'documents',
      targetId: docItem.id,
      summary: `Nueva versión v${nextVersion} para "${docItem.title}".`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `documents/${docItem.id}`);
  }
}

export async function updateDocumentWorkflow(
  actor: UserProfile,
  docTarget: string | InstitutionalDocument,
  nextStatus: DocumentStatus,
  nextVisibility: 'publico' | 'interno',
  reviewComment?: string,
): Promise<void> {
  const docId = typeof docTarget === 'string' ? docTarget : docTarget.id;
  const docTitle = typeof docTarget === 'string' ? docId : docTarget.title;

  try {
    const patch: Record<string, unknown> = {
      status: nextStatus,
      visibility: nextVisibility,
      updatedAt: serverTimestamp(),
    };

    if (reviewComment?.trim()) {
      patch.reviewComment = reviewComment.trim().slice(0, 1000);
    }
    if (nextStatus === 'aprobada' || nextStatus === 'borrador') {
      patch.reviewedByUid = actor.uid;
      patch.reviewedByName = actor.displayName;
    }
    if (nextStatus === 'publicada') {
      patch.publishedByUid = actor.uid;
    }
    if (nextStatus === 'archivada') {
      patch.archivedByUid = actor.uid;
    }

    await updateDoc(doc(db, 'documents', docId), patch);

    if (nextStatus === 'aprobada' || nextStatus === 'publicada' || (nextStatus === 'borrador' && reviewComment?.trim())) {
      await createInternalNotification(actor, {
        title: `Documento actualizado: ${docTitle}`,
        body: `Estado cambiado a ${nextStatus} por ${actor.displayName}.${reviewComment?.trim() ? ` Observación: ${reviewComment.trim()}` : ''}`,
        category: 'aviso',
      }).catch(() => undefined);
    }

    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: `DOCUMENT_STATUS_${nextStatus.toUpperCase()}`,
      targetCollection: 'documents',
      targetId: docId,
      summary: `Documento "${docTitle}" a estado ${nextStatus} (${nextVisibility}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `documents/${docId}`);
  }
}
