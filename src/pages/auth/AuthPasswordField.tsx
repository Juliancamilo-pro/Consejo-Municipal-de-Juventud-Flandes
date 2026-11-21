import { Eye, EyeOff, Lock } from 'lucide-react';
import { PasswordStrengthResult } from '../../utils/passwordStrength';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface AuthPasswordFieldProps {
  mode: 'login' | 'register';
  password: string;
  showPassword: boolean;
  strength: PasswordStrengthResult;
  onChangePassword: (value: string) => void;
  onToggleShowPassword: () => void;
  onForgotPassword: () => void;
}

export function AuthPasswordField({
  mode,
  password,
  showPassword,
  strength,
  onChangePassword,
  onToggleShowPassword,
  onForgotPassword,
}: AuthPasswordFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="cmj-auth-password"
          className="flex items-center gap-1.5 text-sm font-medium text-stone-800 dark:text-slate-200"
        >
          <Lock className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <span>Contraseña</span>
        </label>

        {mode === 'login' && (
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-xs font-medium text-[#1E3A8A] transition-colors hover:underline focus-visible:underline dark:text-[#60A5FA]"
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </div>

      <div className="relative mt-1.5">
        <input
          id="cmj-auth-password"
          type={showPassword ? 'text' : 'password'}
          required
          minLength={mode === 'login' ? 6 : 12}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => onChangePassword(e.target.value)}
          placeholder={mode === 'login' ? 'Ingresa tu contraseña' : 'Mínimo 12 caracteres'}
          aria-describedby={mode === 'register' ? 'cmj-password-strength' : undefined}
          className="min-h-[44px] w-full rounded-lg border border-stone-300 bg-white py-2.5 pr-11 pl-3.5 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-[#7B1832] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B1832]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#D9B245] dark:focus-visible:ring-[#D9B245]/20"
        />
        <button
          type="button"
          onClick={onToggleShowPassword}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-500 transition-colors hover:text-stone-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {mode === 'register' && <PasswordStrengthMeter strength={strength} />}
    </div>
  );
}
