import { useState } from 'react';
import { Building2 } from 'lucide-react';

interface EditorialImageProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  imgClassName?: string;
  aspectClassName?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function EditorialImage({
  src,
  alt,
  caption,
  className = '',
  imgClassName = '',
  aspectClassName = 'aspect-[16/10]',
  width = 1376,
  height = 768,
  priority = false,
}: EditorialImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className={`overflow-hidden ${className}`}>
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-stone-200/90 bg-stone-100 dark:border-slate-800 dark:bg-slate-800">
        <div className={`w-full overflow-hidden ${aspectClassName}`}>
          {failed ? (
            <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center bg-gradient-to-br from-[#7B1832]/15 via-[#C59B27]/10 to-[#1E3A8A]/15 p-6 text-center">
              <Building2 className="h-9 w-9 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
              <p className="mt-3 max-w-xs font-display text-sm font-medium text-stone-700 dark:text-slate-200">
                {alt}
              </p>
            </div>
          ) : (
            <img
              src={src}
              alt={alt}
              width={width}
              height={height}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className={`h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.02] ${imgClassName}`}
            />
          )}
        </div>
        {caption && (
          <figcaption className="border-t border-stone-200/80 bg-white/95 px-4 py-2.5 text-xs text-stone-600 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-300">
            {caption}
          </figcaption>
        )}
      </div>
    </figure>
  );
}
