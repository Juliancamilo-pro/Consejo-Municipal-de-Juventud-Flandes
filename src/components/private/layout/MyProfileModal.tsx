import React, { useEffect, useState } from 'react';
import { Trash2, UserCheck } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../../lib/apiClient';
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

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title="Mi Perfil de Consejero"
      subtitle="Información visible en el directorio público del CMJ Flandes"
      maxWidthClass="sm:max-w-lg"
    >
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
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{editName || fullName}</span>
            </p>
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
    </ResponsiveModal>
  );
}
