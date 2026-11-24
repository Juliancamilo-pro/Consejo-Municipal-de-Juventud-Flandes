import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  Check,
  Crop,
  Eye,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image as ImageIcon,
  Link2,
  Paperclip,
  Presentation,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { apiRequest, resolveApiUrl } from '../lib/apiClient';
import {
  autoDetectProfileCropForFile,
  classifyFile,
  extractVideoThumbnail,
  formatBytes,
  processImageWithPreset,
  renderCropPreviewComparison,
  validateFileMagicBytes,
  type CropTransform,
  type ImageUsePreset,
  type MediaCategory,
  type ProfileVariantBlob,
} from '../lib/mediaProcessor';
import { parseVideoEmbedUrl } from '../lib/storageUtils';
import { useToast } from './ToastProvider';

export interface UploadedFileInfo {
  url: string;
  thumbnailUrl?: string;
  thumbUrl?: string;
  mediumUrl?: string;
  storagePath?: string;
  thumbnailStoragePath?: string;
  videoSource?: 'upload' | 'youtube' | 'vimeo';
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: MediaCategory;
}

interface QueuedItem {
  id: string;
  file: File;
  category: MediaCategory;
  previewUrl: string;
  thumbnailUrl?: string;
  processedBlob?: Blob;
  processedThumbBlob?: Blob;
  profileThumb?: ProfileVariantBlob;
  profileMedium?: ProfileVariantBlob;
  faceDetected?: boolean;
  finalName: string;
  finalMime: string;
  progress: number;
  status: 'pending' | 'processing' | 'uploading' | 'done' | 'error' | 'cancelled';
  errorMsg?: string;
  result?: UploadedFileInfo;
  crop: CropTransform;
}

function FileCategoryIcon({ category }: { category: MediaCategory }) {
  switch (category) {
    case 'image':
      return <ImageIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />;
    case 'video':
      return <FileVideo className="h-5 w-5 text-pink-600 dark:text-pink-400" />;
    case 'audio':
      return <FileAudio className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
    case 'pdf':
      return <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />;
    case 'word':
      return <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    case 'excel':
      return <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
    case 'powerpoint':
      return <Presentation className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
    case 'zip':
      return <FileArchive className="h-5 w-5 text-violet-600 dark:text-violet-400" />;
    case 'text':
      return <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />;
    default:
      return <Paperclip className="h-5 w-5 text-slate-600 dark:text-slate-400" />;
  }
}

export function MediaUploader({
  storageFolder,
  imagePreset = 'gallery',
  multiple = false,
  allowExternalVideo = false,
  label = 'Subir archivos, fotos o videos',
  helperText,
  onUploaded,
}: {
  storageFolder: string;
  imagePreset?: ImageUsePreset;
  multiple?: boolean;
  allowExternalVideo?: boolean;
  label?: string;
  helperText?: string;
  onUploaded: (files: UploadedFileInfo[]) => void;
}) {
  const { showToast } = useToast();
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [editingCropId, setEditingCropId] = useState<string | null>(null);
  const [cropDraft, setCropDraft] = useState<CropTransform>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    autoEnhance: false,
  });
  const [cropPreviewSrc, setCropPreviewSrc] = useState<string>('');
  const [cropCompareUrls, setCropCompareUrls] = useState<{
    originalUrl: string;
    enhancedUrl: string;
  } | null>(null);
  const [showBeforeOriginal, setShowBeforeOriginal] = useState(false);
  const [dragPanStart, setDragPanStart] = useState<{ x: number; y: number } | null>(null);
  const [externalVideoUrl, setExternalVideoUrl] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const cancelledIdsRef = useRef<Set<string>>(new Set());

  const maxMbAllowed = 20;

  const presetLabel =
    imagePreset === 'profile'
      ? 'Foto de perfil (1:1 · 96/256/512px WebP + auto-encuadre facial)'
      : imagePreset === 'cover'
      ? 'Portada / Banner (16:9 · 1600×900 WebP)'
      : imagePreset === 'logo'
      ? 'Logo con transparencia (WebP)'
      : 'Galería / Noticias (Máx. 1920px WebP + miniatura)';

  const addFiles = useCallback(
    async (incomingFiles: FileList | File[]) => {
      const list = Array.from(incomingFiles);
      if (!list.length) return;
      const selected = multiple ? list : [list[0]];

      const newItems: QueuedItem[] = [];
      for (const file of selected) {
        const magicCheck = await validateFileMagicBytes(file);
        if (!magicCheck.valid) {
          showToast('Archivo bloqueado por seguridad', 'error', magicCheck.reason);
          continue;
        }

        const category = classifyFile(file);
        if (file.size > maxMbAllowed * 1024 * 1024 && category !== 'image') {
          showToast(
            `${file.name} supera ${maxMbAllowed} MB`,
            'error',
            'Reduce el peso del archivo o usa un enlace de YouTube/Vimeo si es video largo.'
          );
          continue;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const initialPreview =
          category === 'image' || category === 'video' ? URL.createObjectURL(file) : '';

        newItems.push({
          id,
          file,
          category,
          previewUrl: initialPreview,
          finalName: file.name,
          finalMime: file.type || 'application/octet-stream',
          progress: 0,
          status: 'processing',
          crop: {
            zoom: 1,
            offsetX: 0,
            offsetY: imagePreset === 'profile' ? -0.2 : 0,
            autoEnhance: false,
          },
        });
      }

      if (!newItems.length) return;
      setQueue((prev) => (multiple ? [...prev, ...newItems] : newItems));

      for (const item of newItems) {
        try {
          if (item.category === 'image') {
            let initialCrop: CropTransform | undefined;
            if (imagePreset === 'profile') {
              const detected = await autoDetectProfileCropForFile(item.file);
              initialCrop = { ...detected.crop, autoEnhance: false };
            }
            const processed = await processImageWithPreset(item.file, imagePreset, initialCrop);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      crop: initialCrop || q.crop,
                      faceDetected: processed.faceDetected,
                      processedBlob: processed.blob,
                      processedThumbBlob: processed.thumbnailBlob,
                      profileThumb: processed.profileThumb,
                      profileMedium: processed.profileMedium,
                      previewUrl: processed.previewUrl,
                      thumbnailUrl: processed.thumbnailPreviewUrl,
                      finalName: processed.fileName,
                      finalMime: processed.mimeType,
                      status: 'pending',
                    }
                  : q
              )
            );
          } else if (item.category === 'video') {
            const thumb = await extractVideoThumbnail(item.file);
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? {
                      ...q,
                      processedBlob: item.file,
                      processedThumbBlob: thumb.thumbnailBlob,
                      thumbnailUrl: thumb.thumbnailPreviewUrl,
                      status: 'pending',
                    }
                  : q
              )
            );
          } else {
            setQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, processedBlob: item.file, status: 'pending' }
                  : q
              )
            );
          }
        } catch (err) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: 'error',
                    errorMsg:
                      err instanceof Error
                        ? err.message
                        : 'No se pudo preparar el archivo.',
                  }
                : q
            )
          );
        }
      }
    },
    [imagePreset, maxMbAllowed, multiple, showToast]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      addFiles(e.clipboardData.files);
      showToast('Archivo pegado desde el portapapeles', 'info');
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles, showToast]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = typeof reader.result === 'string' ? reader.result : '';
        const commaIdx = res.indexOf(',');
        resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(blob);
    });

  const uploadSingleItem = async (item: QueuedItem): Promise<UploadedFileInfo | null> => {
    const blobToUpload = item.processedBlob || item.file;
    cancelledIdsRef.current.delete(item.id);

    setQueue((prev) =>
      prev.map((q) =>
        q.id === item.id ? { ...q, status: 'uploading', progress: 15, errorMsg: undefined } : q
      )
    );

    try {
      const base64Data = await blobToBase64(blobToUpload);
      if (cancelledIdsRef.current.has(item.id)) {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'cancelled', progress: 0 } : q))
        );
        return null;
      }

      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress: 50 } : q)));

      const mainRes = await apiRequest<{ url: string; storagePath: string }>('/api/media/upload', {
        method: 'POST',
        body: {
          folder: storageFolder,
          fileName: item.finalName,
          mimeType: item.finalMime,
          fileSize: blobToUpload.size,
          base64Data,
        },
        skipRefresh: true,
      });

      let thumbUrl: string | undefined;
      let thumbStoragePath: string | undefined;
      if (item.processedThumbBlob) {
        const thumbB64 = await blobToBase64(item.processedThumbBlob);
        const thumbRes = await apiRequest<{ url: string; storagePath: string }>('/api/media/upload', {
          method: 'POST',
          body: {
            folder: storageFolder,
            fileName: `thumb_${item.finalName}.webp`,
            mimeType: 'image/webp',
            fileSize: item.processedThumbBlob.size,
            base64Data: thumbB64,
          },
          skipRefresh: true,
        });
        thumbUrl = resolveApiUrl(thumbRes.url);
        thumbStoragePath = thumbRes.storagePath;
      }

      // Variantes de foto de perfil (96px y 256px)
      let profileThumbUrl: string | undefined;
      let profileMediumUrl: string | undefined;
      if (imagePreset === 'profile' && item.profileThumb && item.profileMedium) {
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress: 78 } : q)));
        const [b96, b256] = await Promise.all([
          blobToBase64(item.profileThumb.blob),
          blobToBase64(item.profileMedium.blob),
        ]);
        const [r96, r256] = await Promise.all([
          apiRequest<{ url: string }>('/api/media/upload', {
            method: 'POST',
            body: {
              folder: storageFolder,
              fileName: item.profileThumb.fileName,
              mimeType: item.profileThumb.mimeType,
              fileSize: item.profileThumb.blob.size,
              base64Data: b96,
            },
            skipRefresh: true,
          }),
          apiRequest<{ url: string }>('/api/media/upload', {
            method: 'POST',
            body: {
              folder: storageFolder,
              fileName: item.profileMedium.fileName,
              mimeType: item.profileMedium.mimeType,
              fileSize: item.profileMedium.blob.size,
              base64Data: b256,
            },
            skipRefresh: true,
          }),
        ]);
        profileThumbUrl = resolveApiUrl(r96.url);
        profileMediumUrl = resolveApiUrl(r256.url);
        thumbUrl = profileThumbUrl;
      }

      const info: UploadedFileInfo = {
        url: resolveApiUrl(mainRes.url),
        thumbnailUrl: thumbUrl,
        thumbUrl: profileThumbUrl,
        mediumUrl: profileMediumUrl,
        storagePath: mainRes.storagePath,
        thumbnailStoragePath: thumbStoragePath,
        videoSource: item.category === 'video' ? 'upload' : undefined,
        fileName: item.finalName,
        mimeType: item.finalMime,
        fileSize: blobToUpload.size,
        category: item.category,
      };
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: 'done', progress: 100, result: info } : q
        )
      );
      return info;
    } catch (error) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'error',
                errorMsg:
                  error instanceof Error ? error.message : 'No fue posible subir el archivo.',
              }
            : q
        )
      );
      return null;
    }
  };

  const handleUploadAll = async () => {
    const ready = queue.filter(
      (q) => q.status === 'pending' || q.status === 'error' || q.status === 'cancelled'
    );
    if (!ready.length) return;
    const uploadedResults: UploadedFileInfo[] = [];
    for (const item of ready) {
      const res = await uploadSingleItem(item);
      if (res) uploadedResults.push(res);
    }
    if (uploadedResults.length > 0) {
      onUploaded(uploadedResults);
      showToast(
        uploadedResults.length === 1
          ? 'Archivo guardado correctamente'
          : `${uploadedResults.length} archivos guardados correctamente`,
        'success'
      );
    }
  };

  const handleAttachExternalVideo = () => {
    const parsed = parseVideoEmbedUrl(externalVideoUrl);
    if (!parsed) {
      showToast('Enlace no reconocido', 'error', 'Pega una URL válida de YouTube o Vimeo.');
      return;
    }
    onUploaded([
      {
        url: parsed.embedUrl,
        thumbnailUrl: parsed.thumbnailUrl,
        videoSource: parsed.source,
        fileName: `Video de ${parsed.source === 'youtube' ? 'YouTube' : 'Vimeo'}`,
        mimeType: 'video/embed',
        fileSize: 0,
        category: 'video',
      },
    ]);
    setExternalVideoUrl('');
    showToast('Enlace de video agregado', 'success');
  };

  const cancelUpload = (id: string) => {
    cancelledIdsRef.current.add(id);
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: 'cancelled', progress: 0 } : q))
    );
  };

  const openCropEditor = async (item: QueuedItem) => {
    setEditingCropId(item.id);
    setCropDraft(item.crop);
    setShowBeforeOriginal(false);
    setCropCompareUrls(null);
    setCropPreviewSrc(URL.createObjectURL(item.file));
    try {
      const comp = await renderCropPreviewComparison(item.file, imagePreset, item.crop);
      setCropCompareUrls(comp);
    } catch {
      // Optional comparison preview
    }
  };

  const refreshEnhanceComparison = async (nextCrop: CropTransform) => {
    if (!editingCropId) return;
    const target = queue.find((q) => q.id === editingCropId);
    if (!target) return;
    try {
      const comp = await renderCropPreviewComparison(target.file, imagePreset, nextCrop);
      setCropCompareUrls(comp);
    } catch {
      // ignore
    }
  };

  const handleAutoDetectInModal = async () => {
    if (!editingCropId) return;
    const target = queue.find((q) => q.id === editingCropId);
    if (!target) return;
    try {
      const res = await autoDetectProfileCropForFile(target.file);
      const next = { ...res.crop, autoEnhance: cropDraft.autoEnhance };
      setCropDraft(next);
      await refreshEnhanceComparison(next);
      showToast(
        res.faceDetected ? 'Rostro detectado y centrado' : 'Encuadre de retrato superior aplicado',
        'info'
      );
    } catch {
      showToast('No se pudo analizar la imagen', 'error');
    }
  };

  const applyCrop = async () => {
    if (!editingCropId) return;
    const target = queue.find((q) => q.id === editingCropId);
    if (!target) return;
    try {
      const processed = await processImageWithPreset(target.file, imagePreset, cropDraft);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === target.id
            ? {
                ...q,
                crop: cropDraft,
                processedBlob: processed.blob,
                processedThumbBlob: processed.thumbnailBlob,
                profileThumb: processed.profileThumb,
                profileMedium: processed.profileMedium,
                previewUrl: processed.previewUrl,
                thumbnailUrl: processed.thumbnailPreviewUrl,
                finalName: processed.fileName,
                finalMime: processed.mimeType,
                status: 'pending',
              }
            : q
        )
      );
      setEditingCropId(null);
      showToast('Recorte aplicado y optimizado', 'success');
    } catch {
      showToast('No se pudo recortar la imagen', 'error');
    }
  };

  const pendingCount = queue.filter(
    (q) => q.status === 'pending' || q.status === 'error' || q.status === 'cancelled'
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {presetLabel} · Máx {maxMbAllowed} MB
        </span>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`relative rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
          dragActive
            ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/30 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 hover:border-blue-400 dark:hover:border-cyan-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={imagePreset === 'profile' ? 'image/*,.heic,.heif' : '*/*'}
          multiple={multiple}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture={imagePreset === 'profile' ? 'user' : 'environment'}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
        />

        <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/70 dark:text-cyan-400">
          <UploadCloud className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Arrastra archivos aquí, pega con <kbd className="px-1.5 py-0.5 text-xs rounded bg-slate-200 dark:bg-slate-800">Ctrl+V</kbd> o selecciona desde tu dispositivo
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {helperText ||
            'Imágenes (JPG, PNG, HEIC, WebP, SVG, AVIF), video MP4/WebM, audio, PDF, Office, TXT/MD, CSV y ZIP/RAR/7Z.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Seleccionar archivo{multiple ? 's' : ''}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Camera className="h-3.5 w-3.5" />
            Usar cámara
          </button>
        </div>
      </div>

      {allowExternalVideo && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
            <Link2 className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
            O enlazar YouTube / Vimeo:
          </div>
          <input
            type="url"
            value={externalVideoUrl}
            onChange={(e) => setExternalVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={handleAttachExternalVideo}
            className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            Usar enlace
          </button>
        </div>
      )}

      {/* Queue List */}
      <AnimatePresence>
        {queue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2.5"
          >
            {queue.map((item) => (
              <motion.div
                key={item.id}
                layout
                className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {item.category === 'image' && item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.finalName} className="h-full w-full object-cover" />
                  ) : item.category === 'video' && item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.finalName} className="h-full w-full object-cover" />
                  ) : (
                    <FileCategoryIcon category={item.category} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {item.finalName}
                    </p>
                    <span className="font-mono-num text-[11px] text-slate-500 shrink-0">
                      {formatBytes(item.processedBlob?.size || item.file.size)}
                    </span>
                  </div>

                  {item.faceDetected && item.status === 'pending' && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Rostro centrado automáticamente (96 / 256 / 512 px)
                    </p>
                  )}

                  {item.status === 'processing' && (
                    <p className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-1">
                      Optimizando, detectando encuadre y corrigiendo orientación...
                    </p>
                  )}

                  {item.status === 'uploading' && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="font-mono-num text-[11px] font-medium text-blue-600 dark:text-cyan-400">
                        {item.progress}%
                      </span>
                    </div>
                  )}

                  {item.status === 'done' && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> Guardado correctamente
                    </p>
                  )}

                  {item.status === 'error' && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 leading-snug">
                      {item.errorMsg}
                    </p>
                  )}

                  {item.status === 'cancelled' && (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                      Subida cancelada
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.category === 'image' && item.status !== 'uploading' && item.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => openCropEditor(item)}
                      title="Recortar, mejorar luz y ajustar zoom"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                    >
                      <Crop className="h-4 w-4" />
                    </button>
                  )}

                  {item.status === 'uploading' && (
                    <button
                      type="button"
                      onClick={() => cancelUpload(item.id)}
                      title="Cancelar subida"
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {(item.status === 'error' || item.status === 'cancelled') && (
                    <button
                      type="button"
                      onClick={() => uploadSingleItem(item).then((r) => r && onUploaded([r]))}
                      title="Reintentar"
                      className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}

                  {item.status !== 'uploading' && (
                    <button
                      type="button"
                      onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                      title="Quitar de la cola"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}

            {pendingCount > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleUploadAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-95 transition-opacity cursor-pointer"
                >
                  <UploadCloud className="h-4 w-4" />
                  Subir {pendingCount === 1 ? 'archivo' : `${pendingCount} archivos`}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop & Zoom & Auto-Enhance Modal */}
      <AnimatePresence>
        {editingCropId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Encuadre, zoom y mejora visual
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Arrastra para centrar el rostro y ajusta los controles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCropId(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div
                className={`relative mx-auto overflow-hidden rounded-2xl bg-slate-950 select-none cursor-grab active:cursor-grabbing ${
                  imagePreset === 'profile'
                    ? 'w-64 h-64 rounded-3xl ring-2 ring-emerald-500/70'
                    : imagePreset === 'cover'
                    ? 'w-full aspect-video'
                    : 'w-full aspect-[4/3]'
                }`}
                onPointerDown={(e) => setDragPanStart({ x: e.clientX, y: e.clientY })}
                onPointerMove={(e) => {
                  if (!dragPanStart) return;
                  const dx = (dragPanStart.x - e.clientX) / 140;
                  const dy = (dragPanStart.y - e.clientY) / 140;
                  setDragPanStart({ x: e.clientX, y: e.clientY });
                  setCropDraft((prev) => ({
                    ...prev,
                    offsetX: Math.max(-1, Math.min(1, prev.offsetX + dx)),
                    offsetY: Math.max(-1, Math.min(1, prev.offsetY + dy)),
                  }));
                }}
                onPointerUp={() => setDragPanStart(null)}
                onPointerLeave={() => setDragPanStart(null)}
              >
                {cropPreviewSrc && (
                  <img
                    src={
                      cropDraft.autoEnhance && cropCompareUrls && !showBeforeOriginal
                        ? cropCompareUrls.enhancedUrl
                        : cropPreviewSrc
                    }
                    alt="Vista de recorte"
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                    style={
                      cropDraft.autoEnhance && cropCompareUrls && !showBeforeOriginal
                        ? undefined
                        : {
                            transform: `scale(${cropDraft.zoom}) translate(${-cropDraft.offsetX * 18}%, ${-cropDraft.offsetY * 18}%)`,
                          }
                    }
                  />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ZoomOut className="h-4 w-4 text-slate-400" />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={cropDraft.zoom}
                    onChange={(e) => {
                      const next = { ...cropDraft, zoom: Number(e.target.value) };
                      setCropDraft(next);
                    }}
                    className="flex-1 accent-blue-600 cursor-pointer"
                  />
                  <ZoomIn className="h-4 w-4 text-slate-400" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cropDraft.autoEnhance)}
                      onChange={(e) => {
                        const next = { ...cropDraft, autoEnhance: e.target.checked };
                        setCropDraft(next);
                        refreshEnhanceComparison(next);
                      }}
                      className="rounded border-slate-300 text-emerald-600 cursor-pointer"
                    />
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Mejorar foto (luz, contraste y nitidez)
                  </label>

                  {cropDraft.autoEnhance && (
                    <button
                      type="button"
                      onPointerDown={() => setShowBeforeOriginal(true)}
                      onPointerUp={() => setShowBeforeOriginal(false)}
                      onPointerLeave={() => setShowBeforeOriginal(false)}
                      onClick={() => setShowBeforeOriginal((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      {showBeforeOriginal ? 'Viendo: Antes' : 'Comparar: Antes/Después'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {imagePreset === 'profile' ? (
                    <button
                      type="button"
                      onClick={handleAutoDetectInModal}
                      className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                    >
                      Auto-centrar rostro
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCropDraft({ zoom: 1, offsetX: 0, offsetY: 0, autoEnhance: false })}
                      className="rounded-xl px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Restablecer
                    </button>
                    <button
                      type="button"
                      onClick={applyCrop}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      Aplicar recorte
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
