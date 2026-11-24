import React, { useState } from 'react';

export const CMJ_LOGO_SRC =
  '/assets/aistudio/751360231_18083936480402166_5535085692637315625_n__1__996feb43.jpg';

export function BrandLogo({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const sizeCls =
    size === 'sm'
      ? 'h-9 w-9 rounded-xl'
      : size === 'lg'
      ? 'h-14 w-14 rounded-2xl'
      : size === 'xl'
      ? 'h-24 w-24 rounded-2xl'
      : size === 'hero'
      ? 'w-44 h-44 sm:w-56 sm:h-56 rounded-3xl'
      : 'h-11 w-11 rounded-xl';

  if (failed) {
    return (
      <div
        aria-label="Escudo oficial CMJ Flandes"
        className={`${sizeCls} aspect-square shrink-0 bg-gradient-to-b from-emerald-700 via-white to-emerald-700 border border-emerald-800/30 flex items-center justify-center shadow-sm ${className}`}
      >
        <span className="rounded-lg bg-emerald-800 px-2 py-0.5 text-xs font-extrabold tracking-tight text-white">
          CMJ
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeCls} aspect-square shrink-0 overflow-hidden bg-emerald-800 ring-1 ring-slate-900/10 dark:ring-white/15 shadow-sm ${className}`}
    >
      <img
        src={CMJ_LOGO_SRC}
        alt="Consejo Municipal de Juventudes de Flandes"
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover object-center select-none"
      />
    </div>
  );
}
