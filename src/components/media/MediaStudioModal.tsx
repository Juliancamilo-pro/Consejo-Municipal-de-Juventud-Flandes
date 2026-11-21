import { useEffect, useState } from 'react';
import { Check, Upload } from 'lucide-react';
import { uploadFileToFirebaseStorage } from '../../services/storageService';
import {
  AspectRatioPreset,
  buildMediaUrl,
  DEFAULT_PHOTO_EDITS,
  exportEditedPhotoFile,
  PhotoEditState,
  VideoEditState,
} from '../../utils/mediaCanvas';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { PhotoStudioEditor } from './PhotoStudioEditor';
import { VideoStudioEditor } from './VideoStudioEditor';

export interface MediaStudioResult {
  url: string;
  fileId: string;
  storagePath: string;
  downloadUrl?: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  kind: 'image' | 'video';
}

interface MediaStudioModalProps {
  open: boolean;
  file: File | null;
  existingImageUrl?: string;
  visibility?: 'publico' | 'interno';
  lockedAspect?: AspectRatioPreset;
  title?: string;
  onClose: () => void;
  onComplete: (result: MediaStudioResult) => void;
}

export function MediaStudioModal({
  open,
  file,
  existingImageUrl,
  visibility = 'publico',
  lockedAspect,
  title = 'Estudio de Edición Multimedia',
  onClose,
  onComplete,
}: MediaStudioModalProps) {
  const isVideo = Boolean(file?.type.startsWith('video/'));
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [photoEdits, setPhotoEdits] = useState<PhotoEditState>({
    ...DEFAULT_PHOTO_EDITS,
    aspect: lockedAspect || 'free',
  });
  const [videoEdits, setVideoEdits] = useState<VideoEditState>({
    aspect: lockedAspect || '16:9',
    rotate: 0,
    flipH: false,
    trimStart: 0,
    trimEnd: 0,
    duration: 0,
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
    setPhotoEdits({ ...DEFAULT_PHOTO_EDITS, aspect: lockedAspect || 'free' });
    setVideoEdits({
      aspect: lockedAspect || '16:9',
      rotate: 0,
      flipH: false,
      trimStart: 0,
      trimEnd: 0,
      duration: 0,
    });

    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setObjectUrl(existingImageUrl || '');
    return undefined;
  }, [file, existingImageUrl, lockedAspect]);

  const handleApplyAndUpload = async () => {
    if (!objectUrl) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (isVideo && file) {
        const uploaded = await uploadFileToFirebaseStorage(file, visibility, 'media');
        const hasTrim =
          videoEdits.duration > 0 &&
          (videoEdits.trimStart > 0 || videoEdits.trimEnd < videoEdits.duration);
        const baseUrl = uploaded.downloadUrl || uploaded.storagePath;
        const url = uploaded.downloadUrl
          ? buildMediaUrl(baseUrl, {
              kind: 'video',
              ratio: videoEdits.aspect,
              rotate: videoEdits.rotate,
              flipH: videoEdits.flipH,
              trimStart: hasTrim ? videoEdits.trimStart : undefined,
              trimEnd: hasTrim ? videoEdits.trimEnd : undefined,
            })
          : baseUrl;
        onComplete({
          url,
          fileId: uploaded.fileId,
          storagePath: uploaded.storagePath,
          downloadUrl: uploaded.downloadUrl,
          fileName: uploaded.fileName,
          fileMime: uploaded.fileMime,
          fileSize: uploaded.fileSize,
          kind: 'video',
        });
      } else {
        const sourceName = file?.name || 'fotografia-cmj.jpg';
        const editedFile = await exportEditedPhotoFile(objectUrl, sourceName, photoEdits);
        const uploaded = await uploadFileToFirebaseStorage(editedFile, visibility, 'media');
        const url = uploaded.downloadUrl
          ? buildMediaUrl(uploaded.downloadUrl, {
              kind: 'image',
              ratio: photoEdits.aspect,
            })
          : uploaded.storagePath;
        onComplete({
          url,
          fileId: uploaded.fileId,
          storagePath: uploaded.storagePath,
          downloadUrl: uploaded.downloadUrl,
          fileName: uploaded.fileName,
          fileMime: uploaded.fileMime,
          fileSize: uploaded.fileSize,
          kind: 'image',
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo procesar o subir el archivo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open && Boolean(objectUrl)} onClose={onClose} title={title} maxWidth="2xl">
      <div className="space-y-5">
        {isVideo ? (
          <VideoStudioEditor src={objectUrl} edits={videoEdits} onChange={setVideoEdits} />
        ) : (
          <PhotoStudioEditor
            src={objectUrl}
            edits={photoEdits}
            onChange={setPhotoEdits}
            lockedAspect={lockedAspect}
          />
        )}

        {errorMsg && (
          <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
            {errorMsg}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 pt-4 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" loading={saving} onClick={() => void handleApplyAndUpload()}>
            {saving ? (
              <>
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Subiendo…</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>Aplicar ajustes y subir</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
