import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#7B1832] text-white shadow-xs hover:bg-[#611227] dark:bg-[#A62B4B] dark:hover:bg-[#BD385B]',
  secondary:
    'bg-[#1E3A8A] text-white shadow-xs hover:bg-[#172D6B] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]',
  gold:
    'bg-[#C59B27] text-stone-950 shadow-xs hover:bg-[#B28B20] dark:bg-[#D9B245] dark:text-slate-950 dark:hover:bg-[#E5C158]',
  outline:
    'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  ghost:
    'bg-transparent text-stone-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800',
  danger:
    'bg-red-700 text-white shadow-xs hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[38px] px-3.5 py-1.5 text-xs',
  md: 'min-h-[44px] px-5 py-2.5 text-sm',
  lg: 'min-h-[48px] px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
