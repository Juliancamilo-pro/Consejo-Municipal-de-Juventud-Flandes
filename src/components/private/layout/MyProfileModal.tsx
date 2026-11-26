import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  ApiRequestError,
  apiRequest,
  setAuthTokenInMemory,
  triggerPortalRefresh,
  type SessionUser,
} from '../../../lib/apiClient';
import { deleteStorageFile } from '../../../lib/storageUtils';
import { useUnsavedChangesGuard } from '../../../lib/unsavedChanges';
import type {
  AffiliationType,
  Commission,
  CouncilorPrivate,
  PublicCouncilor,
} from '../../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../../MediaUploader';
import { useToast } from '../../ToastProvider';
import { VerifiedBadge } from '../../VerifiedBadge';
import { AvatarBadge } from '../../public/AvatarBadge';
import { ResponsiveModal } from '../../ui/DataTableUI';

export function MyProfileModal({
  open,
  uid,
  email,
  fullName,
  canEditCommission,
  inSession,
  profile,
  privateRecord,
  commissions,
  commissionId,
  onClose,
}: {
  open: boolean;
  uid: string;
  email: string;
  fullName: string;
  canEditCommission: boolean;
  inSession: boolean;
  profile: PublicCouncilor | null;
  privateRecord: CouncilorPrivate | null;
  commissions: Commission[];
  commissionId: string;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editIg, setEditIg] = useState(profile?.instagram || '');
  const [editFb, setEditFb] = useState(profile?.facebook || '');
  const [editEmail, setEditEmail] = useState(profile?.email || privateRecord?.email || email);
  const [editPhone, setEditPhone] = useState(privateRecord?.phone || profile?.phone || '');
  const [editName, setEditName] = useState(fullName);
  const [editCommissionId, setEditCommissionId] = useState(commissionId);
  const [editAffiliationType, setEditAffiliationType] = useState<AffiliationType>(
    profile?.affiliationType || ''
  );
  const [editAffiliationName, setEditAffiliationName] = useState(profile?.affiliationName || '');
  const [formError, setFormError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Cambio de contraseña personal
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  useEffect(() => {
    if (open) {
      setEditName(fullName);
      setEditBio(profile?.bio || '');
      setEditIg(profile?.instagram || '');
      setEditFb(profile?.facebook || '');
      setEditEmail(profile?.email || privateRecord?.email || email);
      setEditPhone(privateRecord?.phone || profile?.phone || '');
      setEditCommissionId(commissionId);
      setEditAffiliationType(profile?.affiliationType || '');
      setEditAffiliationName(profile?.affiliationName || '');
      setFormError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdError('');
      setPwdSuccess('');
    }
  }, [open, fullName, profile, privateRecord, email, commissionId]);

  const isDirtyProfile =
    open &&
    (editName !== fullName ||
      editEmail !== (profile?.email || privateRecord?.email || email) ||
      editPhone !== (privateRecord?.phone || profile?.phone || '') ||
      editBio !== (profile?.bio || '') ||
      editIg !== (profile?.instagram || '') ||
      editFb !== (profile?.facebook || '') ||
      editAffiliationType !== (profile?.affiliationType || '') ||
      editAffiliationName !== (profile?.affiliationName || '') ||
      (canEditCommission && editCommissionId !== commissionId));
  useUnsavedChangesGuard('my-profile-modal', isDirtyProfile);

  const handleAvatarUpload = async (files: UploadedFileInfo[]) => {
    const first = files[0];
    if (!first) return;
    try {
      if (profile?.storagePath) {
        await deleteStorageFile(profile.storagePath, profile.photoUrl);
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: {
          photoUrl: first.url,
          photoThumbUrl: first.thumbUrl || first.thumbnailUrl || first.url,
          photoMediumUrl: first.mediumUrl || first.url,
          storagePath: first.storagePath || '',
        },
      });
      showToast('Foto de perfil actualizada', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la foto de perfil';
      showToast(msg, 'error');
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      if (profile?.storagePath) {
        await deleteStorageFile(profile.storagePath, profile.photoUrl);
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: {
          photoUrl: '',
          photoThumbUrl: '',
          photoMediumUrl: '',
          storagePath: '',
        },
      });
      showToast('Foto de perfil eliminada', 'info');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo quitar la foto de perfil';
      showToast(msg, 'error');
    }
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = editName.trim();
    const cleanEmail = editEmail.trim().toLowerCase();
    if (cleanName.length < 3) {
      setFormError('Ingresa tu nombre completo (mínimo 3 caracteres).');
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormError('El correo electrónico no tiene un formato válido.');
      return;
    }

    setSavingProfile(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: cleanName,
        bio: editBio.trim(),
        instagram: editIg.trim(),
        facebook: editFb.trim(),
        email: cleanEmail,
        phone: editPhone.trim(),
        affiliationType: editAffiliationType,
        affiliationName: editAffiliationName.trim(),
      };
      if (canEditCommission) {
        payload.commissionId = editCommissionId;
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: payload,
      });
      onClose();
      showToast('Perfil actualizado correctamente', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Error al actualizar perfil';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword || !newPassword) {
      setPwdError('Completa tu contraseña actual y la nueva contraseña.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await apiRequest<{ ok: boolean; token?: string; user?: SessionUser }>(
        '/api/auth/change-password',
        {
          method: 'POST',
          body: {
            currentPassword,
            newPassword,
            confirmPassword,
          },
        }
      );
      if (res.token) setAuthTokenInMemory(res.token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdSuccess('Contraseña personal actualizada correctamente.');
      showToast('Contraseña actualizada con éxito', 'success');
      triggerPortalRefresh();
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No fue posible cambiar la contraseña';
      setPwdError(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Mi Perfil de Consejero"
      subtitle="Información visible en el directorio público del CMJ Flandes"
      maxWidthClass="sm:max-w-lg"
    >
      <div className="space-y-6">
        {privateRecord?.mustChangePassword && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-bold">Recomendación de seguridad</p>
              <p className="text-[11px] opacity-90">
                Estás usando la contraseña inicial institucional. Por seguridad, actualízala en la sección{' '}
                <strong>Cambiar mi contraseña</strong> más abajo.
              </p>
            </div>
          </div>
        )}

      <form onSubmit={handleSaveMyProfile} className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <AvatarBadge
            name={editName || fullName}
            photoUrl={profile?.photoUrl}
            thumbUrl={profile?.photoThumbUrl}
            mediumUrl={profile?.photoMediumUrl}
            accentColor={commissions.find((c) => c.id === commissionId)?.accentColor}
            statusIndicator={inSession ? 'in_session' : 'active'}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <UserCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {editName || fullName}
              </span>
              {profile?.verificado ? (
                <VerifiedBadge size="sm" />
              ) : (
                <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  Pendiente de verificación
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">{editEmail || email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <MediaUploader
            storageFolder={`profiles/${uid}`}
            imagePreset="profile"
            label="Actualizar foto de perfil (recorte 1:1 WebP)"
            onUploaded={handleAvatarUpload}
          />
          {profile?.photoUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> Quitar foto actual
            </button>
          )}
        </div>

        {formError && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {formError}
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Nombre completo *
          </label>
          <input
            type="text"
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Nombre completo"
            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Correo público de contacto
          </label>
          <input
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <p className="mt-1 text-[11px] text-slate-400">
            {canEditCommission
              ? 'Como administración autorizada, se sincroniza también con tu correo de acceso.'
              : 'Se muestra en tu ficha pública para contacto ciudadano.'}
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Reseña o perfil juvenil
          </label>
          <textarea
            rows={3}
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Cuéntale a la juventud de Flandes sobre tu labor y causas..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Filiación
            </label>
            <select
              value={editAffiliationType}
              onChange={(e) => setEditAffiliationType(e.target.value as AffiliationType)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">Filiación (opcional)</option>
              <option value="partido">Partido político</option>
              <option value="fundacion">Fundación / Organización</option>
              <option value="independiente">Independiente</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Nombre de organización o partido
            </label>
            <input
              type="text"
              value={editAffiliationName}
              onChange={(e) => setEditAffiliationName(e.target.value)}
              placeholder={
                editAffiliationType === 'partido'
                  ? 'Nombre del partido político'
                  : editAffiliationType === 'fundacion'
                  ? 'Nombre de la fundación u org.'
                  : 'Nombre de lista o colectivo'
              }
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
        </div>

        {canEditCommission && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Comisión asignada
            </label>
            <select
              value={editCommissionId}
              onChange={(e) => setEditCommissionId(e.target.value)}
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">Sin comisión asignada</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Teléfono / WhatsApp
            </label>
            <input
              type="text"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="Ej: 3101234567"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Instagram
            </label>
            <input
              type="text"
              value={editIg}
              onChange={(e) => setEditIg(e.target.value)}
              placeholder="@usuario o enlace"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Facebook (opcional)
          </label>
          <input
            type="text"
            value={editFb}
            onChange={(e) => setEditFb(e.target.value)}
            placeholder="Usuario o enlace de Facebook"
            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="w-full min-h-[44px] rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
        >
          {savingProfile ? 'Guardando perfil...' : 'Guardar perfil'}
        </button>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-blue-600 dark:text-cyan-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Cambiar mi contraseña
            </h3>
            <p className="text-[11px] text-slate-500">
              Usa una clave personal de al menos 8 caracteres para proteger tu cuenta.
            </p>
          </div>
        </div>

        {pwdError && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
            {pwdError}
          </div>
        )}
        {pwdSuccess && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{pwdSuccess}</span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
            Contraseña actual *
          </label>
          <div className="relative">
            <Lock className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showCurPass ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Tu contraseña actual"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-9 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowCurPass((v) => !v)}
              aria-label="Mostrar u ocultar contraseña actual"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showCurPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Nueva contraseña *
            </label>
            <div className="relative">
              <KeyRound className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPass ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-9 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowNewPass((v) => !v)}
                aria-label="Mostrar u ocultar nueva contraseña"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Confirmar nueva contraseña *
            </label>
            <input
              type={showNewPass ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva clave"
              className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={changingPassword}
          className="w-full min-h-[42px] rounded-xl bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
        >
          {changingPassword ? 'Actualizando contraseña...' : 'Actualizar contraseña'}
        </button>
      </form>
      </div>
    </ResponsiveModal>
  );
}
