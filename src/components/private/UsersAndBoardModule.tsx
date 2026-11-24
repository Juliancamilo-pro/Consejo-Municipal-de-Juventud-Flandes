import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Edit3,
  KeyRound,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { deleteStorageFile } from '../../lib/storageUtils';
import type {
  AffiliationType,
  Commission,
  CouncilorPrivate,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

export function UsersAndBoardModule({
  uid,
  actorName,
  actorRoleLabel,
  commissions,
  publicCouncilors,
  privateCouncilors,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  privateCouncilors: CouncilorPrivate[];
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Formulario nuevo consejero
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleLabel, setRoleLabel] = useState<RoleLabel>('Consejero');
  const [commissionId, setCommissionId] = useState('');
  const [affiliationType, setAffiliationType] = useState<AffiliationType>('');
  const [affiliationName, setAffiliationName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edición inline de consejero
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<RoleLabel>('Consejero');
  const [editComm, setEditComm] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAffType, setEditAffType] = useState<AffiliationType>('');
  const [editAffName, setEditAffName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [photoTarget, setPhotoTarget] = useState<PublicCouncilor | null>(null);

  // Configuración institucional de seguridad (códigos / clave inicial)
  const [newInviteCode, setNewInviteCode] = useState('');
  const [newInitialPwd, setNewInitialPwd] = useState('');
  const [savingSec, setSavingSec] = useState(false);

  // Botón de limpieza profunda con doble confirmación (solo Presidente o Secretario)
  const [purgeConfirmStep, setPurgeConfirmStep] = useState<0 | 1 | 2>(0);
  const [purging, setPurging] = useState(false);

  const canPurgeSamples = actorRoleLabel === 'Presidente' || actorRoleLabel === 'Secretario';

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return publicCouncilors
      .map((pub) => {
        const priv = privateCouncilors.find((p) => p.uid === pub.uid);
        return { pub, priv };
      })
      .filter(({ pub, priv }) => {
        if (statusFilter === 'active' && !pub.active) return false;
        if (statusFilter === 'inactive' && pub.active) return false;
        if (!q) return true;
        const resolvedEmail = (priv?.email || pub.email || '').toLowerCase();
        const resolvedPhone = (priv?.phone || pub.phone || '').toLowerCase();
        return (
          pub.fullName.toLowerCase().includes(q) ||
          pub.roleLabel.toLowerCase().includes(q) ||
          (pub.commissionName || 'Sin comisión').toLowerCase().includes(q) ||
          (pub.affiliationName || '').toLowerCase().includes(q) ||
          (pub.affiliationType || '').toLowerCase().includes(q) ||
          resolvedEmail.includes(q) ||
          resolvedPhone.includes(q)
        );
      })
      .sort((a, b) => (a.pub.displayOrder ?? 50) - (b.pub.displayOrder ?? 50));
  }, [publicCouncilors, privateCouncilors, search, statusFilter]);

  const handleCreateCouncilor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!fullName.trim() || !cleanEmail) {
      showToast('Completa nombre y correo electrónico', 'error');
      return;
    }

    setCreating(true);
    try {
      await apiRequest<{ uid: string; ok: boolean }>('/api/councilors', {
        method: 'POST',
        body: {
          fullName: fullName.trim(),
          email: cleanEmail,
          phone: phone.trim(),
          roleLabel,
          commissionId,
          affiliationType,
          affiliationName: affiliationName.trim(),
        },
      });

      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Registró consejero en el directorio',
        module: 'Usuarios y Mesa',
        targetTitle: `${fullName.trim()} (${roleLabel})`,
      });

      showToast(
        'Consejero registrado',
        'success',
        'Cuenta creada sin verificación en dos pasos. Ya puede ingresar con la clave inicial o activar su clave personal.'
      );
      setFullName('');
      setEmail('');
      setPhone('');
      setAffiliationType('');
      setAffiliationName('');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'Error al guardar consejero';
      showToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (pub: PublicCouncilor, priv?: CouncilorPrivate) => {
    setEditingId(pub.id);
    setEditName(pub.fullName);
    setEditEmail(priv?.email || pub.email || '');
    setEditRole(pub.roleLabel);
    setEditComm(pub.commissionId || '');
    setEditPhone(priv?.phone || pub.phone || '');
    setEditAffType(pub.affiliationType || '');
    setEditAffName(pub.affiliationName || '');
  };

  const handleSaveEdit = async (pub: PublicCouncilor) => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    try {
      await apiRequest(`/api/councilors/${encodeURIComponent(pub.uid)}`, {
        method: 'PATCH',
        body: {
          fullName: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          roleLabel: editRole,
          commissionId: editComm,
          phone: editPhone.trim(),
          affiliationType: editAffType,
          affiliationName: editAffName.trim(),
        },
      });

      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Actualizó cargo o datos de consejero',
        module: 'Usuarios y Mesa',
        targetTitle: `${editName.trim()} → ${editRole}`,
      });

      setEditingId(null);
      showToast('Datos actualizados', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudieron guardar los cambios';
      showToast(msg, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCouncilor = async (pub: PublicCouncilor) => {
    try {
      await apiRequest(`/api/councilors/${encodeURIComponent(pub.uid)}`, {
        method: 'DELETE',
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Eliminó consejero del directorio',
        module: 'Usuarios y Mesa',
        targetTitle: pub.fullName,
      });
      setConfirmDeleteUid(null);
      showToast('Consejero eliminado', 'info');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar';
      showToast(msg, 'error');
    }
  };

  const handleToggleActive = async (pub: PublicCouncilor) => {
    const nextActive = !pub.active;
    try {
      await apiRequest(`/api/councilors/${encodeURIComponent(pub.uid)}`, {
        method: 'PATCH',
        body: { active: nextActive },
      });

      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: nextActive ? 'Reactivó consejero' : 'Desactivó consejero',
        module: 'Usuarios y Mesa',
        targetTitle: pub.fullName,
      });

      showToast(nextActive ? 'Consejero activado' : 'Consejero desactivado', 'info');
    } catch {
      showToast('No se pudo cambiar el estado', 'error');
    }
  };

  const handleUploadCouncilorPhoto = async (target: PublicCouncilor, files: UploadedFileInfo[]) => {
    const first = files[0];
    if (!first) return;
    try {
      if (target.storagePath) {
        await deleteStorageFile(target.storagePath, target.photoUrl);
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(target.uid)}`, {
        method: 'PATCH',
        body: {
          photoUrl: first.url,
          photoThumbUrl: first.thumbUrl || first.thumbnailUrl || first.url,
          photoMediumUrl: first.mediumUrl || first.url,
          storagePath: first.storagePath || '',
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Actualizó foto de perfil de consejero',
        module: 'Usuarios y Mesa',
        targetTitle: target.fullName,
      });
      setPhotoTarget(null);
      showToast(`Foto de ${target.fullName} actualizada`, 'success');
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'No se pudo guardar la foto', 'error');
    }
  };

  const handleRemoveCouncilorPhoto = async (target: PublicCouncilor) => {
    try {
      if (target.storagePath) {
        await deleteStorageFile(target.storagePath, target.photoUrl);
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(target.uid)}`, {
        method: 'PATCH',
        body: { photoUrl: '', photoThumbUrl: '', photoMediumUrl: '', storagePath: '' },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Eliminó foto de perfil de consejero',
        module: 'Usuarios y Mesa',
        targetTitle: target.fullName,
      });
      setPhotoTarget(null);
      showToast(`Foto de ${target.fullName} eliminada`, 'info');
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'No se pudo quitar la foto', 'error');
    }
  };

  const handleUpdateSecurityConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newInviteCode.trim().length < 4 || newInitialPwd.trim().length < 6) {
      showToast(
        'Verifica longitudes mínimas',
        'error',
        'Código mínimo 4 caracteres y contraseña inicial mínimo 6.'
      );
      return;
    }

    setSavingSec(true);
    try {
      await apiRequest('/api/security/rotate', {
        method: 'POST',
        body: {
          inviteCode: newInviteCode.trim(),
          initialPassword: newInitialPwd.trim(),
        },
      });

      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Actualizó código de invitación y clave inicial',
        module: 'Seguridad Institucional',
        targetTitle: 'Credenciales de ingreso',
      });

      setNewInviteCode('');
      setNewInitialPwd('');
      showToast('Credenciales institucionales actualizadas', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'Error al actualizar credenciales';
      showToast(msg, 'error');
    } finally {
      setSavingSec(false);
    }
  };

  const handlePurgeSamples = async () => {
    setPurging(true);
    try {
      await apiRequest('/api/portal/purge-samples', {
        method: 'POST',
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Ejecutó limpieza de datos de ejemplo',
        module: 'Usuarios y Mesa',
        targetTitle: 'Depuración general ejecutada',
      });
      setPurgeConfirmStep(0);
      showToast('Limpieza completada correctamente', 'success');
    } catch {
      showToast('Error durante la limpieza', 'error');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Usuarios, Cargos y Mesa Directiva
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Registra consejeros autorizados, asigna su cargo (Presidente, Vicepresidente, Secretario o Consejero) y su comisión.
        </p>

        <form onSubmit={handleCreateCouncilor} className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nombre completo"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
          />
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="WhatsApp / Teléfono"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
          />
          <select
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value as RoleLabel)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
          >
            <option value="Consejero">Consejero</option>
            <option value="Presidente">Presidente</option>
            <option value="Vicepresidente">Vicepresidente</option>
            <option value="Secretario">Secretario</option>
          </select>
          <select
            value={commissionId}
            onChange={(e) => setCommissionId(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
          >
            <option value="">Sin comisión asignada</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={affiliationType}
            onChange={(e) => setAffiliationType(e.target.value as AffiliationType)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
          >
            <option value="">Filiación (opcional)</option>
            <option value="partido">Partido político</option>
            <option value="fundacion">Fundación / Organización</option>
            <option value="independiente">Independiente</option>
          </select>
          <input
            type="text"
            value={affiliationName}
            onChange={(e) => setAffiliationName(e.target.value)}
            placeholder="Nombre de partido, fundación o lista"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Agregar consejero
          </button>
        </form>
      </div>

      {/* Tabla buscable y editable de consejeros */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Directorio Registrado ({rows.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, correo o cargo..."
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-2 font-semibold">Consejero</th>
                <th className="py-3 px-2 font-semibold">Correo / Teléfono</th>
                <th className="py-3 px-2 font-semibold">Cargo</th>
                <th className="py-3 px-2 font-semibold">Comisión</th>
                <th className="py-3 px-2 font-semibold">Filiación</th>
                <th className="py-3 px-2 font-semibold">Estado</th>
                <th className="py-3 px-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {rows.map(({ pub, priv }) => {
                const isEditing = editingId === pub.id;
                return (
                  <tr key={pub.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-2 font-semibold text-slate-900 dark:text-white">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AvatarBadge
                            name={pub.fullName}
                            photoUrl={pub.photoUrl}
                            thumbUrl={pub.photoThumbUrl}
                            mediumUrl={pub.photoMediumUrl}
                            accentColor={commissions.find((c) => c.id === pub.commissionId)?.accentColor}
                            statusIndicator={pub.active ? 'active' : 'inactive'}
                            size="sm"
                          />
                          <span className="truncate">{pub.fullName}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                      {isEditing ? (
                        <div className="space-y-1 min-w-[170px]">
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="Correo electrónico"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                          />
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Teléfono / WhatsApp"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          <div>{priv?.email || pub.email || 'Activación pendiente'}</div>
                          {(priv?.phone || pub.phone) && (
                            <div className="text-[11px] font-mono-num text-slate-400">
                              {priv?.phone || pub.phone}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as RoleLabel)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                        >
                          <option value="Consejero">Consejero</option>
                          <option value="Presidente">Presidente</option>
                          <option value="Vicepresidente">Vicepresidente</option>
                          <option value="Secretario">Secretario</option>
                        </select>
                      ) : (
                        <span className="inline-block rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 font-semibold text-blue-700 dark:text-cyan-300">
                          {pub.roleLabel}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                      {isEditing ? (
                        <select
                          value={editComm}
                          onChange={(e) => setEditComm(e.target.value)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs max-w-[180px]"
                        >
                          <option value="">Sin comisión asignada</option>
                          {commissions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        pub.commissionName || 'Sin comisión'
                      )}
                    </td>
                    <td className="py-3 px-2 text-slate-600 dark:text-slate-300">
                      {isEditing ? (
                        <div className="space-y-1 min-w-[150px]">
                          <select
                            value={editAffType}
                            onChange={(e) => setEditAffType(e.target.value as AffiliationType)}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                          >
                            <option value="">Sin especificar</option>
                            <option value="partido">Partido político</option>
                            <option value="fundacion">Fundación / Org.</option>
                            <option value="independiente">Independiente</option>
                          </select>
                          <input
                            type="text"
                            value={editAffName}
                            onChange={(e) => setEditAffName(e.target.value)}
                            placeholder="Nombre partido/org."
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                          />
                        </div>
                      ) : pub.affiliationType || pub.affiliationName ? (
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {pub.affiliationType === 'partido'
                              ? 'Partido político'
                              : pub.affiliationType === 'fundacion'
                              ? 'Fundación / Org.'
                              : pub.affiliationType === 'independiente'
                              ? 'Independiente'
                              : 'Filiación'}
                          </span>
                          {pub.affiliationName && (
                            <div className="text-[11px] text-slate-400">{pub.affiliationName}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 font-semibold ${
                          pub.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {pub.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => handleSaveEdit(pub)}
                              title="Guardar"
                              className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              title="Cancelar"
                              className="rounded-lg bg-slate-200 dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setPhotoTarget(pub)}
                              title="Subir o ajustar foto de perfil"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 cursor-pointer"
                            >
                              <Camera className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(pub, priv)}
                              title="Editar consejero"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            {pub.uid !== uid && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(pub)}
                                  title={pub.active ? 'Desactivar acceso' : 'Reactivar acceso'}
                                  className={`rounded-lg p-1.5 cursor-pointer ${
                                    pub.active
                                      ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  }`}
                                >
                                  {pub.active ? (
                                    <UserX className="h-3.5 w-3.5" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                {confirmDeleteUid === pub.uid ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCouncilor(pub)}
                                      className="rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteUid(null)}
                                      className="rounded-lg bg-slate-200 dark:bg-slate-800 px-1.5 py-1 text-[10px] cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUid(pub.uid)}
                                    title="Eliminar consejero"
                                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay consejeros que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seguridad y códigos institucionales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleUpdateSecurityConfig}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Credenciales Institucionales de Ingreso
              </h3>
              <p className="text-xs text-slate-500">
                Actualiza el código de invitación y la contraseña inicial para nuevos consejeros.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              minLength={4}
              value={newInviteCode}
              onChange={(e) => setNewInviteCode(e.target.value)}
              placeholder="Nuevo código de invitación"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <input
              type="text"
              required
              minLength={6}
              value={newInitialPwd}
              onChange={(e) => setNewInitialPwd(e.target.value)}
              placeholder="Nueva contraseña inicial"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingSec}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            <Shield className="h-4 w-4" />
            {savingSec ? 'Guardando...' : 'Actualizar credenciales institucionales'}
          </button>
        </form>

        {/* Limpieza segura de datos de ejemplo */}
        {canPurgeSamples && (
          <div className="rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-slate-900 p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Limpiar datos de ejemplo previos
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Elimina de la base de datos cualquier noticia, galería, sesión, compromiso o perfil ficticio de prueba.
                </p>
              </div>
            </div>

            {purgeConfirmStep === 0 && (
              <button
                type="button"
                onClick={() => setPurgeConfirmStep(1)}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Limpiar datos de ejemplo
              </button>
            )}

            {purgeConfirmStep === 1 && (
              <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-950 p-3.5 space-y-2.5">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Confirmación 1 de 2: Se conservarán tus consejeros reales, configuración básica y las 5 comisiones. ¿Continuar?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPurgeConfirmStep(2)}
                    className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    Sí, continuar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurgeConfirmStep(0)}
                    className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {purgeConfirmStep === 2 && (
              <div className="rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3.5 space-y-2.5">
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                  Confirmación final (2 de 2): Haz clic para purgar definitivamente los registros ficticios heredados.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={purging}
                    onClick={handlePurgeSamples}
                    className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                  >
                    {purging ? 'Purgando...' : 'Ejecutar limpieza ahora'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurgeConfirmStep(0)}
                    className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal foto de perfil de consejero */}
      {photoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setPhotoTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <AvatarBadge
                  name={photoTarget.fullName}
                  photoUrl={photoTarget.photoUrl}
                  thumbUrl={photoTarget.photoThumbUrl}
                  mediumUrl={photoTarget.photoMediumUrl}
                  accentColor={commissions.find((c) => c.id === photoTarget.commissionId)?.accentColor}
                  size="md"
                />
                <div className="min-w-0">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    Foto de perfil · {photoTarget.fullName}
                  </h4>
                  <p className="text-xs text-slate-500">{photoTarget.roleLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhotoTarget(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MediaUploader
              storageFolder={`profiles/${photoTarget.uid}`}
              imagePreset="profile"
              label="Subir foto institucional (ajuste facial y tamaños 96/256/512 px)"
              onUploaded={(files) => handleUploadCouncilorPhoto(photoTarget, files)}
            />

            {photoTarget.photoUrl && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveCouncilorPhoto(photoTarget)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2 text-xs font-semibold text-rose-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar foto actual
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
