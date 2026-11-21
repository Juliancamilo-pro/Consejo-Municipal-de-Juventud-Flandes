import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { FileUp, Film, ImagePlus } from 'lucide-react';

interface MediaDropzoneProps {
  label: string;
  helperText?: string;
  accept: string;
  disabled?: boolean;
  mode?: 'media' | 'documents';
  onFileSelected: (file: File) => void;
}

export function MediaDropzone({
  label,
  helperText,
  accept,
  disabled = false,
  mode = 'media',
  onFileSelected,
}: MediaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !disabled) {
      onFileSelected(file);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <span className="block text-sm font-medium text-stone-800 dark:text-slate-200">{label}</span>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? 'border-[#7B1832] bg-[#7B1832]/5 dark:border-[#C59B27] dark:bg-[#C59B27]/10'
            : 'border-stone-300 bg-[#FAF8F4] hover:border-[#7B1832]/60 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-[#C59B27]/60'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex items-center gap-2 text-[#7B1832] dark:text-[#D9B245]">
          {mode === 'media' ? (
            <>
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              <Film className="h-5 w-5" aria-hidden="true" />
            </>
          ) : (
            <FileUp className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <p className="mt-2 text-sm font-medium text-stone-800 dark:text-slate-100">
          Arrastra aquí o haz clic para seleccionar
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
          {helperText ||
            (mode === 'media'
              ? 'Fotos (PNG, JPG, WebP) o Videos (MP4, WebM, MOV) · máx. 50 MB'
              : 'PDF, Word, Excel, PowerPoint, Foto escaneada o Video-Acta · máx. 50 MB')}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
