import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { DocumentComment, UserProfile } from '../types/models';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export async function fetchDocumentComments(documentId: string): Promise<DocumentComment[]> {
  try {
    const q = query(
      collection(db, 'documents', documentId, 'comments'),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Omit<DocumentComment, 'id'>),
      id: d.id,
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `documents/${documentId}/comments`);
  }
}

export async function addDocumentComment(
  actor: UserProfile,
  documentId: string,
  comment: string,
  actionType: 'comentario' | 'aprobacion' | 'devolucion' = 'comentario',
): Promise<void> {
  try {
    await addDoc(collection(db, 'documents', documentId, 'comments'), {
      documentId,
      authorUid: actor.uid,
      authorName: actor.displayName,
      authorRole: actor.role,
      comment: comment.trim().slice(0, 1200),
      actionType,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `documents/${documentId}/comments`);
  }
}

export async function incrementDocumentDownloadCount(documentId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'documents', documentId), {
      downloadCount: increment(1),
    });
  } catch {
    // El conteo de descargas nunca debe bloquear la apertura o descarga del documento
  }
}
