import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  Download,
  Edit3,
  FileSpreadsheet,
  KeyRound,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { exportCsvWithBom, exportStyledWorkbook } from '../../lib/excelExport';
import { isGrantActive } from '../../lib/permissions';
import { deleteStorageFile } from '../../lib/storageUtils';
import type {
  AffiliationType,
  Commission,
  CouncilorPrivate,
  GrantedPermission,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import {
  ConfirmDialog,
  DataToolbar,
  PaginationBar,
  ResponsiveModal,
  SortableHeader,
} from '../ui/DataTableUI';
import { recordAudit } from './auditHelper';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

type SortField = 'fullName' | 'roleLabel' | 'commissionName' | 'active';

function formatAffiliation(type?: AffiliationType, name?: string): string {
  if (!type && !name) return '—';
  const label =
    type === 'partido'
      ? 'Partido político'
      : type === 'fundacion'
      ? 'Fundación / Org.'
      : type === 'independiente'
      ? 'Independiente'
      : 'Filiación';
  return name ? `${label} · ${name}` : label;
}

export function UsersAndBoardModule({
  uid,
  actorName,
  actorRoleLabel,
  commissions,
  publicCouncilors,
  privateCouncilors,
  grantedPermissions = [],
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  privateCouncilors: CouncilorPrivate[];
  grantedPermissions?: GrantedPermission[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [commissionFilter, setCommissionFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [exporting, setExporting] = useState(false);

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

  // Diálogos y modales
  const [deleteTarget, setDeleteTarget] = useState<PublicCouncilor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<PublicCouncilor | null>(null);

  // Configuración institucional de seguridad (códigos / clave inicial)
  const [newInviteCode, setNewInviteCode] = useState('');
  const [newInitialPwd, setNewInitialPwd] = useState('');
  const [savingSec, setSavingSec] = useState(false);

  // Limpieza de datos de ejemplo
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const canCreateUsers = can('usuarios.crear');
  const canEditUsers = can('usuarios.editar');
  const canSuspendUsers = can('usuarios.desactivar');
  const canDeleteUsers = can('usuarios.eliminar');
  const canAssignPres = can('usuarios.asignar_presidencia');
  const canRotateSecurity = can('usuarios.credenciales_rotar');
  const canPurgeSamples = can('usuarios.purgar_ejemplos');
  const canExportUsers = can('planillas.exportar') || can('usuarios.ver');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const mapped = publicCouncilors
      .map((pub) => {
        const priv = privateCouncilors.find((p) => p.uid === pub.uid);
        return { pub, priv };
      })
      .filter(({ pub, priv }) => {
        if (statusFilter === 'active' && !pub.active) return false;
        if (statusFilter === 'inactive' && pub.active) return false;
        if (commissionFilter === 'none' && pub.commissionId) return false;
        if (
          commissionFilter !== 'all' &&
          commissionFilter !== 'none' &&
          pub.commissionId !== commissionFilter
        ) {
          return false;
        }
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
      });

    mapped.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'fullName') {
        cmp = a.pub.fullName.localeCompare(b.pub.fullName, 'es');
      } else if (sortField === 'roleLabel') {
        cmp = a.pub.roleLabel.localeCompare(b.pub.roleLabel, 'es');
      } else if (sortField === 'commissionName') {
        cmp = (a.pub.commissionName || 'Sin comisión').localeCompare(
          b.pub.commissionName || 'Sin comisión',
          'es'
        );
      } else if (sortField === 'active') {
        cmp = Number(b.pub.active) - Number(a.pub.active);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return mapped;
  }, [
    publicCouncilors,
    privateCouncilors,
    search,
    statusFilter,
    commissionFilter,
    sortField,
    sortDir,
  ]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize]
  );

  const handleExportExcel = async () => {
    if (rows.length === 0) {
      showToast('No hay consejeros en el filtro actual para exportar', 'info');
      return;
    }
    setExporting(true);
    try {
      const activeCount = rows.filter((r) => r.pub.active).length;
      await exportStyledWorkbook({
        fileName: `Directorio_Consejeros_CMJ_${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle: 'Directorio Oficial de Consejeros y Mesa Directiva',
        moduleName: 'Usuarios y Mesa Directiva',
        generatedBy: actorName,
        sheets: [
          {
            name: 'Directorio',
            title: 'Listado General de Consejeros Registrados',
            kpis: [
              { label: 'Total listado', value: rows.length },
              { label: 'Activos', value: activeCount },
              { label: 'Inactivos', value: rows.length - activeCount },
            ],
            columns: [
              { key: 'nombre', header: 'Nombre Completo', type: 'text', minWidth: 24, maxWidth: 38 },
              { key: 'cargo', header: 'Cargo / Mesa', type: 'text', minWidth: 16, maxWidth: 22 },
              { key: 'correo', header: 'Correo Electrónico', type: 'text', minWidth: 24, maxWidth: 36 },
              { key: 'telefono', header: 'Teléfono / WhatsApp', type: 'text', minWidth: 16, maxWidth: 22 },
              { key: 'comision', header: 'Comisión', type: 'text', minWidth: 22, maxWidth: 34 },
              { key: 'filiacion', header: 'Filiación / Partido / Org.', type: 'text', minWidth: 22, maxWidth: 36, wrap: true },
              { key: 'estado', header: 'Estado', type: 'text', minWidth: 12, maxWidth: 16, align: 'center' },
            ],
            rows: rows.map(({ pub, priv }) => ({
              nombre: pub.fullName,
              cargo: pub.roleLabel,
              correo: priv?.email || pub.email || 'Activación pendiente',
              telefono: priv?.phone || pub.phone || '—',
              comision: pub.commissionName || 'Sin comisión',
              filiacion: formatAffiliation(pub.affiliationType, pub.affiliationName),
              estado: pub.active ? 'Activo' : 'Inactivo',
            })),
          },
        ],
      });
      showToast('Directorio exportado a Excel con formato profesional', 'success');
    } catch {
      showToast('No se pudo generar el archivo Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (rows.length === 0) {
      showToast('No hay consejeros en el filtro actual para exportar', 'info');
      return;
    }
    exportCsvWithBom({
      fileName: `Directorio_Consejeros_CMJ_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        { key: 'nombre', label: 'Nombre' },
        { key: 'cargo', label: 'Cargo' },
        { key: 'correo', label: 'Correo' },
        { key: 'telefono', label: 'Telefono' },
        { key: 'comision', label: 'Comision' },
        { key: 'filiacion', label: 'Filiacion' },
        { key: 'estado', label: 'Estado' },
      ],
      rows: rows.map(({ pub, priv }) => ({
        nombre: pub.fullName,
        cargo: pub.roleLabel,
        correo: priv?.email || pub.email || '',
        telefono: priv?.phone || pub.phone || '',
        comision: pub.commissionName || 'Sin comisión',
        filiacion: formatAffiliation(pub.affiliationType, pub.affiliationName),
        estado: pub.active ? 'Activo' : 'Inactivo',
      })),
    });
    showToast('Archivo CSV exportado correctamente', 'success');
  };

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
      const msg = err instanceof ApiRequestError ? err.message : 'Error al guardar consejero';
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
    if (!editName.trim()) {
      showToast('El nombre no puede quedar vacío', 'error');
      return;
    }
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/councilors/${encodeURIComponent(deleteTarget.uid)}`, {
        method: 'DELETE',
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Eliminó consejero del directorio',
        module: 'Usuarios y Mesa',
        targetTitle: deleteTarget.fullName,
      });
      setDeleteTarget(null);
      showToast('Consejero eliminado del directorio', 'info');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
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
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo cambiar el estado';
      showToast(msg, 'error');
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
      setPurgeDialogOpen(false);
      showToast('Limpieza completada correctamente', 'success');
    } catch {
      showToast('Error durante la limpieza', 'error');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulario de registro */}
      <div className="cmj-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Usuarios, Cargos y Mesa Directiva
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Registra consejeros autorizados, asigna cargo, comisión y filiación política o organizativa.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-mono-num">
            <Users className="h-4 w-4" /> {publicCouncilors.filter((c) => c.active).length} activos
          </span>
        </div>

        {canCreateUsers ? (
          <form onSubmit={handleCreateCouncilor} className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre completo *"
              aria-label="Nombre completo"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico *"
              aria-label="Correo electrónico"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="WhatsApp / Teléfono"
              aria-label="WhatsApp o teléfono"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <select
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value as RoleLabel)}
              aria-label="Cargo"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="Consejero">Consejero</option>
              <option value="Consejero Departamental">Consejero Departamental</option>
              {canAssignPres && <option value="Presidente">Presidente</option>}
              <option value="Vicepresidente">Vicepresidente</option>
              <option value="Secretario">Secretario</option>
            </select>
            <select
              value={commissionId}
              onChange={(e) => setCommissionId(e.target.value)}
              aria-label="Comisión asignada"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
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
              aria-label="Tipo de filiación"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
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
              aria-label="Nombre de organización"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Guardando...' : 'Agregar consejero'}
            </button>
          </form>
        ) : (
          <div className="mt-4">
            <PermissionDeniedBanner permission="usuarios.crear" />
          </div>
        )}
      </div>

      {/* Directorio buscable, ordenable y paginado */}
      <div className="cmj-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Directorio Registrado ({rows.length})
          </h3>
          {canExportUsers && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={exporting}
                onClick={handleExportExcel}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {exporting ? 'Generando...' : 'Exportar Excel (.xlsx)'}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
          )}
        </div>

        <DataToolbar
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Buscar por nombre, correo, cargo, teléfono o partido..."
        >
          <select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
              setPage(1);
            }}
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
          </select>
          <select
            aria-label="Filtrar por comisión"
            value={commissionFilter}
            onChange={(e) => {
              setCommissionFilter(e.target.value);
              setPage(1);
            }}
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="all">Todas las comisiones</option>
            <option value="none">Sin comisión asignada</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </DataToolbar>

        {/* Vista móvil en tarjetas */}
        <div className="md:hidden space-y-3">
          {pagedRows.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              No hay consejeros que coincidan con la búsqueda.
            </p>
          ) : (
            pagedRows.map(({ pub, priv }) => {
              const isEditing = editingId === pub.id;
              return (
                <div
                  key={pub.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Correo electrónico"
                          className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="Teléfono / WhatsApp"
                          className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editRole}
                          disabled={pub.uid === uid || (pub.roleLabel === 'Presidente' && !canAssignPres)}
                          onChange={(e) => setEditRole(e.target.value as RoleLabel)}
                          className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs disabled:opacity-60"
                        >
                          <option value="Consejero">Consejero</option>
                          <option value="Consejero Departamental">Consejero Departamental</option>
                          {(canAssignPres || pub.roleLabel === 'Presidente') && (
                            <option value="Presidente">Presidente</option>
                          )}
                          <option value="Vicepresidente">Vicepresidente</option>
                          <option value="Secretario">Secretario</option>
                        </select>
                        <select
                          value={editComm}
                          onChange={(e) => setEditComm(e.target.value)}
                          className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs"
                        >
                          <option value="">Sin comisión</option>
                          {commissions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={editAffType}
                          onChange={(e) => setEditAffType(e.target.value as AffiliationType)}
                          className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-xs"
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
                          placeholder="Partido / Organización"
                          className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => handleSaveEdit(pub)}
                          className="min-h-[40px] inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarBadge
                            name={pub.fullName}
                            photoUrl={pub.photoUrl}
                            thumbUrl={pub.photoThumbUrl}
                            mediumUrl={pub.photoMediumUrl}
                            accentColor={commissions.find((c) => c.id === pub.commissionId)?.accentColor}
                            statusIndicator={pub.active ? 'active' : 'inactive'}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {pub.fullName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {pub.roleLabel} · {pub.active ? 'Activo' : 'Inactivo'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <p className="truncate">{priv?.email || pub.email || 'Activación pendiente'}</p>
                        {(priv?.phone || pub.phone) && (
                          <p className="font-mono-num text-slate-500">{priv?.phone || pub.phone}</p>
                        )}
                        <p className="text-slate-500">
                          {pub.commissionName || 'Sin comisión'} ·{' '}
                          {formatAffiliation(pub.affiliationType, pub.affiliationName)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {canEditUsers && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPhotoTarget(pub)}
                              className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                            >
                              <Camera className="h-3.5 w-3.5" /> Foto
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(pub, priv)}
                              className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" /> Editar
                            </button>
                          </>
                        )}
                        {pub.uid !== uid && (
                          <>
                            {canSuspendUsers && (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(pub)}
                                className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
                              >
                                {pub.active ? <UserX className="h-3.5 w-3.5 text-amber-600" /> : <UserCheck className="h-3.5 w-3.5 text-emerald-600" />}
                                {pub.active ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                            {canDeleteUsers && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(pub)}
                                aria-label={`Eliminar a ${pub.fullName}`}
                                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 cursor-pointer ml-auto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Vista escritorio en tabla ordenable */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-2">
                  <SortableHeader
                    label="Consejero"
                    active={sortField === 'fullName'}
                    direction={sortDir}
                    onClick={() => toggleSort('fullName')}
                  />
                </th>
                <th className="py-3 px-2 font-semibold">Correo / Teléfono</th>
                <th className="py-3 px-2">
                  <SortableHeader
                    label="Cargo"
                    active={sortField === 'roleLabel'}
                    direction={sortDir}
                    onClick={() => toggleSort('roleLabel')}
                  />
                </th>
                <th className="py-3 px-2">
                  <SortableHeader
                    label="Comisión"
                    active={sortField === 'commissionName'}
                    direction={sortDir}
                    onClick={() => toggleSort('commissionName')}
                  />
                </th>
                <th className="py-3 px-2 font-semibold">Filiación</th>
                <th className="py-3 px-2">
                  <SortableHeader
                    label="Estado"
                    active={sortField === 'active'}
                    direction={sortDir}
                    onClick={() => toggleSort('active')}
                  />
                </th>
                <th className="py-3 px-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {pagedRows.map(({ pub, priv }) => {
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
                          <span className="truncate max-w-[180px]">{pub.fullName}</span>
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
                            <div className="text-[11px] font-mono-num text-slate-500">
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
                          disabled={pub.uid === uid || (pub.roleLabel === 'Presidente' && !canAssignPres)}
                          onChange={(e) => setEditRole(e.target.value as RoleLabel)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs disabled:opacity-60"
                        >
                          <option value="Consejero">Consejero</option>
                          <option value="Consejero Departamental">Consejero Departamental</option>
                          {(canAssignPres || pub.roleLabel === 'Presidente') && (
                            <option value="Presidente">Presidente</option>
                          )}
                          <option value="Vicepresidente">Vicepresidente</option>
                          <option value="Secretario">Secretario</option>
                        </select>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 font-semibold whitespace-nowrap ${
                              pub.roleLabel === 'Consejero Departamental'
                                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300'
                            }`}
                          >
                            {pub.roleLabel}
                          </span>
                          {commissions
                            .filter((c) => c.coordinatorUid === pub.uid)
                            .map((c) => (
                              <span
                                key={c.id}
                                className="inline-block rounded-md bg-teal-50 dark:bg-teal-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300 whitespace-nowrap"
                              >
                                Coord. Com. {c.number}
                              </span>
                            ))}
                          {(() => {
                            const userGrants = grantedPermissions.filter(
                              (g) => g.userUid === pub.uid && isGrantActive(g)
                            );
                            if (userGrants.length === 0) return null;
                            return (
                              <span
                                title={userGrants.map((g) => g.permissionLabel).join(', ')}
                                className="inline-block rounded-md bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                              >
                                {userGrants.length} permiso(s) especial(es)
                              </span>
                            );
                          })()}
                        </div>
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
                            <div className="text-[11px] text-slate-500">{pub.affiliationName}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 font-semibold whitespace-nowrap ${
                          pub.active
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                              title="Guardar cambios"
                              aria-label="Guardar cambios"
                              className="rounded-lg bg-emerald-700 p-1.5 text-white hover:bg-emerald-800 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              title="Cancelar"
                              aria-label="Cancelar edición"
                              className="rounded-lg bg-slate-200 dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            {canEditUsers && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setPhotoTarget(pub)}
                                  title="Subir o ajustar foto de perfil"
                                  aria-label={`Foto de ${pub.fullName}`}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 cursor-pointer"
                                >
                                  <Camera className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEdit(pub, priv)}
                                  title="Editar consejero"
                                  aria-label={`Editar a ${pub.fullName}`}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                            {pub.uid !== uid && (
                              <>
                                {canSuspendUsers && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleActive(pub)}
                                    title={pub.active ? 'Desactivar acceso' : 'Reactivar acceso'}
                                    aria-label={pub.active ? 'Desactivar acceso' : 'Reactivar acceso'}
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
                                )}
                                {canDeleteUsers && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(pub)}
                                    title="Eliminar consejero"
                                    aria-label={`Eliminar a ${pub.fullName}`}
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
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No hay consejeros que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          totalItems={rows.length}
          page={safePage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Seguridad y códigos institucionales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {canRotateSecurity ? (
          <form onSubmit={handleUpdateSecurityConfig} className="cmj-card p-6 space-y-4">
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
                aria-label="Nuevo código de invitación"
                className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
              <input
                type="text"
                required
                minLength={6}
                value={newInitialPwd}
                onChange={(e) => setNewInitialPwd(e.target.value)}
                placeholder="Nueva contraseña inicial"
                aria-label="Nueva contraseña inicial"
                className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={savingSec}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Shield className="h-4 w-4" />
              {savingSec ? 'Guardando...' : 'Actualizar credenciales institucionales'}
            </button>
          </form>
        ) : (
          <PermissionDeniedBanner permission="usuarios.credenciales_rotar" />
        )}

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

            <button
              type="button"
              onClick={() => setPurgeDialogOpen(true)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar datos de ejemplo
            </button>
          </div>
        )}
      </div>

      {/* Modal foto de perfil de consejero */}
      <ResponsiveModal
        open={Boolean(photoTarget)}
        title={photoTarget ? `Foto de perfil · ${photoTarget.fullName}` : 'Foto de perfil'}
        subtitle={photoTarget?.roleLabel}
        maxWidthClass="sm:max-w-lg"
        onClose={() => setPhotoTarget(null)}
      >
        {photoTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AvatarBadge
                name={photoTarget.fullName}
                photoUrl={photoTarget.photoUrl}
                thumbUrl={photoTarget.photoThumbUrl}
                mediumUrl={photoTarget.photoMediumUrl}
                accentColor={commissions.find((c) => c.id === photoTarget.commissionId)?.accentColor}
                size="md"
              />
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">{photoTarget.fullName}</p>
                <p>{photoTarget.commissionName || 'Sin comisión asignada'}</p>
              </div>
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
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2 text-xs font-semibold text-rose-600 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar foto actual
                </button>
              </div>
            )}
          </div>
        )}
      </ResponsiveModal>

      {/* Confirmación de eliminación de consejero */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar consejero del directorio"
        description={
          deleteTarget
            ? `¿Seguro deseas eliminar a ${deleteTarget.fullName} (${deleteTarget.roleLabel})? Se revocará su acceso al portal privado.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Confirmación de purga de ejemplos */}
      <ConfirmDialog
        open={purgeDialogOpen}
        title="Purgar registros de ejemplo"
        description="Se eliminarán los registros ficticios heredados de prueba. Tus consejeros reales, configuración básica y las 5 comisiones permanecerán intactos."
        confirmLabel="Ejecutar limpieza ahora"
        loading={purging}
        onConfirm={handlePurgeSamples}
        onCancel={() => setPurgeDialogOpen(false)}
      />
    </div>
  );
}
