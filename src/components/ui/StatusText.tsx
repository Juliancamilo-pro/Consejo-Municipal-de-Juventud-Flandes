export type SemanticTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatusTextProps {
  label: string;
  tone?: SemanticTone;
}

const TONE_MAP: Record<SemanticTone, string> = {
  neutral: 'text-stone-600 dark:text-slate-300',
  success: 'text-emerald-800 dark:text-emerald-300',
  warning: 'text-amber-800 dark:text-amber-300',
  danger: 'text-red-800 dark:text-red-300',
  info: 'text-[#1E3A8A] dark:text-[#93C5FD]',
};

export function StatusText({ label, tone = 'neutral' }: StatusTextProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${TONE_MAP[tone]}`}>
      <span aria-hidden="true">/</span>
      <span>{label}</span>
    </span>
  );
}
