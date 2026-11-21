export type AspectRatioPreset = 'free' | '1:1' | '4:5' | '16:9' | '9:16' | '4:3';

export type FilterPreset = 'original' | 'flandes' | 'vivido' | 'bn' | 'calido';

export interface PhotoEditState {
  aspect: AspectRatioPreset;
  zoom: number;
  offsetX: number;
  offsetY: number;
  baseRotate: 0 | 90 | 180 | 270;
  angle: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturate: number;
  filterPreset: FilterPreset;
}

export interface VideoEditState {
  aspect: AspectRatioPreset;
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  trimStart: number;
  trimEnd: number;
  duration: number;
}

export const DEFAULT_PHOTO_EDITS: PhotoEditState = {
  aspect: 'free',
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  baseRotate: 0,
  angle: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  filterPreset: 'original',
};

export const ASPECT_OPTIONS: {
  id: AspectRatioPreset;
  label: string;
  platformHint: string;
  ratioValue?: number;
  cssClass: string;
}[] = [
  { id: 'free', label: 'Original', platformHint: 'Libre', cssClass: '' },
  { id: '1:1', label: '1:1', platformHint: 'Instagram / Perfil', ratioValue: 1, cssClass: 'aspect-square' },
  { id: '4:5', label: '4:5', platformHint: 'Instagram / Facebook', ratioValue: 4 / 5, cssClass: 'aspect-[4/5]' },
  { id: '16:9', label: '16:9', platformHint: 'X / Telegram / Portada', ratioValue: 16 / 9, cssClass: 'aspect-video' },
  { id: '9:16', label: '9:16', platformHint: 'TikTok / Reels', ratioValue: 9 / 16, cssClass: 'aspect-[9/16]' },
  { id: '4:3', label: '4:3', platformHint: 'Galería / Acta', ratioValue: 4 / 3, cssClass: 'aspect-[4/3]' },
];

export const FILTER_PRESETS: Record<
  FilterPreset,
  { label: string; brightness: number; contrast: number; saturate: number }
> = {
  original: { label: 'Original', brightness: 100, contrast: 100, saturate: 100 },
  flandes: { label: 'Flandes', brightness: 104, contrast: 108, saturate: 112 },
  vivido: { label: 'Vívido', brightness: 105, contrast: 112, saturate: 132 },
  bn: { label: 'B/N', brightness: 102, contrast: 118, saturate: 0 },
  calido: { label: 'Cálido', brightness: 106, contrast: 104, saturate: 118 },
};

export function getAspectRatioClass(ratio?: AspectRatioPreset): string {
  const found = ASPECT_OPTIONS.find((item) => item.id === ratio);
  return found?.cssClass || '';
}

export function buildMediaUrl(
  baseUrl: string,
  meta: {
    kind: 'image' | 'video';
    ratio?: AspectRatioPreset;
    rotate?: number;
    flipH?: boolean;
    trimStart?: number;
    trimEnd?: number;
  },
): string {
  const cleanBase = baseUrl.split('#')[0].split('?')[0];
  const params = new URLSearchParams();
  params.set('inline', '1');
  if (meta.kind === 'video') params.set('kind', 'video');
  if (meta.ratio && meta.ratio !== 'free') params.set('ratio', meta.ratio);
  if (meta.rotate && meta.rotate !== 0) params.set('rot', String(meta.rotate));
  if (meta.flipH) params.set('flip', '1');

  let fragment = '';
  if (
    meta.kind === 'video' &&
    typeof meta.trimStart === 'number' &&
    typeof meta.trimEnd === 'number' &&
    meta.trimEnd > meta.trimStart
  ) {
    const startStr = meta.trimStart.toFixed(1);
    const endStr = meta.trimEnd.toFixed(1);
    params.set('t', `${startStr}-${endStr}`);
    fragment = `#t=${startStr},${endStr}`;
  }

  return `${cleanBase}?${params.toString()}${fragment}`;
}

export interface ParsedMediaUrl {
  cleanSrc: string;
  kind: 'image' | 'video';
  ratio: AspectRatioPreset;
  rotate: number;
  flipH: boolean;
  trimStart?: number;
  trimEnd?: number;
}

export function parseMediaUrl(rawUrl: string): ParsedMediaUrl {
  const [withoutHash, hashPart] = rawUrl.split('#');
  const [pathOnly, queryPart] = withoutHash.split('?');
  const params = new URLSearchParams(queryPart || '');

  const isVideoExt = /\.(mp4|webm|mov)$/i.test(pathOnly);
  const kind: 'image' | 'video' =
    params.get('kind') === 'video' || isVideoExt ? 'video' : 'image';

  const ratioRaw = params.get('ratio') as AspectRatioPreset | null;
  const ratio: AspectRatioPreset = ASPECT_OPTIONS.some((a) => a.id === ratioRaw)
    ? (ratioRaw as AspectRatioPreset)
    : 'free';

  const rotate = Number(params.get('rot') || '0') || 0;
  const flipH = params.get('flip') === '1';

  let trimStart: number | undefined;
  let trimEnd: number | undefined;
  const tParam = params.get('t');
  if (tParam && tParam.includes('-')) {
    const [s, e] = tParam.split('-').map(Number);
    if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
      trimStart = s;
      trimEnd = e;
    }
  }

  const cleanSrc = hashPart ? `${withoutHash}#${hashPart}` : withoutHash;
  return { cleanSrc, kind, ratio, rotate, flipH, trimStart, trimEnd };
}

export async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para edición.'));
    img.src = src;
  });
}

export async function exportEditedPhotoFile(
  sourceUrl: string,
  originalName: string,
  edits: PhotoEditState,
): Promise<File> {
  const img = await loadImageElement(sourceUrl);
  const naturalW = img.naturalWidth || 1200;
  const naturalH = img.naturalHeight || 900;

  const isRotatedOdd = edits.baseRotate === 90 || edits.baseRotate === 270;
  const orientedW = isRotatedOdd ? naturalH : naturalW;
  const orientedH = isRotatedOdd ? naturalW : naturalH;

  const aspectMeta = ASPECT_OPTIONS.find((a) => a.id === edits.aspect);
  const targetRatio = aspectMeta?.ratioValue || orientedW / orientedH;

  const maxOut = 1800;
  let outW: number;
  let outH: number;
  if (targetRatio >= 1) {
    outW = Math.min(maxOut, Math.max(800, orientedW));
    outH = Math.round(outW / targetRatio);
  } else {
    outH = Math.min(maxOut, Math.max(800, orientedH));
    outW = Math.round(outH * targetRatio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no soporta edición en lienzo.');

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, outW, outH);

  ctx.filter = `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturate}%)`;

  const coverScale = Math.max(outW / orientedW, outH / orientedH);
  const totalScale = coverScale * edits.zoom;
  const totalAngleRad = ((edits.baseRotate + edits.angle) * Math.PI) / 180;

  const panX = (edits.offsetX / 100) * (outW * 0.45);
  const panY = (edits.offsetY / 100) * (outH * 0.45);

  ctx.save();
  ctx.translate(outW / 2 + panX, outH / 2 + panY);
  ctx.rotate(totalAngleRad);
  ctx.scale((edits.flipH ? -1 : 1) * totalScale, (edits.flipV ? -1 : 1) * totalScale);
  ctx.drawImage(img, -naturalW / 2, -naturalH / 2, naturalW, naturalH);
  ctx.restore();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('No se pudo generar el archivo de imagen editado.'));
      },
      'image/jpeg',
      0.92,
    );
  });

  const baseName = originalName.replace(/\.[^.]+$/, '') || 'imagen-cmj';
  return new File([blob], `${baseName}-editada.jpg`, { type: 'image/jpeg' });
}
