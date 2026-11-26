import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { CMJ_LOGO_SRC } from './BrandLogo';

export function VerifiedBadge({
  size = 'sm',
  className = '',
}: {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'xs'
      ? 'h-4 w-4'
      : size === 'md'
      ? 'h-6 w-6'
      : 'h-5 w-5';

  return (
    <span
      title="Consejero verificado del CMJ Flandes"
      aria-label="Consejero verificado del CMJ Flandes"
      className={`inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden ring-2 ring-emerald-500/80 dark:ring-emerald-400/80 bg-emerald-800 shadow-sm align-middle ${dims} ${className}`}
    >
      {imgFailed ? (
        <ShieldCheck className="h-3 w-3 text-white" />
      ) : (
        <img
          src={CMJ_LOGO_SRC}
          alt="Consejero verificado del CMJ Flandes"
          onError={() => setImgFailed(true)}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center select-none"
        />
      )}
    </span>
  );
}
