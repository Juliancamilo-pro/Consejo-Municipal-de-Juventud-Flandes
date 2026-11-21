import { Check } from 'lucide-react';

export interface StepItem {
  id: string;
  label: string;
  description?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, currentStepIndex, onStepClick }: StepperProps) {
  return (
    <ol aria-label="Pasos del proceso" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const done = index < currentStepIndex;
        const active = index === currentStepIndex;
        return (
          <li key={step.id}>
            <button
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick?.(index)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                active
                  ? 'border-[#7B1832] bg-[#7B1832]/5 dark:border-[#D9B245] dark:bg-[#C59B27]/10'
                  : done
                    ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/60 dark:bg-emerald-950/30'
                    : 'border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? 'bg-[#7B1832] text-white dark:bg-[#D9B245] dark:text-slate-950'
                    : done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-stone-900 dark:text-slate-100">
                  {step.label}
                </span>
                {step.description && (
                  <span className="mt-0.5 block text-[11px] text-stone-500 dark:text-slate-400">
                    {step.description}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
