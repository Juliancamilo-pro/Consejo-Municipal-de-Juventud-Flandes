import { FormEvent, useState } from 'react';
import { ArrowLeft, KeyRound, LogIn, Mail, UserPlus } from 'lucide-react';
import { LegacySecondFactorError } from '../../services/authActions';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { AuthErrorNotice } from './AuthErrorNotice';
import { AuthPasswordField } from './AuthPasswordField';
import { LegacyFactorCleanupCard } from './LegacyFactorCleanupCard';

export type AuthView = 'login' | 'register' | 'recover';

interface AuthCredentialsFormProps {
  view: AuthView;
  onChangeView: (view: AuthView) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onResolveLegacyFactor?: (input: {
    resolver: LegacySecondFactorError['resolver'];
    email: string;
    factorId: string;
    hintUid: string;
    code: string;
    verificationId?: string;
  }) => Promise<number>;
  onRegister: (input: {
    displayName: string;
    email: string;
    password: string;
    invitationCode: string;
    sector?: string;
  }) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthCredentialsForm({
  view,
  onChangeView,
  onLogin,
  onResolveLegacyFactor,
  onRegister,
  onResetPassword,
}: AuthCredentialsFormProps) {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [sector, setSector] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerDisabledError, setProviderDisabledError] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [legacyChallenge, setLegacyChallenge] = useState<LegacySecondFactorError | null>(null);

  const strength = evaluatePasswordStrength(password, { email, displayName });
  const emailInlineError =
    emailTouched && email.trim().length > 0 && !EMAIL_REGEX.test(email.trim())
      ? 'Escribe un correo electrónico válido (por ejemplo: consejero@ejemplo.com).'
      : null;

  const switchView = (next: AuthView) => {
    setErrorMsg(null);
    setProviderDisabledError(false);
    setSuccessMsg(null);
    setLegacyChallenge(null);
    setEmailTouched(false);
    setShowPassword(false);
    onChangeView(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setErrorMsg(null);
    setProviderDisabledError(false);
    setSuccessMsg(null);

    if (!EMAIL_REGEX.test(email.trim())) {
      setErrorMsg('Verifica el formato de tu correo electrónico institucional.');
      return;
    }
    if (view === 'register' && !strength.valid) {
      setErrorMsg(strength.reason || 'La contraseña no cumple con los requisitos de seguridad.');
      return;
    }

    setSubmitting(true);
    try {
      if (view === 'login') {
        await onLogin(email, password);
      } else if (view === 'register') {
        await onRegister({ displayName, email, password, invitationCode, sector });
      } else {
        await onResetPassword(email);
        setSuccessMsg(
          'Solicitud procesada. Si este correo corresponde a una cuenta activa del Consejo, recibirás en pocos minutos un enlace de restablecimiento (revisa también tu carpeta de correo no deseado).',
        );
      }
    } catch (err) {
      if (err instanceof LegacySecondFactorError && onResolveLegacyFactor) {
        setLegacyChallenge(err);
        return;
      }
      const msg = err instanceof Error ? err.message : 'No fue posible completar la autenticación.';
      setErrorMsg(msg);
      if (msg.includes('Firebase Console') || msg.includes('Sign-in method')) {
        setProviderDisabledError(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-5 border-stone-200/90 shadow-sm dark:border-slate-800">
      <div className="mb-5 border-b border-stone-200 pb-4 dark:border-slate-800">
        <p className="text-[11px] font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
          {view === 'login'
            ? 'Acceso institucional'
            : view === 'register'
              ? 'Nuevo consejero'
              : 'Asistencia de acceso'}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-stone-950 dark:text-white">
          {view === 'login'
            ? 'Ingreso al portal'
            : view === 'register'
              ? 'Solicitud de registro'
              : 'Recuperar contraseña'}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-slate-400">
          {view === 'login'
            ? 'Ingresa con tu correo y contraseña institucionales. Tras 5 intentos fallidos el acceso se bloquea 15 minutos.'
            : view === 'register'
              ? 'Completa tus datos e ingresa el código de invitación suministrado por el Secretario administrador.'
              : 'Te enviaremos un enlace seguro a tu correo registrado para definir una nueva contraseña.'}
        </p>
      </div>

      {legacyChallenge && onResolveLegacyFactor ? (
        <LegacyFactorCleanupCard
          challenge={legacyChallenge}
          onResolve={onResolveLegacyFactor}
          onCancel={() => {
            setLegacyChallenge(null);
            setErrorMsg(null);
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'register' && (
            <Input
              label="Nombre completo"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nombres y apellidos completos"
            />
          )}

          <div>
            <label
              htmlFor="cmj-auth-email"
              className="flex items-center gap-1.5 text-sm font-medium text-stone-800 dark:text-slate-200"
            >
              <Mail className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
              <span>Correo electrónico institucional</span>
            </label>
            <input
              id="cmj-auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(emailInlineError)}
              aria-describedby={emailInlineError ? 'cmj-auth-email-error' : undefined}
              onBlur={() => setEmailTouched(true)}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="consejero@ejemplo.com"
              className={`mt-1.5 min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:outline-none focus-visible:ring-2 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
                emailInlineError
                  ? 'border-red-600 focus-visible:ring-red-500/25 dark:border-red-500'
                  : 'border-stone-300 focus:border-[#7B1832] focus-visible:ring-[#7B1832]/20 dark:border-slate-700 dark:focus:border-[#D9B245] dark:focus-visible:ring-[#D9B245]/20'
              }`}
            />
            {emailInlineError && (
              <p id="cmj-auth-email-error" role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">
                {emailInlineError}
              </p>
            )}
          </div>

          {view === 'register' && (
            <>
              <Input
                label="Sector o lista representada (opcional)"
                maxLength={120}
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ej. Lista independiente, Proceso organizativo"
              />
              <Input
                label="Código de invitación"
                type="password"
                required
                autoComplete="off"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                hint="Validado en el servidor. 5 intentos fallidos bloquean 15 minutos."
              />
            </>
          )}

          {view !== 'recover' && (
            <AuthPasswordField
              mode={view}
              password={password}
              showPassword={showPassword}
              strength={strength}
              onChangePassword={setPassword}
              onToggleShowPassword={() => setShowPassword((prev) => !prev)}
              onForgotPassword={() => switchView('recover')}
            />
          )}

          <AuthErrorNotice
            errorMsg={errorMsg}
            providerDisabledError={providerDisabledError}
            successMsg={successMsg}
          />

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" loading={submitting} className="w-full sm:w-auto">
              {view === 'login' && (
                <>
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Ingresar al portal</span>
                </>
              )}
              {view === 'register' && (
                <>
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Solicitar registro</span>
                </>
              )}
              {view === 'recover' && (
                <>
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>Enviar enlace de recuperación</span>
                </>
              )}
            </Button>

            {view === 'recover' && (
              <button
                type="button"
                onClick={() => switchView('login')}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:underline dark:text-slate-300 dark:hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Volver a iniciar sesión</span>
              </button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
