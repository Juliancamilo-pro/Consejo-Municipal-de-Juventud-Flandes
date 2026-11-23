import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { translateFirebaseAuthError } from '../lib/firestoreError';
import {
  getActiveSecurityHashes,
  hashEmail,
  SECRETARY_BOOTSTRAP_EMAIL,
  verifyInviteCode,
} from '../lib/security';
import { ensureMinimalStructure, STRUCTURAL_COMMISSIONS } from '../lib/seedData';
import { useToast } from './ToastProvider';
import type { AccessTier, RoleLabel } from '../types/cmj';

type AuthTab = 'login' | 'activate' | 'reset';

interface AllowAccountSnapshot {
  active: boolean;
  accessTier: AccessTier;
  roleLabel: RoleLabel;
  commissionId: string;
  accountProvisioned: boolean;
}

export function AuthModal({
  open,
  initialTab = 'login',
  onClose,
  onSuccess,
  onSessionInitialSecret,
}: {
  open: boolean;
  initialTab?: 'login' | 'change_password';
  onClose: () => void;
  onSuccess: () => void;
  onSessionInitialSecret?: (secret: string) => void;
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<AuthTab>(initialTab === 'change_password' ? 'activate' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [needsAuthSetup, setNeedsAuthSetup] = useState(false);
  const [emailInUseConflict, setEmailInUseConflict] = useState(false);
  const [mfaConflict, setMfaConflict] = useState(false);
  const [userNotFoundSuggestActivate, setUserNotFoundSuggestActivate] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab === 'change_password' ? 'activate' : 'login');
      setErrorMsg(null);
      setErrorHint(null);
      setNeedsAuthSetup(false);
      setEmailInUseConflict(false);
      setMfaConflict(false);
      setUserNotFoundSuggestActivate(false);
      setResetSentTo(null);
    }
  }, [open, initialTab]);

  const clearFeedback = () => {
    setErrorMsg(null);
    setErrorHint(null);
    setNeedsAuthSetup(false);
    setEmailInUseConflict(false);
    setMfaConflict(false);
    setUserNotFoundSuggestActivate(false);
    setResetSentTo(null);
  };

  /**
   * Auto-repara cualquier documento faltante en Firestore para la cuenta del Secretario inicial,
   * garantizando que nunca quede una cuenta "huérfana".
   */
  const ensureSecretaryBootstrapRecords = async (uid: string, normalizedEmail: string) => {
    const emailHash = await hashEmail(normalizedEmail);

    const roleRef = doc(db, 'roles', uid);
    const roleSnap = await getDoc(roleRef);
    const roleData = roleSnap.exists() ? roleSnap.data() : null;
    if (!roleSnap.exists() || roleData?.active !== true || roleData?.accessTier !== 'tier_3_sec') {
      await setDoc(roleRef, {
        uid,
        accessTier: 'tier_3_sec' as AccessTier,
        roleLabel: 'Secretario' as RoleLabel,
        emailHash,
        active: true,
        updatedAt: serverTimestamp(),
      });
    }

    const allowRef = doc(db, 'allowed_accounts', emailHash);
    const allowSnap = await getDoc(allowRef);
    if (!allowSnap.exists() || allowSnap.data()?.active !== true) {
      await setDoc(allowRef, {
        active: true,
        accessTier: 'tier_3_sec' as AccessTier,
        roleLabel: 'Secretario' as RoleLabel,
        commissionId: 'comision-5',
        accountProvisioned: true,
        mustChangePassword: false,
        updatedAt: serverTimestamp(),
      });
    }

    const pubRef = doc(db, 'public_councilors', uid);
    if (!(await getDoc(pubRef)).exists()) {
      await setDoc(pubRef, {
        uid,
        fullName: 'Secretario General CMJ',
        roleLabel: 'Secretario' as RoleLabel,
        commissionId: 'comision-5',
        commissionName: 'Comisión 5',
        bio: 'Secretario del Consejo Municipal de Juventudes de Flandes, Tolima.',
        photoUrl: '',
        active: true,
        displayOrder: 3,
        updatedAt: serverTimestamp(),
      });
    }

    const privRef = doc(db, 'councilor_private', uid);
    if (!(await getDoc(privRef)).exists()) {
      await setDoc(privRef, {
        uid,
        email: normalizedEmail,
        phone: '',
        accessTier: 'tier_3_sec' as AccessTier,
        roleLabel: 'Secretario' as RoleLabel,
        commissionId: 'comision-5',
        active: true,
        mustChangePassword: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const secHashRef = doc(db, 'portal_security', 'public_hashes');
    if (!(await getDoc(secHashRef)).exists()) {
      const defaults = await getActiveSecurityHashes();
      await setDoc(secHashRef, {
        inviteCodeHash: defaults.inviteCodeHash,
        initialPasswordHash: defaults.initialPasswordHash,
        salt: defaults.salt,
        updatedByUid: uid,
        updatedAt: serverTimestamp(),
      });
    }

    await ensureMinimalStructure();
  };

  /**
   * Auto-repara roles, perfil público y ficha privada de cualquier consejero invitado
   * cuya cuenta ya exista en Firebase Auth pero le falten documentos en Firestore.
   */
  const ensureInvitedCouncilorRecords = async (
    uid: string,
    normalizedEmail: string,
    emailHash: string,
    allowData: AllowAccountSnapshot
  ) => {
    const roleRef = doc(db, 'roles', uid);
    if (!(await getDoc(roleRef)).exists()) {
      await setDoc(roleRef, {
        uid,
        accessTier: allowData.accessTier,
        roleLabel: allowData.roleLabel,
        emailHash,
        active: true,
        updatedAt: serverTimestamp(),
      });
    }

    const privRef = doc(db, 'councilor_private', uid);
    if (!(await getDoc(privRef)).exists()) {
      await setDoc(privRef, {
        uid,
        email: normalizedEmail,
        phone: '',
        accessTier: allowData.accessTier,
        roleLabel: allowData.roleLabel,
        commissionId: allowData.commissionId || 'comision-1',
        active: true,
        mustChangePassword: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const pubRef = doc(db, 'public_councilors', uid);
    if (!(await getDoc(pubRef)).exists()) {
      const comm =
        STRUCTURAL_COMMISSIONS.find((c) => c.id === allowData.commissionId) ||
        STRUCTURAL_COMMISSIONS[0];
      const fallbackName =
        normalizedEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Consejero CMJ';
      await setDoc(pubRef, {
        uid,
        fullName: fallbackName,
        roleLabel: allowData.roleLabel,
        commissionId: comm.id,
        commissionName: comm.name,
        bio: '',
        photoUrl: '',
        active: true,
        displayOrder: 10,
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await updateDoc(doc(db, 'allowed_accounts', emailHash), {
        accountProvisioned: true,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignorar si ya estaba sincronizado
    }
  };

  const checkAllowlistStatus = async (normalizedEmail: string) => {
    const emailHash = await hashEmail(normalizedEmail);
    const isBootstrapEmail = normalizedEmail === SECRETARY_BOOTSTRAP_EMAIL;
    let allowData: AllowAccountSnapshot | null = null;
    try {
      const allowSnap = await getDoc(doc(db, 'allowed_accounts', emailHash));
      if (allowSnap.exists()) {
        allowData = allowSnap.data() as AllowAccountSnapshot;
      }
    } catch {
      // Sin conexión o caché no disponible
    }
    return { emailHash, isBootstrapEmail, allowData };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setErrorMsg('Ingresa tu correo electrónico y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { emailHash, isBootstrapEmail, allowData } = await checkAllowlistStatus(normalizedEmail);

      if (!isBootstrapEmail && (!allowData || !allowData.active)) {
        setErrorMsg('Este correo no figura habilitado en el directorio oficial del CMJ Flandes.');
        setErrorHint(
          'Solicita al Secretario, Presidente o Vicepresidente que agregue y active tu correo en el módulo "Usuarios y Mesa".'
        );
        setLoading(false);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (isBootstrapEmail) {
        onSessionInitialSecret?.(password);
        await ensureSecretaryBootstrapRecords(cred.user.uid, normalizedEmail);
      } else if (allowData) {
        await ensureInvitedCouncilorRecords(cred.user.uid, normalizedEmail, emailHash, allowData);
      }

      showToast('Bienvenido al portal privado del CMJ Flandes', 'success');
      onSuccess();
      onClose();
    } catch (authErr) {
      const translated = translateFirebaseAuthError(authErr);
      setNeedsAuthSetup(Boolean(translated.needsConsoleAuthSetup));
      setMfaConflict(Boolean(translated.isMfaRequired));
      setErrorMsg(translated.message);
      setErrorHint(translated.hint || null);
      if (translated.code === 'auth/user-not-found') {
        setUserNotFoundSuggestActivate(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivateOrChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!inviteCode.trim()) {
      setErrorMsg('Escribe el código de invitación institucional del CMJ.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setLoading(true);
    try {
      const validInvite = await verifyInviteCode(inviteCode);
      if (!validInvite) {
        setErrorMsg('El código de invitación no es válido.');
        setErrorHint('Solicita el código vigente a la Secretaría o Presidencia del CMJ.');
        setLoading(false);
        return;
      }

      // Si el consejero ya inició sesión, actualizamos directamente su contraseña actual
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        try {
          await updateDoc(doc(db, 'councilor_private', auth.currentUser.uid), {
            mustChangePassword: false,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // No bloqueante
        }
        showToast('Contraseña actualizada correctamente', 'success');
        onSuccess();
        onClose();
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setErrorMsg('Ingresa tu correo electrónico registrado para activar tu cuenta.');
        setLoading(false);
        return;
      }

      const { emailHash, isBootstrapEmail, allowData } = await checkAllowlistStatus(normalizedEmail);
      if (!isBootstrapEmail && (!allowData || !allowData.active)) {
        setErrorMsg('Tu correo no figura activo en el directorio de consejeros.');
        setErrorHint('Pide a la Secretaría que registre tu correo antes de activar tu cuenta.');
        setLoading(false);
        return;
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, newPassword);
        if (isBootstrapEmail) {
          await ensureSecretaryBootstrapRecords(cred.user.uid, normalizedEmail);
        } else if (allowData) {
          await ensureInvitedCouncilorRecords(cred.user.uid, normalizedEmail, emailHash, allowData);
        }
        showToast('Cuenta activada e ingreso exitoso', 'success');
        onSuccess();
        onClose();
      } catch (err) {
        const translated = translateFirebaseAuthError(err);
        setNeedsAuthSetup(Boolean(translated.needsConsoleAuthSetup));
        if (translated.isEmailAlreadyInUse) {
          setEmailInUseConflict(true);
          setErrorMsg(
            'Este correo ya tenía una cuenta activada en Authentication.'
          );
          setErrorHint(
            'No puedes activarla dos veces con este formulario. Inicia sesión con tu contraseña o envía un correo de restablecimiento ahora mismo.'
          );
        } else {
          setErrorMsg(translated.message);
          setErrorHint(translated.hint || null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerPasswordReset = async (targetEmailRaw?: string) => {
    clearFeedback();
    const normalizedEmail = (targetEmailRaw ?? email).trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMsg('Escribe tu correo electrónico para enviarte el enlace de recuperación.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setResetSentTo(normalizedEmail);
      setTab('reset');
      showToast('Correo de recuperación enviado', 'success', `Revisa la bandeja de ${normalizedEmail}`);
    } catch (err) {
      const translated = translateFirebaseAuthError(err);
      setNeedsAuthSetup(Boolean(translated.needsConsoleAuthSetup));
      setErrorMsg(translated.message);
      setErrorHint(translated.hint || null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl my-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-cyan-400">
                  Portal Privado · CMJ Flandes
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {tab === 'login'
                    ? 'Iniciar sesión'
                    : tab === 'activate'
                    ? auth.currentUser
                      ? 'Actualizar mi contraseña'
                      : 'Primer ingreso / Activar cuenta'
                    : 'Recuperar contraseña'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar ventana"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Selector de los 3 flujos */}
            <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  clearFeedback();
                }}
                className={`rounded-lg py-2 px-1.5 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('activate');
                  clearFeedback();
                }}
                className={`rounded-lg py-2 px-1.5 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer truncate ${
                  tab === 'activate'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {auth.currentUser ? 'Cambiar clave' : 'Activar cuenta'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('reset');
                  clearFeedback();
                }}
                className={`rounded-lg py-2 px-1.5 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer truncate ${
                  tab === 'reset'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ¿Olvidaste clave?
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold leading-relaxed">{errorMsg}</p>
                    {errorHint && <p className="text-[11px] opacity-95 leading-relaxed">{errorHint}</p>}
                    {needsAuthSetup && (
                      <p className="text-[11px] font-medium opacity-95">
                        Ruta: Firebase Console → Authentication → Sign-in method → Correo electrónico/contraseña → Habilitar.
                      </p>
                    )}
                  </div>
                </div>

                {emailInUseConflict && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTab('login');
                        clearFeedback();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 text-[11px] font-semibold cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Iniciar sesión
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => triggerPasswordReset(email)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-rose-700 cursor-pointer disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Restablecer contraseña por correo
                    </button>
                  </div>
                )}

                {mfaConflict && (
                  <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 border border-rose-200 dark:border-rose-900/50 p-2.5 space-y-2 text-[11px]">
                    <p className="font-semibold text-rose-800 dark:text-rose-200">
                      Cómo quitar este bloqueo en 30 segundos:
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-rose-700 dark:text-rose-300">
                      <li>Abre Firebase Console → Authentication → Users y elimina esta cuenta con MFA.</li>
                      <li>En Authentication → Settings → Multi-factor authentication, verifica que no sea obligatorio.</li>
                      <li>Regresa aquí y pulsa el botón inferior para reactivar tu cuenta sin verificación en dos pasos.</li>
                    </ol>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('activate');
                        clearFeedback();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-blue-700 cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Ya la limpié, ir a Activar cuenta
                    </button>
                  </div>
                )}

                {userNotFoundSuggestActivate && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTab('activate');
                        clearFeedback();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-blue-700 cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Ir a Primer ingreso / Activar cuenta
                    </button>
                  </div>
                )}
              </div>
            )}

            {resetSentTo && (
              <div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Enlace enviado a {resetSentTo}</p>
                  <p className="mt-1 opacity-90 leading-relaxed">
                    Revisa tu bandeja de entrada o carpeta de spam, abre el enlace oficial de Firebase para elegir tu nueva contraseña y luego vuelve aquí a Iniciar sesión.
                  </p>
                </div>
              </div>
            )}

            {tab === 'login' && (
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Correo electrónico registrado
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="consejero@correo.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('reset');
                        clearFeedback();
                      }}
                      className="text-[11px] font-medium text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Validando acceso...' : 'Ingresar al portal privado'}
                </button>

                <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tu sesión permanecerá abierta en este equipo. Si es tu primera vez en el portal, usa la pestaña{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('activate');
                      clearFeedback();
                    }}
                    className="font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Activar cuenta
                  </button>
                  .
                </p>
              </form>
            )}

            {tab === 'activate' && (
              <form onSubmit={handleActivateOrChangePassword} className="mt-5 space-y-3.5">
                {!auth.currentUser && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Correo del consejero
                    </label>
                    <div className="relative">
                      <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Código de invitación del CMJ
                  </label>
                  <div className="relative">
                    <ShieldCheck className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showInvite ? 'text' : 'password'}
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Escribe el código institucional"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInvite((v) => !v)}
                      aria-label="Mostrar u ocultar código"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showInvite ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nueva contraseña personal
                  </label>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass((v) => !v)}
                      aria-label="Mostrar u ocultar nueva contraseña"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirmar nueva contraseña
                  </label>
                  <div className="relative">
                    <KeyRound className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite tu contraseña"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading
                    ? 'Configurando cuenta...'
                    : auth.currentUser
                    ? 'Actualizar contraseña'
                    : 'Activar cuenta e ingresar'}
                </button>
              </form>
            )}

            {tab === 'reset' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  triggerPasswordReset();
                }}
                className="mt-5 space-y-4"
              >
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Ingresa tu correo electrónico registrado (incluido el correo de Secretaría o Presidencia) y Firebase te enviará un enlace directo para asignar una contraseña nueva sin perder tus datos ni permisos.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {loading ? 'Enviando enlace...' : 'Enviar enlace de restablecimiento'}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
