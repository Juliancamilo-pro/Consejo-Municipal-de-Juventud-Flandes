import { FormEvent, useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import { LegacyFactorChallenge, sendLegacyCleanupSms } from '../../services/authActions';
import { rescueClearAdminMfaOnServer } from '../../services/sessionApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface LegacyFactorCleanupCardProps {
  challenge: LegacyFactorChallenge;
  onResolve: (input: {
    challenge: LegacyFactorChallenge;
    email: string;
    hintUid: string;
    code: string;
    verificationId?: string;
  }) => Promise<number>;
  onRescueSuccess: (email: string, message: string) => void;
  onCancel: () => void;
}

export function LegacyFactorCleanupCard({
  challenge,
  onResolve,
  onRescueSuccess,
  onCancel,
}: LegacyFactorCleanupCardProps) {
  const hints = challenge.hints;
  const [mode, setMode] = useState<'code' | 'rescue'>('code');
  const [selectedUid, setSelectedUid] = useState(hints[0]?.uid || '');
  const activeHint = hints.find((h) => h.uid === selectedUid) || hints[0];
  const isPhone = activeHint?.kind === 'phone';

  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [sendingSms, setSendingSms] = useState(false);
  const [rescueToken, setRescueToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const switchMode = (nextMode: 'code' | 'rescue') => {
    setMode(nextMode);
    setErrorMsg(null);
  };

  const handleSendPhoneCode = async () => {
    if (!activeHint) return;
    setSendingSms(true);
    setErrorMsg(null);
    try {
      const vid = await sendLegacyCleanupSms(
        challenge,
        activeHint.uid,
        'cmj-legacy-factor-recaptcha',
      );
      setVerificationId(vid);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No fue posible enviar el código al celular.',
      );
    } finally {
      setSendingSms(false);
    }
  };

  const handleSubmitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeHint) return;
    if (isPhone && !verificationId) {
      setErrorMsg('Primero solicita el envío del código a tu celular.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onResolve({
        challenge,
        email: challenge.email,
        hintUid: activeHint.uid,
        code,
        ...(verificationId ? { verificationId } : {}),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'El código ingresado no es válido.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRescue = async (e: FormEvent) => {
    e.preventDefault();
    const cleanToken = rescueToken.trim();
    if (!cleanToken) {
      setErrorMsg('Ingresa la clave de rescate para continuar.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await rescueClearAdminMfaOnServer(challenge.email, cleanToken);
      setRescueToken('');
      onRescueSuccess(
        challenge.email,
        result.message || 'Listo, ya puedes entrar con tu correo y contraseña.',
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo quitar la verificación antigua en este momento.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="flex items-center gap-1.5 font-semibold">
          <ShieldOff className="h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <span>Verificación antigua detectada en Firebase</span>
        </p>
        <p className="mt-1">
          La plataforma ya usa solo correo y contraseña, pero tu cuenta{' '}
          <strong>{challenge.email}</strong> conservaba una verificación anterior. Elige cómo
          quitarla una sola vez para entrar directo en adelante.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="tablist" aria-label="Opciones para quitar verificación antigua">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'code'}
          onClick={() => switchMode('code')}
          className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
            mode === 'code'
              ? 'border-[#7B1832] bg-[#7B1832]/10 text-[#7B1832] dark:border-[#D9B245] dark:bg-[#D9B245]/15 dark:text-[#D9B245]'
              : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          Tengo el código de 6 dígitos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'rescue'}
          onClick={() => switchMode('rescue')}
          className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
            mode === 'rescue'
              ? 'border-[#7B1832] bg-[#7B1832]/10 text-[#7B1832] dark:border-[#D9B245] dark:bg-[#D9B245]/15 dark:text-[#D9B245]'
              : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          No tengo el código
        </button>
      </div>

      {mode === 'code' ? (
        <form onSubmit={handleSubmitCode} className="space-y-4">
          {hints.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-stone-700 dark:text-slate-300">
                Elige el método guardado anteriormente:
              </p>
              <div className="flex flex-wrap gap-2">
                {hints.map((hint) => (
                  <button
                    key={hint.uid}
                    type="button"
                    onClick={() => {
                      setSelectedUid(hint.uid);
                      setVerificationId(null);
                      setErrorMsg(null);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      hint.uid === activeHint?.uid
                        ? 'border-[#7B1832] bg-[#7B1832]/10 text-[#7B1832] dark:border-[#D9B245] dark:bg-[#D9B245]/15 dark:text-[#D9B245]'
                        : 'border-stone-300 text-stone-700 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {hint.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isPhone && !verificationId && (
            <div>
              <Button
                type="button"
                variant="outline"
                loading={sendingSms}
                onClick={() => void handleSendPhoneCode()}
              >
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                <span>Enviar código único al celular guardado</span>
              </Button>
            </div>
          )}

          <div id="cmj-legacy-factor-recaptcha" />

          <Input
            label={
              isPhone
                ? 'Código de 6 dígitos recibido en el celular'
                : 'Código de 6 dígitos de tu aplicación autenticadora'
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
          />

          {errorMsg && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            >
              {errorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="submit" loading={submitting}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Quitar verificación antigua e ingresar</span>
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Volver
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmitRescue} className="space-y-4">
          <p className="text-xs leading-relaxed text-stone-600 dark:text-slate-300">
            Si administras la plataforma y ya no tienes el código de 6 dígitos, ingresa la clave de
            rescate temporal configurada en el servidor para limpiar esta cuenta.
          </p>

          <Input
            label="Clave de rescate"
            type="password"
            required
            autoComplete="off"
            value={rescueToken}
            onChange={(e) => setRescueToken(e.target.value)}
            placeholder="Ingresa la clave de rescate"
          />

          {errorMsg && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
            >
              {errorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="submit" loading={submitting}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Quitar verificación antigua</span>
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Volver
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
