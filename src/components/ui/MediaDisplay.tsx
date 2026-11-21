import { useState } from 'react';
import { Film, Image as ImageIcon } from 'lucide-react';
import { getAspectRatioClass, parseMediaUrl } from '../../utils/mediaCanvas';

interface MediaDisplayProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  maxHeightClass?: string;
  priority?: boolean;
}

export function MediaDisplay({
  src,
  alt,
  className = '',
  imgClassName = '',
  maxHeightClass = '',
  priority = false,
}: MediaDisplayProps) {
  const [failed, setFailed] = useState(false);
  const parsed = parseMediaUrl(src);
  const ratioClass = getAspectRatioClass(parsed.ratio);

  const transformParts: string[] = [];
  if (parsed.rotate !== 0) transformParts.push(`rotate(${parsed.rotate}deg)`);
  if (parsed.flipH) transformParts.push('scaleX(-1)');
  const transformStyle = transformParts.length > 0 ? transformParts.join(' ') : undefined;

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-stone-100 text-stone-400 dark:bg-slate-800 ${ratioClass || 'aspect-[4/3]'} ${className}`}
      >
        {parsed.kind === 'video' ? (
          <Film className="h-8 w-8" aria-hidden="true" />
        ) : (
          <ImageIcon className="h-8 w-8" aria-hidden="true" />
        )}
      </div>
    );
  }

  if (parsed.kind === 'video') {
    return (
      <div
        className={`relative overflow-hidden bg-slate-950 ${ratioClass || 'aspect-video'} ${maxHeightClass} ${className}`}
      >
        <video
          src={parsed.cleanSrc}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          style={transformStyle ? { transform: transformStyle } : undefined}
          className={`h-full w-full object-contain ${imgClassName}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-stone-100 dark:bg-slate-800 ${ratioClass} ${maxHeightClass} ${className}`}
    >
      <img
        src={parsed.cleanSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={transformStyle ? { transform: transformStyle } : undefined}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
    </div>
  );
}
