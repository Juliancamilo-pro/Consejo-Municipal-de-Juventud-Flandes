import heic2any from 'heic2any';

export type ImageUsePreset = 'profile' | 'cover' | 'gallery' | 'logo';

export interface CropTransform {
  zoom: number;
  offsetX: number; // -1 to 1 normalized pan
  offsetY: number; // -1 to 1 normalized pan
}

export interface ProcessedMediaResult {
  blob: Blob;
  previewUrl: string;
  thumbnailBlob?: Blob;
  thumbnailPreviewUrl?: string;
  mimeType: string;
  fileName: string;
  width?: number;
  height?: number;
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
  | 'other';

export function classifyFile(file: File): MediaCategory {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (
    type.startsWith('image/') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    name.endsWith('.webp') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.svg')
  ) {
    return 'image';
  }
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi)$/i.test(name)) {
    return 'video';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(name)) {
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
    /\.(zip|rar|7z|tar|gz)$/i.test(name)
  ) {
    return 'zip';
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
async function getOrientedCanvas(file: File): Promise<HTMLCanvasElement> {
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

export async function processImageWithPreset(
  file: File,
  preset: ImageUsePreset,
  crop: CropTransform = { zoom: 1, offsetX: 0, offsetY: 0 }
): Promise<ProcessedMediaResult> {
  const source = await getOrientedCanvas(file);
  const sw = source.width;
  const sh = source.height;

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

  // Base cover crop dimensions before zoom
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

  // WebP preserves alpha transparency as well as high compression
  const outputMime = 'image/webp';
  const quality = preset === 'logo' ? 0.92 : 0.84;
  const mainBlob = await canvasToBlob(out, outputMime, quality);

  // Generate 400px thumbnail for gallery/cover
  let thumbBlob: Blob | undefined;
  let thumbPreviewUrl: string | undefined;
  if (preset === 'gallery' || preset === 'cover') {
    const thumbW = 480;
    const thumbH = Math.round((targetH / targetW) * thumbW);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const tCtx = thumbCanvas.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(out, 0, 0, thumbW, thumbH);
      thumbBlob = await canvasToBlob(thumbCanvas, 'image/webp', 0.78);
      thumbPreviewUrl = URL.createObjectURL(thumbBlob);
    }
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return {
    blob: mainBlob,
    previewUrl: URL.createObjectURL(mainBlob),
    thumbnailBlob: thumbBlob,
    thumbnailPreviewUrl: thumbPreviewUrl,
    mimeType: outputMime,
    fileName: `${baseName}.webp`,
    width: targetW,
    height: targetH,
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

    const cleanup = () => URL.revokeObjectURL(videoUrl);

    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      } catch {
        cleanup();
        resolve({});
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
          const blob = await canvasToBlob(canvas, 'image/webp', 0.8);
          cleanup();
          resolve({
            thumbnailBlob: blob,
            thumbnailPreviewUrl: URL.createObjectURL(blob),
          });
          return;
        }
      } catch {
        // Ignore thumbnail extraction failure
      }
      cleanup();
      resolve({});
    };

    video.onerror = () => {
      cleanup();
      resolve({});
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
