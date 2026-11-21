export function slugifyCouncilorName(name: string, uidSuffix?: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);

  if (!base) return uidSuffix ? `consejero-${uidSuffix.slice(0, 6)}` : 'consejero-cmj';
  return uidSuffix ? `${base}-${uidSuffix.slice(0, 5).toLowerCase()}` : base;
}

export interface SquareCropOptions {
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotateDeg: number;
}

export async function exportSquareWebpAvatar(
  imageSrc: string,
  options: SquareCropOptions,
  targetSize = 512,
  maxBytes = 2 * 1024 * 1024,
): Promise<File> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo cargar la imagen para recorte.'));
    el.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Tu navegador no permite procesar imágenes en lienzo.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetSize, targetSize);

  const minSide = Math.min(img.naturalWidth, img.naturalHeight);
  const scale = (targetSize / minSide) * options.zoom;
  const rad = (options.rotateDeg * Math.PI) / 180;

  ctx.save();
  ctx.translate(
    targetSize / 2 + (options.offsetX / 100) * (targetSize * 0.45),
    targetSize / 2 + (options.offsetY / 100) * (targetSize * 0.45),
  );
  ctx.rotate(rad);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  const qualities = [0.88, 0.76, 0.62, 0.48];
  for (const q of qualities) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', q),
    );
    if (blob && blob.size <= maxBytes) {
      return new File([blob], `avatar-${Date.now()}.webp`, { type: 'image/webp' });
    }
  }

  const fallbackBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.8),
  );
  if (!fallbackBlob || fallbackBlob.size > maxBytes) {
    throw new Error('La fotografía comprimida supera el límite de 2 MB. Elige una imagen más liviana.');
  }
  return new File([fallbackBlob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
}
