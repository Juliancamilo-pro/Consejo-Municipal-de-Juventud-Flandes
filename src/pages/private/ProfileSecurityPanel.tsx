import { FormEvent, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { recordAuditLog } from '../../services/auditService';
import { mapFirebaseAuthError } from '../../services/authErrorMapper';
import { auth } from '../../services/firebase';
import { UserProfile } from '../../types/models';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface ProfileSecurityPanelProps {
  profile: UserProfile;
  onRevokeAllDevices?: () => Promise<void>;
}

export function ProfileSecurityPanel({ profile, onRevokeAllDevices }: ProfileSecurityPanelProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const strength = evaluatePasswordStrength(newPassword, {
    email: profile.email,
    displayName: profile.displayName,
  });

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!auth.currentUser || !auth.currentUser.email) {
      setNotice({ type: 'err', text: 'No hay una sesión activa válida.' });
      return;
    }
    if (!strength.valid) {
      setNotice({ type: 'err', text: strength.reason || 'La nueva contraseña es muy débil.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ type: 'err', text: 'La confirmación no coincide con la nueva contraseña.' });
      return;
    }

    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await recordAuditLog({
        actorUid: profile.uid,
        actorEmail: profile.email,
        actorRole: profile.role,
        action: 'PASSWORD_CHANGED',
        targetCollection: 'users',
        targetId: profile.uid,
        summary: 'Actualización de contraseña personal desde Mi perfil.',
      });
      setNotice({ type: 'ok', text: 'Contraseña actualizada correctamente. Tu sesión sigue protegida.' });
    } catch (err) {
      setNotice({ type: 'err', text: mapFirebaseAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!onRevokeAllDevices) return;
    setRevoking(true);
    setNotice(null);
    try {
      await onRevokeAllDevices();
    } catch (err) {
      setNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'No fue posible cerrar las sesiones activas.',
      });
      setRevoking(false);
    }
  };

  return (
    <div className="mt-5 space-y-6">
      <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-stone-950 dark:text-white">
              Acceso directo con correo y contraseña
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-slate-400">
              Sesión protegida con cookie httpOnly firmada, aviso previo de inactividad (a los 27 min) y cierre automático tras 30 minutos sin actividad.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-slate-400">
          <KeyRound className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <span>Cambiar contraseña</span>
        </div>

        <Input
          label="Contraseña actual"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Confirma tu contraseña actual"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="cmj-profile-new-password"
              className="block text-sm font-medium text-stone-800 dark:text-slate-200"
            >
              Nueva contraseña
            </label>
            <div className="relative mt-1.5">
              <input
                id="cmj-profile-new-password"
                type={showNew ? 'text' : 'password'}
                required
                minLength={12}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 12 caracteres"
                className="min-h-[44px] w-full rounded-lg border border-stone-300 bg-white py-2.5 pr-11 pl-3.5 text-sm text-stone-900 focus:border-[#7B1832] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#D9B245]"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={showNew ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-white"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">
                Fortaleza: <strong className="text-stone-900 dark:text-white">{strength.label}</strong>
                {strength.reason ? ` · ${strength.reason}` : ''}
              </p>
            )}
          </div>

          <Input
            label="Confirmar nueva contraseña"
            type={showNew ? 'text' : 'password'}
            required
            minLength={12}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la nueva contraseña"
          />
        </div>

        <Button type="submit" loading={busy}>
          Actualizar contraseña
        </Button>
      </form>

      {onRevokeAllDevices && (
        <div className="border-t border-stone-200 pt-5 dark:border-slate-800">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-stone-950 dark:text-white">
                Sesiones activas en otros dispositivos
              </p>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
                Cierra inmediatamente tu sesión en todos los navegadores y equipos donde hayas ingresado.
              </p>
            </div>
            {!confirmRevoke ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setConfirmRevoke(true)}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cerrar sesión en todos los dispositivos</span>
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="danger" loading={revoking} onClick={() => void handleRevokeAll()}>
                  Confirmar cierre global
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmRevoke(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {notice && (
        <p
          role={notice.type === 'err' ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-xs font-medium ${
            notice.type === 'err'
              ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
