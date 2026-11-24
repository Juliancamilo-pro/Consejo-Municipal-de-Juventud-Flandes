import heic2any from 'heic2any';

export type ImageUsePreset = 'profile' | 'cover' | 'gallery' | 'logo';

export interface CropTransform {
  zoom: number;
  offsetX: number; // -1 to 1 normalized pan
  offsetY: number; // -1 to 1 normalized pan
  autoEnhance?: boolean;
}

export interface ProfileVariantBlob {
  blob: Blob;
  mimeType: string;
  fileName: string;
  width: number;
  height: number;
  previewUrl: string;
}

export interface ProcessedMediaResult {
  blob: Blob;
  previewUrl: string;
  thumbnailBlob?: Blob;
  thumbnailPreviewUrl?: string;
  profileThumb?: ProfileVariantBlob;
  profileMedium?: ProfileVariantBlob;
  mimeType: string;
  fileName: string;
  width?: number;
  height?: number;
  faceDetected?: boolean;
}

export type MediaCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'zip'
  | 'text'
  | 'other';

const DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'vbs',
  'vbe',
  'js',
  'mjs',
  'cjs',
  'jse',
  'msi',
  'msp',
  'scr',
  'com',
  'pif',
  'dll',
  'sys',
  'drv',
  'jar',
  'war',
  'php',
  'phtml',
  'asp',
  'aspx',
  'jsp',
  'cgi',
  'pl',
  'py',
  'rb',
  'html',
  'htm',
  'xhtml',
  'hta',
  'cpl',
  'lnk',
  'reg',
]);

export function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().trim().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function isDangerousFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  if (DANGEROUS_EXTENSIONS.has(ext)) return true;
  const mime = (file.type || '').toLowerCase();
  if (
    mime === 'application/x-msdownload' ||
    mime === 'application/x-executable' ||
    mime === 'application/x-sh' ||
    mime === 'text/javascript' ||
    mime === 'application/javascript' ||
    mime === 'text/html'
  ) {
    return true;
  }
  return false;
}

/** Inspect leading magic bytes in browser before enqueueing */
export async function validateFileMagicBytes(file: File): Promise<{ valid: boolean; reason?: string }> {
  if (isDangerousFile(file)) {
    return {
      valid: false,
      reason: `Por seguridad institucional no se permiten archivos ejecutables o scripts (${file.name}).`,
    };
  }
  try {
    const headerBuf = await file.slice(0, 64).arrayBuffer();
    const bytes = new Uint8Array(headerBuf);
    // Block MZ (PE/EXE/DLL), ELF, Mach-O, Shebang #!
    if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
      return { valid: false, reason: 'El archivo contiene firma de ejecutable Windows (MZ).' };
    }
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x7f &&
      bytes[1] === 0x45 &&
      bytes[2] === 0x4c &&
      bytes[3] === 0x46
    ) {
      return { valid: false, reason: 'El archivo contiene firma de binario ejecutable (ELF).' };
    }
    if (bytes.length >= 2 && bytes[0] === 0x23 && bytes[1] === 0x21) {
      return { valid: false, reason: 'No se permiten scripts con cabecera shebang (#!).' };
    }
    // Check leading text for HTML/script injection disguised as non-HTML
    const snippet = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim().toLowerCase();
    if (snippet.startsWith('<!doctype html') || snippet.startsWith('<html') || snippet.startsWith('<script')) {
      return { valid: false, reason: 'No se permiten documentos HTML ni scripts embebidos.' };
    }
  } catch {
    // Allow if slice read fails cleanly
  }
  return { valid: true };
}

export function classifyFile(file: File): MediaCategory {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (
    type.startsWith('image/') ||
    /\.(heic|heif|webp|png|jpg|jpeg|gif|svg|bmp|tiff|tif|ico|avif|dng|raw|cr2|nef|arw)$/i.test(name)
  ) {
    return 'image';
  }
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv|ogv)$/i.test(name)) {
    return 'video';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(name)) {
    return 'audio';
  }
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    type.includes('wordprocessingml') ||
    type === 'application/msword' ||
    /\.(doc|docx|odt|rtf)$/i.test(name)
  ) {
    return 'word';
  }
  if (
    type.includes('spreadsheetml') ||
    type === 'application/vnd.ms-excel' ||
    /\.(xls|xlsx|csv|ods)$/i.test(name)
  ) {
    return 'excel';
  }
  if (
    type.includes('presentationml') ||
    type === 'application/vnd.ms-powerpoint' ||
    /\.(ppt|pptx|odp)$/i.test(name)
  ) {
    return 'powerpoint';
  }
  if (
    type.includes('zip') ||
    type.includes('compressed') ||
    type.includes('rar') ||
    type.includes('7z') ||
    /\.(zip|rar|7z|tar|gz)$/i.test(name)
  ) {
    return 'zip';
  }
  if (type.startsWith('text/') || /\.(txt|md|markdown|json|log)$/i.test(name)) {
    return 'text';
  }
  return 'other';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

// Reads EXIF orientation tag (1-8) from JPEG ArrayBuffer
async function readExifOrientation(blob: Blob): Promise<number> {
  try {
    const buffer = await blob.slice(0, 65536).arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1;

    let offset = 2;
    while (offset < view.byteLength) {
      if (offset + 4 > view.byteLength) break;
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        if (offset + 8 > view.byteLength) break;
        if (view.getUint32(offset + 2, false) !== 0x45786966) return 1;
        const tiffOffset = offset + 8;
        const little = view.getUint16(tiffOffset, false) === 0x4949;
        const firstIfd = view.getUint32(tiffOffset + 4, little);
        const dirStart = tiffOffset + firstIfd;
        if (dirStart + 2 > view.byteLength) break;
        const entries = view.getUint16(dirStart, little);
        for (let i = 0; i < entries; i++) {
          const entryOffset = dirStart + 2 + i * 12;
          if (entryOffset + 12 > view.byteLength) break;
          if (view.getUint16(entryOffset, little) === 0x0112) {
            return view.getUint16(entryOffset + 8, little);
          }
        }
        break;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else {
        offset += view.getUint16(offset, false);
      }
    }
  } catch {
    return 1;
  }
  return 1;
}

async function normalizeHeicIfNeeded(file: File): Promise<Blob> {
  const lower = file.name.toLowerCase();
  if (
    lower.endsWith('.heic') ||
    lower.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  ) {
    const converted = await heic2any({
      blob: file,
      toType: 'image/png',
      quality: 0.92,
    });
    return Array.isArray(converted) ? converted[0] : converted;
  }
  return file;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

// Returns an EXIF-oriented canvas
export async function getOrientedCanvas(file: File): Promise<HTMLCanvasElement> {
  const rawBlob = await normalizeHeicIfNeeded(file);
  const orientation = await readExifOrientation(rawBlob);
  const img = await loadImageFromBlob(rawBlob);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el procesador gráfico.');

  const swap = orientation >= 5 && orientation <= 8;
  canvas.width = swap ? img.naturalHeight : img.naturalWidth;
  canvas.height = swap ? img.naturalWidth : img.naturalHeight;

  ctx.save();
  switch (orientation) {
    case 2:
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -canvas.width);
      break;
    case 7:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(canvas.height, -canvas.width);
      ctx.scale(-1, 1);
      break;
    case 8:
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-canvas.height, 0);
      break;
    default:
      break;
  }
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  return canvas;
}

interface DetectedFaceBox {
  boundingBox: DOMRectReadOnly;
}
interface BrowserFaceDetector {
  detect(image: ImageBitmapSource): Promise<DetectedFaceBox[]>;
}
interface WindowWithFaceDetector extends Window {
  FaceDetector?: new (opts?: { maxDetectedFaces?: number; fastMode?: boolean }) => BrowserFaceDetector;
}

/**
 * Detecta la cara en el canvas si el navegador soporta FaceDetector API.
 * Si no está disponible o no hay rostro claro, retorna un encuadre superior-centrado ideal para retratos.
 */
export async function detectFaceCropCenter(
  source: HTMLCanvasElement
): Promise<{ crop: CropTransform; faceDetected: boolean }> {
  const sw = source.width || 1;
  const sh = source.height || 1;
  const fallbackOffsetY = sh > sw ? -0.24 : -0.1;

  try {
    const DetectorCtor = (window as WindowWithFaceDetector).FaceDetector;
    if (!DetectorCtor) {
      return {
        crop: { zoom: 1, offsetX: 0, offsetY: fallbackOffsetY },
        faceDetected: false,
      };
    }
    const detector = new DetectorCtor({ maxDetectedFaces: 1, fastMode: true });
    const faces = await detector.detect(source);
    if (!faces || faces.length === 0) {
      return {
        crop: { zoom: 1, offsetX: 0, offsetY: fallbackOffsetY },
        faceDetected: false,
      };
    }

    const box = faces[0].boundingBox;
    const faceCx = box.x + box.width / 2;
    const faceCy = box.y + box.height / 2;
    const minDim = Math.min(sw, sh);
    const faceRatio = Math.max(box.width, box.height) / Math.max(1, minDim);
    // Zoom suave si el rostro ocupa menos del 38% del encuadre base
    const desiredZoom = faceRatio < 0.32 ? Math.min(1.65, Math.max(1.1, 0.42 / Math.max(0.15, faceRatio))) : 1.05;

    const baseSquare = minDim / desiredZoom;
    const maxOffsetX = Math.max(1, (sw - baseSquare) / 2);
    const maxOffsetY = Math.max(1, (sh - baseSquare) / 2);

    const normX = Math.max(-1, Math.min(1, (faceCx - sw / 2) / maxOffsetX));
    const normY = Math.max(-1, Math.min(1, (faceCy - sh / 2) / maxOffsetY));

    return {
      crop: {
        zoom: Number(desiredZoom.toFixed(2)),
        offsetX: Number(normX.toFixed(3)),
        offsetY: Number(normY.toFixed(3)),
      },
      faceDetected: true,
    };
  } catch {
    return {
      crop: { zoom: 1, offsetX: 0, offsetY: fallbackOffsetY },
      faceDetected: false,
    };
  }
}

export async function autoDetectProfileCropForFile(
  file: File
): Promise<{ crop: CropTransform; faceDetected: boolean; previewDataUrl: string }> {
  const oriented = await getOrientedCanvas(file);
  const detected = await detectFaceCropCenter(oriented);
  return {
    ...detected,
    previewDataUrl: oriented.toDataURL('image/jpeg', 0.85),
  };
}

/** Aplica mejora sutil de brillo, contraste, saturación y nitidez sin distorsionar colores */
function applySubtleEnhancement(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  if (w < 4 || h < 4) return;

  // Paso 1: leve ajuste tonal (brillo +4%, contraste +7%, saturación +6%)
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const tCtx = temp.getContext('2d');
  if (!tCtx) return;
  tCtx.filter = 'brightness(1.04) contrast(1.07) saturate(1.06)';
  tCtx.drawImage(canvas, 0, 0);
  tCtx.filter = 'none';

  // Paso 2: nitidez suave (unsharp kernel 3x3 peso bajo = 0.18)
  const srcData = tCtx.getImageData(0, 0, w, h);
  const dstData = ctx.createImageData(w, h);
  const src = srcData.data;
  const dst = dstData.data;
  const amount = 0.18;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        dst[idx] = src[idx];
        dst[idx + 1] = src[idx + 1];
        dst[idx + 2] = src[idx + 2];
        dst[idx + 3] = src[idx + 3];
        continue;
      }
      const up = ((y - 1) * w + x) * 4;
      const dn = ((y + 1) * w + x) * 4;
      const lf = (y * w + (x - 1)) * 4;
      const rt = (y * w + (x + 1)) * 4;
      for (let c = 0; c < 3; c++) {
        const center = src[idx + c];
        const blur = (src[up + c] + src[dn + c] + src[lf + c] + src[rt + c]) * 0.25;
        const sharpened = center + (center - blur) * (1 + amount * 3);
        dst[idx + c] = Math.max(0, Math.min(255, Math.round(sharpened)));
      }
      dst[idx + 3] = src[idx + 3];
    }
  }
  ctx.putImageData(dstData, 0, 0);
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error al comprimir la imagen.'));
      },
      mimeType,
      quality
    );
  });
}

async function encodeCanvasWithFallback(
  canvas: HTMLCanvasElement,
  quality: number,
  preferPngFallback = false
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  try {
    const webpBlob = await canvasToBlob(canvas, 'image/webp', quality);
    if (webpBlob.type === 'image/webp') {
      return { blob: webpBlob, mimeType: 'image/webp', ext: 'webp' };
    }
  } catch {
    // Fallback below for browsers without WebP canvas encoding (e.g. older Safari/iOS)
  }

  if (preferPngFallback) {
    const pngBlob = await canvasToBlob(canvas, 'image/png', 0.92);
    return { blob: pngBlob, mimeType: 'image/png', ext: 'png' };
  }

  try {
    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', Math.min(0.92, quality + 0.04));
    if (jpegBlob.type === 'image/jpeg') {
      return { blob: jpegBlob, mimeType: 'image/jpeg', ext: 'jpg' };
    }
  } catch {
    // Final PNG fallback
  }

  const pngBlob = await canvasToBlob(canvas, 'image/png', 0.92);
  return { blob: pngBlob, mimeType: 'image/png', ext: 'png' };
}

function renderCroppedCanvas(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  preset: ImageUsePreset,
  crop: CropTransform
): HTMLCanvasElement {
  const sw = source.width;
  const sh = source.height;
  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Error de contexto gráfico.');

  if (preset !== 'logo') {
    ctx.clearRect(0, 0, targetW, targetH);
  }

  const targetRatio = targetW / targetH;
  const sourceRatio = sw / sh;

  let cropW = sw;
  let cropH = sh;
  if (preset === 'profile' || preset === 'cover') {
    if (sourceRatio > targetRatio) {
      cropW = sh * targetRatio;
      cropH = sh;
    } else {
      cropW = sw;
      cropH = sw / targetRatio;
    }
  }

  const zoom = Math.max(1, Math.min(3, crop.zoom || 1));
  cropW = cropW / zoom;
  cropH = cropH / zoom;

  const maxOffsetX = Math.max(0, (sw - cropW) / 2);
  const maxOffsetY = Math.max(0, (sh - cropH) / 2);
  const sx = Math.max(0, Math.min(sw - cropW, (sw - cropW) / 2 + crop.offsetX * maxOffsetX));
  const sy = Math.max(0, Math.min(sh - cropH, (sh - cropH) / 2 + crop.offsetY * maxOffsetY));

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, targetW, targetH);

  if (crop.autoEnhance) {
    applySubtleEnhancement(out);
  }
  return out;
}

export async function processImageWithPreset(
  file: File,
  preset: ImageUsePreset,
  crop?: CropTransform
): Promise<ProcessedMediaResult> {
  const source = await getOrientedCanvas(file);
  const sw = source.width;
  const sh = source.height;

  let effectiveCrop: CropTransform = crop || { zoom: 1, offsetX: 0, offsetY: 0 };
  let faceDetected = false;

  if (preset === 'profile' && !crop) {
    const detected = await detectFaceCropCenter(source);
    effectiveCrop = { ...detected.crop, autoEnhance: false };
    faceDetected = detected.faceDetected;
  }

  let targetW = sw;
  let targetH = sh;

  if (preset === 'profile') {
    targetW = 512;
    targetH = 512;
  } else if (preset === 'cover') {
    targetW = 1600;
    targetH = 900;
  } else if (preset === 'gallery') {
    const maxLongEdge = 1920;
    if (sw >= sh && sw > maxLongEdge) {
      targetW = maxLongEdge;
      targetH = Math.round((sh / sw) * maxLongEdge);
    } else if (sh > sw && sh > maxLongEdge) {
      targetH = maxLongEdge;
      targetW = Math.round((sw / sh) * maxLongEdge);
    }
  } else if (preset === 'logo') {
    const maxEdge = 1024;
    if (sw >= sh && sw > maxEdge) {
      targetW = maxEdge;
      targetH = Math.round((sh / sw) * maxEdge);
    } else if (sh > sw && sh > maxEdge) {
      targetH = maxEdge;
      targetW = Math.round((sw / sh) * maxEdge);
    }
  }

  const out = renderCroppedCanvas(source, targetW, targetH, preset, effectiveCrop);
  const quality = preset === 'logo' ? 0.92 : 0.85;
  const mainEncoded = await encodeCanvasWithFallback(out, quality, preset === 'logo');
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagen';

  let thumbBlob: Blob | undefined;
  let thumbPreviewUrl: string | undefined;
  let profileThumb: ProfileVariantBlob | undefined;
  let profileMedium: ProfileVariantBlob | undefined;

  if (preset === 'profile') {
    // Generar variantes 96px y 256px automáticamente en WebP (con fallback JPEG)
    const buildVariant = async (dim: number, tag: string, q: number): Promise<ProfileVariantBlob> => {
      const c = document.createElement('canvas');
      c.width = dim;
      c.height = dim;
      const cCtx = c.getContext('2d');
      if (cCtx) {
        cCtx.imageSmoothingEnabled = true;
        cCtx.imageSmoothingQuality = 'high';
        cCtx.drawImage(out, 0, 0, dim, dim);
      }
      const enc = await encodeCanvasWithFallback(c, q, false);
      return {
        blob: enc.blob,
        mimeType: enc.mimeType,
        fileName: `${baseName}_${tag}.${enc.ext}`,
        width: dim,
        height: dim,
        previewUrl: URL.createObjectURL(enc.blob),
      };
    };

    profileThumb = await buildVariant(96, '96', 0.8);
    profileMedium = await buildVariant(256, '256', 0.83);
  } else if (preset === 'gallery' || preset === 'cover') {
    const thumbW = 480;
    const thumbH = Math.round((targetH / targetW) * thumbW);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const tCtx = thumbCanvas.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(out, 0, 0, thumbW, thumbH);
      const thumbEncoded = await encodeCanvasWithFallback(thumbCanvas, 0.78, false);
      thumbBlob = thumbEncoded.blob;
      thumbPreviewUrl = URL.createObjectURL(thumbBlob);
    }
  }

  return {
    blob: mainEncoded.blob,
    previewUrl: URL.createObjectURL(mainEncoded.blob),
    thumbnailBlob: thumbBlob,
    thumbnailPreviewUrl: thumbPreviewUrl,
    profileThumb,
    profileMedium,
    mimeType: mainEncoded.mimeType,
    fileName: `${baseName}.${mainEncoded.ext}`,
    width: targetW,
    height: targetH,
    faceDetected,
  };
}

/** Genera vista rápida cuadrada antes/después para el editor de recorte */
export async function renderCropPreviewComparison(
  file: File,
  preset: ImageUsePreset,
  crop: CropTransform
): Promise<{ originalUrl: string; enhancedUrl: string }> {
  const source = await getOrientedCanvas(file);
  const w = preset === 'profile' ? 320 : 480;
  const h = preset === 'profile' ? 320 : preset === 'cover' ? 270 : 360;
  const originalCanvas = renderCroppedCanvas(source, w, h, preset, { ...crop, autoEnhance: false });
  const enhancedCanvas = renderCroppedCanvas(source, w, h, preset, { ...crop, autoEnhance: true });
  return {
    originalUrl: originalCanvas.toDataURL('image/jpeg', 0.86),
    enhancedUrl: enhancedCanvas.toDataURL('image/jpeg', 0.86),
  };
}

export async function extractVideoThumbnail(file: File): Promise<{
  thumbnailBlob?: Blob;
  thumbnailPreviewUrl?: string;
}> {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    let settled = false;
    const finish = (result: { thumbnailBlob?: Blob; thumbnailPreviewUrl?: string }) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(videoUrl);
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({});
    }, 4000);

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      } catch {
        finish({});
      }
    };

    video.onseeked = async () => {
      try {
        const canvas = document.createElement('canvas');
        const w = 640;
        const h = Math.round(((video.videoHeight || 360) / (video.videoWidth || 640)) * w);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const encoded = await encodeCanvasWithFallback(canvas, 0.8, false);
          finish({
            thumbnailBlob: encoded.blob,
            thumbnailPreviewUrl: URL.createObjectURL(encoded.blob),
          });
          return;
        }
      } catch {
        // Ignore thumbnail extraction failure
      }
      finish({});
    };

    video.onerror = () => {
      finish({});
    };
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
