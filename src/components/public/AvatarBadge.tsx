import React, { useEffect, useMemo, useState } from 'react';

const GRADIENTS = [
  'from-emerald-600 to-teal-600',
  'from-blue-600 to-cyan-500',
  'from-indigo-600 to-blue-500',
  'from-amber-500 to-orange-500',
  'from-rose-600 to-pink-500',
];

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function hashColorIndex(seed: string): number {
  let acc = 0;
  for (let i = 0; i < seed.length; i++) {
    acc = (acc + seed.charCodeAt(i) * (i + 1)) % GRADIENTS.length;
  }
  return acc;
}

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'active' | 'in_session' | 'inactive';

export function AvatarBadge({
  name,
  photoUrl,
  thumbUrl,
  mediumUrl,
  size = 'md',
  accentColor,
  statusIndicator,
  className = '',
}: {
  name: string;
  photoUrl?: string;
  thumbUrl?: string;
  mediumUrl?: string;
  size?: AvatarSize;
  accentColor?: string;
  statusIndicator?: AvatarStatus;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const preferredSrc = useMemo(() => {
    if (size === 'xs' || size === 'sm') {
      return thumbUrl || mediumUrl || photoUrl || '';
    }
    if (size === 'md') {
      return mediumUrl || photoUrl || thumbUrl || '';
    }
    return photoUrl || mediumUrl || thumbUrl || '';
  }, [size, thumbUrl, mediumUrl, photoUrl]);

  useEffect(() => {
    setImgError(false);
    setLoaded(false);
  }, [preferredSrc]);

  const sizeCls =
    size === 'xs'
      ? 'h-7 w-7 text-[10px] rounded-xl'
      : size === 'sm'
      ? 'h-9 w-9 text-xs rounded-2xl'
      : size === 'xl'
      ? 'h-20 w-20 text-xl rounded-2xl'
      : size === 'lg'
      ? 'h-16 w-16 text-lg rounded-2xl'
      : 'h-12 w-12 text-sm rounded-2xl';

  const statusDotCls =
    statusIndicator === 'in_session'
      ? 'bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse'
      : statusIndicator === 'active'
      ? 'bg-emerald-500 ring-2 ring-white dark:ring-slate-900'
      : statusIndicator === 'inactive'
      ? 'bg-slate-400 ring-2 ring-white dark:ring-slate-900'
      : '';

  const ringStyle = accentColor
    ? { boxShadow: `0 0 0 2px ${accentColor}` }
    : undefined;

  const grad = GRADIENTS[hashColorIndex(name || 'CMJ')];

  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`}
      style={ringStyle ? { borderRadius: size === 'xs' ? '0.75rem' : '1rem', ...ringStyle } : undefined}
    >
      {preferredSrc && !imgError ? (
        <div
          className={`${sizeCls} relative overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800`}
        >
          {!loaded && (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 animate-pulse"
            />
          )}
          <img
            src={preferredSrc}
            alt={name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setImgError(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      ) : (
        <div
          aria-label={name}
          className={`${sizeCls} bg-gradient-to-br ${grad} flex items-center justify-center font-bold text-white shadow-sm`}
        >
          {computeInitials(name)}
        </div>
      )}

      {statusIndicator && (
        <span
          title={
            statusIndicator === 'in_session'
              ? 'En sesión'
              : statusIndicator === 'active'
              ? 'Activo'
              : 'Inactivo'
          }
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ${
            size === 'xs' || size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
          } ${statusDotCls}`}
        />
      )}
    </div>
  );
}
