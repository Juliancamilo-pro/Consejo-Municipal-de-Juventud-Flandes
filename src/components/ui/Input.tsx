import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';

interface BaseFieldProps {
  label: string;
  hint?: string;
  error?: string;
}

type InputProps = BaseFieldProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>;

const FIELD_CLASSES =
  'mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-[#7B1832] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#D9B245]';

export function Input({ label, hint, error, id, required, className = '', ...rest }: InputProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const feedbackId = `${fieldId}-feedback`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-stone-800 dark:text-slate-200">
        {label}
        {required && (
          <span className="ml-0.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? feedbackId : undefined}
        className={`${FIELD_CLASSES} min-h-[44px] ${error ? 'border-red-600 dark:border-red-500' : ''} ${className}`}
        {...rest}
      />
      {hint && !error && (
        <p id={feedbackId} className="mt-1 text-xs text-stone-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={feedbackId} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function Textarea({
  label,
  hint,
  error,
  id,
  required,
  className = '',
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const feedbackId = `${fieldId}-feedback`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-stone-800 dark:text-slate-200">
        {label}
        {required && (
          <span className="ml-0.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <textarea
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? feedbackId : undefined}
        className={`${FIELD_CLASSES} ${error ? 'border-red-600 dark:border-red-500' : ''} ${className}`}
        {...rest}
      />
      {hint && !error && (
        <p id={feedbackId} className="mt-1 text-xs text-stone-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={feedbackId} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  required,
  className = '',
  children,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const feedbackId = `${fieldId}-feedback`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-stone-800 dark:text-slate-200">
        {label}
        {required && (
          <span className="ml-0.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <select
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? feedbackId : undefined}
        className={`${FIELD_CLASSES} min-h-[44px] ${error ? 'border-red-600 dark:border-red-500' : ''} ${className}`}
        {...rest}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={feedbackId} className="mt-1 text-xs text-stone-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={feedbackId} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
