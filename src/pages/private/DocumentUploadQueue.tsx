import { DragEvent, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FilePlus2,
  RefreshCw,
  Sliders,
  Trash2,
} from 'lucide-react';
import { InstitutionalDocument } from '../../types/models';
import { formatFileSize } from '../../utils/documentUtils';
import { MediaStudioResult } from '../../components/media/MediaStudioModal';
import { Button } from '../../components/ui/Button';

export interface QueuedDocumentFile {
  id: string;
  file: File;
  sha256?: string;
  previewUrl?: string;
  compressedSavedPct?: number;
  editedMedia?: MediaStudioResult;
  status: 'listo' | 'subiendo' | 'completado' | 'error';
  errorText?: string;
  progress: number;
}

const ACCEPTED =
  '.pdf,.docx,.xlsx,.pptx,image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime';

interface DocumentUploadQueueProps {
  queue: QueuedDocumentFile[];
  duplicates: InstitutionalDocument[];
  uploading: boolean;
  onEnqueue: (files: FileList | null) => void;
  onEditMedia: (item: QueuedDocumentFile) => void;
  onRetryItem: (id: string) => void;
  onRemove: (id: string) => void;
}

export function DocumentUploadQueue({
  queue,
  duplicates,
  uploading,
  onEnqueue,
  onEditMedia,
  onRetryItem,
  onRemove,
}: DocumentUploadQueueProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    onEnqueue(e.dataTransfer.files);
  };

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          isDragging
            ? 'border-[#7B1832] bg-[#FBF4F6] dark:border-[#D9B245] dark:bg-slate-800'
            : 'border-stone-300 bg-[#FAF8F4] dark:border-slate-700 dark:bg-slate-900/50'
        }`}
      >
        <FilePlus2 className="mx-auto h-6 w-6 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-stone-900 dark:text-white">
          Arrastra archivos aquí (PDF, Office, imagen WebP/JPG/PNG o video, máx. 50 MB)
        </p>
        <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
          Verificación automática de formato real, hash SHA-256 anti-duplicados y optimización WebP.
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <span>Seleccionar archivos</span>
          <input
            type="file"
            multiple
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              onEnqueue(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((item) => {
            const isImage = item.file.type.startsWith('image/');
            const isPdf = item.file.type === 'application/pdf';
            const isMedia = isImage || item.file.type.startsWith('video/');
            return (
              <div
                key={item.id}
                className="rounded-lg border border-stone-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {isImage && item.previewUrl && (
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-stone-900 dark:text-white">
                        {item.editedMedia ? item.editedMedia.fileName : item.file.name}
                      </p>
                      <p className="font-mono-tabular text-stone-500 dark:text-slate-400">
                        {formatFileSize(item.editedMedia ? item.editedMedia.fileSize : item.file.size)}
                        {item.compressedSavedPct ? ` · Optimizada -${item.compressedSavedPct}% WebP` : ''}
                        {item.sha256 ? ` · SHA ${item.sha256.slice(0, 8)}` : ''}
                        {item.progress > 0 ? ` · ${item.progress}%` : ''}
                      </p>
                      {item.status === 'error' && item.errorText && (
                        <p className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">
                          {item.errorText}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.status === 'completado' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Listo
                      </span>
                    )}
                    {(isPdf || isImage) && item.previewUrl && (
                      <a
                        href={item.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        <Eye className="h-3 w-3" aria-hidden="true" />
                        <span>Previsualizar</span>
                      </a>
                    )}
                    {isMedia && (
                      <Button type="button" size="sm" variant="outline" onClick={() => onEditMedia(item)}>
                        <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ajustar</span>
                      </Button>
                    )}
                    {item.status === 'error' && (
                      <Button type="button" size="sm" variant="outline" onClick={() => onRetryItem(item.id)}>
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Reintentar</span>
                      </Button>
                    )}
                    <button
                      type="button"
                      disabled={uploading && item.status === 'subiendo'}
                      onClick={() => onRemove(item.id)}
                      aria-label={`Quitar ${item.file.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-red-50 hover:text-red-700 dark:border-slate-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {item.progress > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                    <div
                      className="h-full bg-[#7B1832] transition-all dark:bg-[#D9B245]"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Duplicado exacto o coincidencia detectada: ya existe &ldquo;{duplicates[0].title}&rdquo; (
            {duplicates[0].fileName}). Si deseas actualizar ese archivo, sube una nueva versión desde su ficha.
          </p>
        </div>
      )}
    </>
  );
}
