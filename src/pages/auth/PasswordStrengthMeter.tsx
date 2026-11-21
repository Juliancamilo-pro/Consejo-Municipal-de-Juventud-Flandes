import { Check, X } from 'lucide-react';
import { PasswordStrengthResult } from '../../utils/passwordStrength';

const STRENGTH_COLORS = [
  'bg-red-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-[#1E3A8A] dark:bg-[#60A5FA]',
  'bg-emerald-600',
];

export function PasswordStrengthMeter({ strength }: { strength: PasswordStrengthResult }) {
  const criteria = [
    { ok: strength.checks.minLength, text: 'Mínimo 12 caracteres' },
    { ok: strength.checks.hasUpperAndLower, text: 'Mayúsculas y minúsculas' },
    { ok: strength.checks.hasNumber, text: 'Al menos un número' },
    { ok: strength.checks.notCommonOrPersonal, text: 'Sin correo, nombre ni claves comunes' },
  ];

  return (
    <div
      id="cmj-password-strength"
      className="mt-2.5 space-y-2 rounded-lg border border-stone-200 bg-[#FAF8F4] p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60"
    >
      <div className="flex items-center justify-between">
        <span className="text-stone-600 dark:text-slate-400">Seguridad de la contraseña</span>
        <span className="font-semibold text-stone-900 dark:text-white">{strength.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-1.5 rounded-full transition-colors ${
              strength.score >= step ? STRENGTH_COLORS[strength.score] : 'bg-stone-200 dark:bg-slate-800'
            }`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-1 pt-1 sm:grid-cols-2">
        {criteria.map((item) => (
          <li
            key={item.text}
            className={`flex items-center gap-1.5 ${
              item.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-stone-500 dark:text-slate-400'
            }`}
          >
            {item.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
            )}
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
