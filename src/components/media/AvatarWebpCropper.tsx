import { ChangeEvent, useEffect, useState } from 'react';
import { Camera, RotateCw, Upload } from 'lucide-react';
import { uploadAvatarWebpToStorage } from '../../services/storageService';
import { exportSquareWebpAvatar, SquareCropOptions } from '../../utils/avatarCrop';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface AvatarWebpCropperProps {
  userUid: string;
  displayName: string;
  currentPhotoUrl?: string;
  onUploaded: (url: string) => void;
}

export function AvatarWebpCropper({
  userUid,
  displayName,
  currentPhotoUrl,
  onUploaded,
}: AvatarWebpCropperProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<SquareCropOptions>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    rotateDeg: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecciona una imagen válida (PNG, JPG o WebP).');
      return;
    }
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0, rotateDeg: 0 });
    setSourceUrl(URL.createObjectURL(file));
  };

  const handleConfirmUpload = async () => {
    if (!sourceUrl) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const webpFile = await exportSquareWebpAvatar(sourceUrl, crop);
      const { downloadUrl } = await uploadAvatarWebpToStorage(userUid, webpFile);
      onUploaded(downloadUrl);
      setSourceUrl(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la fotografía.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      id="profile-avatar-section"
      className="flex flex-wrap items-start gap-4 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60"
    >
      <Avatar src={currentPhotoUrl} name={displayName} size="lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold text-stone-900 dark:text-white">
          Fotografía oficial de perfil (cuadrada 1:1)
        </p>
        <p className="text-xs leading-relaxed text-stone-600 dark:text-slate-400">
          Se recorta en formato cuadrado y se optimiza automáticamente a WebP (máx. 2 MB).{' '}
          <strong className="font-medium text-stone-800 dark:text-slate-200">
            Recomendaciones:
          </strong>{' '}
          rostro centrado, fondo neutro y buena luz natural.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <Camera className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <span>{currentPhotoUrl ? 'Cambiar fotografía' : 'Subir fotografía'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {currentPhotoUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onUploaded('')}
            >
              Quitar foto (usar iniciales)
            </Button>
          )}
        </div>
        {errorMsg && (
          <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
            {errorMsg}
          </p>
        )}
      </div>

      <Modal
        open={Boolean(sourceUrl)}
        onClose={() => setSourceUrl(null)}
        title="Recortar fotografía de perfil (1:1 · WebP)"
        maxWidth="md"
      >
        {sourceUrl && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-stone-500 uppercase dark:text-slate-400">
                  Recorte cuadrado (ficha pública)
                </p>
                <div className="mx-auto flex h-56 w-56 items-center justify-center overflow-hidden rounded-xl border-2 border-[#7B1832]/30 bg-stone-900 shadow-inner">
                  <img
                    src={sourceUrl}
                    alt="Vista previa cuadrada de recorte"
                    className="max-h-none max-w-none select-none"
                    style={{
                      transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) rotate(${crop.rotateDeg}deg) scale(${crop.zoom})`,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-stone-500 uppercase dark:text-slate-400">
                  Vista circular
                </p>
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-[#C59B27]/60 bg-stone-900 shadow-sm">
                  <img
                    src={sourceUrl}
                    alt="Vista previa circular"
                    className="max-h-none max-w-none select-none"
                    style={{
                      transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) rotate(${crop.rotateDeg}deg) scale(${crop.zoom})`,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
                <p className="mt-2 text-center text-[11px] text-stone-500 dark:text-slate-400">
                  Encuadra tu rostro al centro.
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="font-medium text-stone-700 dark:text-slate-300">
                  Acercamiento ({crop.zoom.toFixed(1)}x)
                </span>
                <input
                  type="range"
                  min={1}
                  max={2.6}
                  step={0.05}
                  value={crop.zoom}
                  onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))}
                  className="mt-1 w-full accent-[#7B1832]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-medium text-stone-700 dark:text-slate-300">
                    Desplazar horizontal
                  </span>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={crop.offsetX}
                    onChange={(e) => setCrop((c) => ({ ...c, offsetX: Number(e.target.value) }))}
                    className="mt-1 w-full accent-[#7B1832]"
                  />
                </label>
                <label className="block">
                  <span className="font-medium text-stone-700 dark:text-slate-300">
                    Desplazar vertical
                  </span>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    value={crop.offsetY}
                    onChange={(e) => setCrop((c) => ({ ...c, offsetY: Number(e.target.value) }))}
                    className="mt-1 w-full accent-[#7B1832]"
                  />
                </label>
              </div>
            </div>

            {errorMsg && (
              <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-slate-800">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCrop((c) => ({ ...c, rotateDeg: (c.rotateDeg + 90) % 360 }))}
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Girar 90°</span>
              </Button>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setSourceUrl(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  loading={uploading}
                  onClick={() => void handleConfirmUpload()}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Recortar y subir WebP</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
