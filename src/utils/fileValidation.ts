const SUPPORTED_MIMES = new Set([
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

function startsWithBytes(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((val, idx) => bytes[idx] === val);
}

export async function validateFileMagicBytes(file: File): Promise<void> {
  if (!SUPPORTED_MIMES.has(file.type)) {
    throw new Error(
      `Tipo no permitido (${file.type || 'desconocido'}). Usa PDF, Word, Excel, PowerPoint, PNG, JPG, WebP, MP4, WebM o MOV.`,
    );
  }
  if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
    throw new Error(`El archivo "${file.name}" debe pesar entre 1 byte y 50 MB.`);
  }

  const headBuffer = await file.slice(0, 16).arrayBuffer();
  const bytes = new Uint8Array(headBuffer);

  if (file.type === 'application/pdf') {
    if (!startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      throw new Error(`"${file.name}" no tiene encabezado real de PDF (%PDF-).`);
    }
    return;
  }

  if (file.type === 'image/png') {
    if (!startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47])) {
      throw new Error(`"${file.name}" no corresponde a una imagen PNG válida.`);
    }
    return;
  }

  if (file.type === 'image/jpeg') {
    if (!startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
      throw new Error(`"${file.name}" no corresponde a una imagen JPEG válida.`);
    }
    return;
  }

  if (file.type === 'image/webp') {
    const riff = startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]);
    const webp = bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!riff || !webp) {
      throw new Error(`"${file.name}" no corresponde a una imagen WebP válida.`);
    }
    return;
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    if (!startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) {
      throw new Error(`"${file.name}" no tiene firma Office OpenXML válida.`);
    }
    return;
  }

  if (file.type === 'video/webm') {
    if (!startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
      throw new Error(`"${file.name}" no corresponde a un video WebM válido.`);
    }
    return;
  }

  if (file.type === 'video/mp4' || file.type === 'video/quicktime') {
    const hasFtyp =
      bytes.length >= 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70;
    if (!hasFtyp) {
      throw new Error(`"${file.name}" no corresponde a un contenedor MP4/MOV válido.`);
    }
  }
}

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function compressImageBeforeUpload(file: File): Promise<{
  file: File;
  compressed: boolean;
  savedPercent: number;
}> {
  if (
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function' ||
    (file.type !== 'image/jpeg' && file.type !== 'image/png') ||
    file.size < 350 * 1024
  ) {
    return { file, compressed: false, savedPercent: 0 };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1920;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return { file, compressed: false, savedPercent: 0 };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((res) => resolve(res), 'image/webp', 0.84),
    );
    if (!blob || blob.size >= file.size) {
      return { file, compressed: false, savedPercent: 0 };
    }
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const optimized = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
    const savedPercent = Math.max(1, Math.round(((file.size - optimized.size) / file.size) * 100));
    return { file: optimized, compressed: true, savedPercent };
  } catch {
    return { file, compressed: false, savedPercent: 0 };
  }
}
