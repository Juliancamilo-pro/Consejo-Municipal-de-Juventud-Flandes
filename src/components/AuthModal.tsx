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
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  ApiRequestError,
  apiRequest,
  notifyAuthSync,
  setAuthTokenInMemory,
  type SessionUser,
} from '../lib/apiClient';
import { STRUCTURAL_COMMISSIONS } from '../lib/seedData';
import type { Commission } from '../types/cmj';
import { BrandLogo } from './BrandLogo';
import { useToast } from './ToastProvider';

type AuthTab = 'login' | 'register' | 'activate' | 'help';

const SELF_REG_CARGOS = [
  'Consejero',
  'Consejero Departamental',
  'Presidente',
  'Vicepresidente',
  'Secretario',
  'Delegado / Otro',
];

export function AuthModal({
  open,
  initialTab = 'login',
  currentUser,
  commissions = [],
  onClose,
  onAuthenticated,
  onSessionInitialSecret,
}: {
  open: boolean;
  initialTab?: 'login' | 'change_password';
  currentUser: SessionUser | null;
  commissions?: Commission[];
  onClose: () => void;
  onAuthenticated: (user: SessionUser) => void;
  onSessionInitialSecret?: (secret: string) => void;
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<AuthTab>(
    initialTab === 'change_password' ? 'activate' : 'login'
  );
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
  const [suggestActivate, setSuggestActivate] = useState(false);

  // Estado de auto-registro
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCargo, setRegCargo] = useState('Consejero');
  const [regCommissionId, setRegCommissionId] = useState('');
  const [regIsCoordinator, setRegIsCoordinator] = useState<'no' | 'si'>('no');
  const [regInitialPassword, setRegInitialPassword] = useState('');
  const [regActivationCode, setRegActivationCode] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegCode, setShowRegCode] = useState(false);
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  const availableCommissions =
    commissions.length > 0 ? commissions : STRUCTURAL_COMMISSIONS;

  useEffect(() => {
    if (open) {
      setTab(initialTab === 'change_password' ? 'activate' : 'login');
      setErrorMsg(null);
      setErrorHint(null);
      setSuggestActivate(false);
      setRegSuccessMsg(null);
    }
  }, [open, initialTab]);

  const clearFeedback = () => {
    setErrorMsg(null);
    setErrorHint(null);
    setSuggestActivate(false);
    setRegSuccessMsg(null);
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
      const res = await apiRequest<{ token: string; user: SessionUser }>('/api/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password },
        skipRefresh: true,
      });

      setAuthTokenInMemory(res.token);
      notifyAuthSync('login');
      onSessionInitialSecret?.(password);
      onAuthenticated(res.user);
      showToast('Bienvenido al portal privado del CMJ Flandes', 'success');
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        setErrorHint(err.hint || null);
        if (err.code === 'NEEDS_ACTIVATION_OR_WRONG_INITIAL' || err.status === 401) {
          setSuggestActivate(true);
        }
      } else {
        setErrorMsg('No fue posible iniciar sesión. Verifica tu conexión.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelfRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    const cleanName = regFullName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (cleanName.length < 3) {
      setErrorMsg('Ingresa tu nombre completo (mínimo 3 caracteres).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Ingresa un correo electrónico válido.');
      return;
    }
    if (!regInitialPassword.trim() || !regActivationCode.trim()) {
      setErrorMsg('Debes ingresar tanto la contraseña inicial como el código de activación.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ ok: boolean; email: string; message: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: {
            fullName: cleanName,
            email: cleanEmail,
            cargo: regCargo,
            commissionId: regCommissionId,
            isCoordinator: regIsCoordinator === 'si',
            initialPassword: regInitialPassword,
            activationCode: regActivationCode,
          },
          skipRefresh: true,
        }
      );

      setRegSuccessMsg(
        res.message ||
          'Registro exitoso. Por seguridad cambia tu contraseña al ingresar al portal privado.'
      );
      setEmail(cleanEmail);
      setRegInitialPassword('');
      setRegActivationCode('');
      setRegFullName('');
      setRegEmail('');
      setRegCommissionId('');
      setRegIsCoordinator('no');
      showToast('Registro completado correctamente', 'success');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        setErrorHint(err.hint || null);
      } else {
        setErrorMsg('No fue posible completar el registro. Verifica tu conexión.');
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
    if (!currentUser && !email.trim()) {
      setErrorMsg('Ingresa tu correo electrónico registrado.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: SessionUser }>('/api/auth/activate', {
        method: 'POST',
        body: {
          email: currentUser ? currentUser.email : email.trim().toLowerCase(),
          inviteCode: inviteCode.trim(),
          newPassword,
        },
        skipRefresh: true,
      });

      setAuthTokenInMemory(res.token);
      notifyAuthSync('login');
      onAuthenticated(res.user);
      showToast(
        currentUser ? 'Contraseña actualizada correctamente' : 'Cuenta activada e ingreso exitoso',
        'success'
      );
      setInviteCode('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrorMsg(err.message);
        setErrorHint(err.hint || null);
      } else {
        setErrorMsg('No fue posible completar el cambio de contraseña.');
      }
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
          className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92dvh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 pb-safe-bottom shadow-2xl my-0 sm:my-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <BrandLogo size="md" />
                <div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Portal Privado · CMJ Flandes
                  </p>
                  <h2 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
                    {tab === 'login'
                      ? 'Iniciar sesión'
                      : tab === 'register'
                      ? 'Registrarme como consejero'
                      : tab === 'activate'
                      ? currentUser
                        ? 'Cambiar mi contraseña'
                        : 'Activar / Cambiar clave'
                      : 'Recuperar acceso'}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar ventana"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
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
                  setTab('register');
                  clearFeedback();
                }}
                className={`rounded-lg py-2 px-1.5 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Registrarme
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
                {currentUser ? 'Cambiar clave' : 'Activar clave'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('help');
                  clearFeedback();
                }}
                className={`rounded-lg py-2 px-1.5 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer truncate ${
                  tab === 'help'
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
                  </div>
                </div>

                {suggestActivate && (
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
                      Usar código de invitación para asignar clave nueva
                    </button>
                  </div>
                )}
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
                        setTab('activate');
                        clearFeedback();
                      }}
                      className="text-[11px] font-medium text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      Cambiar con código institucional
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
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
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
                  Ingreso directo solo con correo y contraseña, sin verificación en dos pasos ni códigos SMS.
                </p>
              </form>
            )}

            {tab === 'register' && (
              <div className="mt-5">
                {regSuccessMsg ? (
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
                    <div className="flex items-start gap-2.5 text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                      <div className="space-y-1 text-xs">
                        <p className="font-bold leading-relaxed">{regSuccessMsg}</p>
                        <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 leading-relaxed">
                          Tu cuenta quedó creada con rol inicial <strong>Consejero</strong> y pendiente de verificación institucional por la Mesa Directiva.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTab('login');
                        setRegSuccessMsg(null);
                      }}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                    >
                      Iniciar sesión ahora
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSelfRegister} className="space-y-3.5">
                    <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 px-3 py-2 text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
                      Todo auto-registro inicia con el perfil base <strong>Consejero</strong>. Si declaras otro cargo o coordinación de comisión, la Mesa Directiva confirmará tu asignación y verificará tu perfil.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Nombre completo *
                        </label>
                        <input
                          type="text"
                          required
                          minLength={3}
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          placeholder="Nombres y apellidos"
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Correo electrónico *
                        </label>
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="consejero@correo.com"
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Cargo *
                        </label>
                        <select
                          value={regCargo}
                          onChange={(e) => setRegCargo(e.target.value)}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {SELF_REG_CARGOS.map((cargoOpt) => (
                            <option key={cargoOpt} value={cargoOpt}>
                              {cargoOpt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Comisión
                        </label>
                        <select
                          value={regCommissionId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRegCommissionId(val);
                            if (!val) setRegIsCoordinator('no');
                          }}
                          className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Sin comisión asignada</option>
                          {availableCommissions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        ¿Eres coordinador/a de la comisión?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRegIsCoordinator('no')}
                          className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                            regIsCoordinator === 'no'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          No
                        </button>
                        <button
                          type="button"
                          disabled={!regCommissionId}
                          onClick={() => setRegIsCoordinator('si')}
                          className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                            regIsCoordinator === 'si'
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Sí (requiere confirmación)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Contraseña inicial *
                        </label>
                        <div className="relative">
                          <Lock className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showRegPass ? 'text' : 'password'}
                            required
                            autoComplete="new-password"
                            value={regInitialPassword}
                            onChange={(e) => setRegInitialPassword(e.target.value)}
                            placeholder="Clave inicial CMJ"
                            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-9 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPass((v) => !v)}
                            aria-label="Mostrar u ocultar contraseña inicial"
                            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showRegPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Código de activación *
                        </label>
                        <div className="relative">
                          <ShieldCheck className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showRegCode ? 'text' : 'password'}
                            required
                            value={regActivationCode}
                            onChange={(e) => setRegActivationCode(e.target.value)}
                            placeholder="Código institucional"
                            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-9 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegCode((v) => !v)}
                            aria-label="Mostrar u ocultar código de activación"
                            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showRegCode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      {loading ? 'Validando registro...' : 'Registrarme en el portal'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {tab === 'activate' && (
              <form onSubmit={handleActivateOrChangePassword} className="mt-5 space-y-3.5">
                {!currentUser && (
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
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
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
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    ? 'Guardando contraseña...'
                    : currentUser
                    ? 'Actualizar contraseña'
                    : 'Activar clave e ingresar'}
                </button>
              </form>
            )}

            {tab === 'help' && (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Cambio inmediato sin códigos por correo ni SMS
                  </p>
                  <p>
                    Si olvidaste tu contraseña o es tu primer ingreso, solo necesitas tu{' '}
                    <strong>correo electrónico habilitado</strong> y el{' '}
                    <strong>código de invitación institucional</strong> vigente del CMJ Flandes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTab('activate');
                    clearFeedback();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" />
                  Asignar nueva contraseña ahora
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
