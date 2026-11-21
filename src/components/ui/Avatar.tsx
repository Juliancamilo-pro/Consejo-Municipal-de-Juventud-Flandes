import { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
  xl: 'h-28 w-28 text-2xl',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={`Fotografía de ${name}`}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`shrink-0 rounded-xl border border-stone-200 object-cover dark:border-slate-700 ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7B1832] to-[#561022] font-display font-semibold text-white shadow-xs dark:from-[#9F2B4B] dark:to-[#611227] ${SIZE_CLASSES[size]} ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
