import { ReactNode } from 'react';

export type CardVariant = 'default' | 'subtle' | 'elevated' | 'interactive';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: CardVariant;
}

const PADDING_MAP = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const VARIANT_MAP: Record<CardVariant, string> = {
  default: 'border-stone-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/75',
  subtle: 'border-stone-200/80 bg-[#F4F1EA]/75 dark:border-slate-800 dark:bg-slate-900/45',
  elevated:
    'border-stone-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900/90',
  interactive:
    'border-stone-200/90 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700',
};

export function Card({
  children,
  className = '',
  padding = 'md',
  variant = 'default',
}: CardProps) {
  return (
    <div
      className={`rounded-xl border ${VARIANT_MAP[variant]} ${PADDING_MAP[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
