import { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral:
    'border-stone-200 bg-stone-100 text-stone-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  brand:
    'border-[#7B1832]/25 bg-[#7B1832]/10 text-[#7B1832] dark:border-[#D9B245]/35 dark:bg-[#C59B27]/15 dark:text-[#E5C158]',
  info:
    'border-[#1E3A8A]/20 bg-[#1E3A8A]/10 text-[#1E3A8A] dark:border-blue-500/30 dark:bg-blue-950/60 dark:text-blue-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300',
  danger:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-300',
};

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
