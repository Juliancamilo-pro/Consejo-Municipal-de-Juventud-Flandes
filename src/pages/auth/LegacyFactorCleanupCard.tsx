import { FormEvent, useState } from 'react';
import { PhoneMultiFactorGenerator } from 'firebase/auth';
import { HelpCircle, KeyRound, ShieldOff, Smartphone } from 'lucide-react';
import {
  LegacySecondFactorError,
  sendLegacySmsCleanupCode,
} from '../../services/authActions';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface LegacyFactorCleanupCardProps {
  challenge: LegacySecondFactorError;
  onResolve: (input: {
    resolver: LegacySecondFactorError['resolver'];
    email: string;
    factorId: string;
    hintUid: string;
    code: string;
    verificationId?: string;
  }) => Promise<number>;
  onCancel: () => void;
}

export function LegacyFactorCleanupCard({
  challenge,
  onResolve,
  onCancel,
}: LegacyFactorCleanupCardProps) {
  const hints = challenge.hints;
  const [selectedUid, setSelectedUid] = useState(hints[0]?.uid || '');
  const activeHint = hints.find((h) => h.uid === selectedUid) || hints[0];
  const isPhone = activeHint?.factorId === PhoneMultiFactorGenerator.FACTOR_ID;

  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [sendingSms, setSendingSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLostCodeHelp, setShowLostCodeHelp] = useState(false);

  const handleSendPhoneCode = async () => {
    if (!activeHint) return;
    setSendingSms(true);
    setErrorMsg(null);
    try {
      const vid = await sendLegacySmsCleanupCode(
        challenge.resolver,
        activeHint,
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

  const handleSubmit = async (e: FormEvent) => {
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
        resolver: challenge.resolver,
        email: challenge.email,
        factorId: activeHint.factorId,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="flex items-center gap-1.5 font-semibold">
          <ShieldOff className="h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <span>Verificación antigua detectada en Firebase</span>
        </p>
        <p className="mt-1">
          La plataforma ya usa solo correo y contraseña, pero tu cuenta{' '}
          <strong>{challenge.email}</strong> conservaba una verificación anterior en Google
          Firebase. Confirma tu código de 6 dígitos <strong>una última vez</strong> para borrarla
          automáticamente y entrar directo en adelante.
        </p>
      </div>

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
                {hint.displayName || (hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID ? 'Celular' : 'Aplicación')}
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

      <div className="border-t border-stone-200 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowLostCodeHelp((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#93C5FD]"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>¿Perdiste el acceso a la aplicación o teléfono anterior?</span>
        </button>

        {showLostCodeHelp && (
          <div className="mt-2.5 space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3 text-[11px] leading-relaxed text-stone-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            <p className="font-semibold text-stone-900 dark:text-white">
              Cómo limpiarlo directo en Firebase Console (proyecto sixth-bridge-m01dl):
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                En <strong>Authentication → Settings → Multifactor authentication</strong>, verifica
                que la autenticación multifactor esté desactivada.
              </li>
              <li>
                En <strong>Authentication → Users</strong>, elimina la cuenta antigua de{' '}
                <strong>{challenge.email}</strong> (anota primero su UID).
              </li>
              <li>
                En <strong>Firestore Database</strong>, elimina <code>settings/bootstrap</code> y{' '}
                <code>users/UID_anterior</code> si era la cuenta administradora, luego vuelve aquí e
                inicia sesión con tu contraseña nueva para reactivarla sin verificación adicional.
              </li>
            </ol>
          </div>
        )}
      </div>
    </form>
  );
}
