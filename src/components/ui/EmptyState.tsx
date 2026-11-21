import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  tone?: 'neutral' | 'error';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  tone = 'neutral',
}: EmptyStateProps) {
  const isError = tone === 'error';

  return (
    <div
      className={`rounded-xl border px-6 py-12 text-center sm:px-10 ${
        isError
          ? 'border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/25'
          : 'border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900/70'
      }`}
    >
      <div
        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-lg border ${
          isError
            ? 'border-red-200 bg-white text-red-700 dark:border-red-800 dark:bg-slate-900 dark:text-red-400'
            : 'border-stone-200 bg-[#FAFAF8] text-[#7B1832] dark:border-slate-700 dark:bg-slate-800 dark:text-[#D9B245]'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-stone-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600 dark:text-slate-300">
        {description}
      </p>
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <Button type="button" variant={isError ? 'danger' : 'primary'} onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button type="button" variant="outline" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
