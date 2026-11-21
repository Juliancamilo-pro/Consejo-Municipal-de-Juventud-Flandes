import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export interface UploadedStorageFile {
  fileId: string;
  storagePath: string;
  downloadUrl?: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
}

export async function uploadFileToFirebaseStorage(
  file: File,
  visibility: 'publico' | 'interno',
  folder = 'documents',
): Promise<UploadedStorageFile> {
  return uploadFileResumableToFirebaseStorage(file, visibility, folder);
}

export async function uploadFileResumableToFirebaseStorage(
  file: File,
  visibility: 'publico' | 'interno',
  folder = 'documents',
  onProgress?: (percent: number) => void,
): Promise<UploadedStorageFile> {
  if (!ALLOWED_MIMES.has(file.type)) {
    throw new Error(
      'Formato no permitido. Usa PDF, Word, Excel, PowerPoint, imagen (PNG, JPG, WebP) o video (MP4, WebM, MOV).',
    );
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error('El archivo debe pesar entre 1 byte y 50 MB.');
  }

  const fileId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const prefix = visibility === 'publico' ? 'public' : 'internal';
  const storagePath = `${prefix}/${folder}/${fileId}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      fileId,
      visibility,
      originalName: safeName,
    },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (err) => reject(err),
      () => resolve(),
    );
  });

  const downloadUrl = visibility === 'publico' ? await getDownloadURL(storageRef) : undefined;

  return {
    fileId,
    storagePath,
    ...(downloadUrl ? { downloadUrl } : {}),
    fileName: safeName,
    fileMime: file.type,
    fileSize: file.size,
  };
}

export async function uploadAvatarWebpToStorage(
  userUid: string,
  file: File,
): Promise<{ storagePath: string; downloadUrl: string }> {
  if (!['image/webp', 'image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('La foto de perfil debe estar en formato WebP, JPG o PNG.');
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    throw new Error('La foto de perfil no puede superar los 2 MB.');
  }

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}`;
  const storagePath = `avatars/${userUid}/${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      userUid,
    },
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return { storagePath, downloadUrl };
}

export async function getProtectedSignedUrl(
  storagePath: string,
  inline = false,
): Promise<string> {
  if (storagePath.startsWith('public/')) {
    return getDownloadURL(ref(storage, storagePath));
  }

  const res = await fetch(
    `/api/files/signed-url?path=${encodeURIComponent(storagePath)}&inline=${inline ? '1' : '0'}`,
    {
      method: 'GET',
      credentials: 'include',
    },
  );
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    if (res.status === 503) {
      return getDownloadURL(ref(storage, storagePath));
    }
    throw new Error(data.error || 'No se pudo obtener acceso seguro al documento interno.');
  }
  return data.url;
}

export async function resolveDocumentAccessUrl(
  item: {
    fileId?: string;
    storagePath?: string;
    downloadUrl?: string;
    visibility?: 'publico' | 'interno';
  },
  inline = false,
): Promise<string> {
  if (item.downloadUrl && item.visibility !== 'interno') {
    return item.downloadUrl;
  }
  if (item.storagePath) {
    return getProtectedSignedUrl(item.storagePath, inline);
  }
  if (item.downloadUrl) {
    return item.downloadUrl;
  }
  throw new Error('Este archivo no cuenta con una ruta válida en Firebase Storage.');
}

