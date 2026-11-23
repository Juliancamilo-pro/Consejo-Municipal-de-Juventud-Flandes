import React from 'react';

const GRADIENTS = [
  'from-blue-600 to-cyan-500',
  'from-emerald-600 to-teal-500',
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

export function AvatarBadge({
  name,
  photoUrl,
  size = 'md',
}: {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeCls =
    size === 'sm'
      ? 'h-9 w-9 text-xs'
      : size === 'lg'
      ? 'h-16 w-16 text-lg'
      : 'h-12 w-12 text-sm';

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`${sizeCls} rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800`}
      />
    );
  }

  const grad = GRADIENTS[hashColorIndex(name || 'CMJ')];
  return (
    <div
      aria-label={name}
      className={`${sizeCls} rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center font-bold text-white shrink-0 shadow-sm`}
    >
      {computeInitials(name)}
    </div>
  );
}
