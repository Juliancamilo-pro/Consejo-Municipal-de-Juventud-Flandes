import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileText,
  KeyRound,
  Paperclip,
  Send,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { exportStyledWorkbook } from '../../lib/excelExport';
import { downloadPermissionRequestDocx } from '../../lib/permissionDocxExport';
import {
  PERMISSIONS_CATALOG,
  countRealJustificationChars,
  getPermissionMeta,
  isGrantActive,
  validatePermissionJustification,
} from '../../lib/permissions';
import type {
  Commission,
  CouncilorPrivate,
  GrantedPermission,
  PermissionApprovalStep,
  PermissionDurationType,
  PermissionKey,
  PermissionRequest,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { MediaUploader } from '../MediaUploader';
import { useToast } from '../ToastProvider';
import { ConfirmDialog, PaginationBar, ResponsiveModal } from '../ui/DataTableUI';
import { EmptyState } from '../ui/AnimatedPrimitives';
import { usePermissions, type PermissionRequestPrefill } from './PermissionGate';

const STATUS_META: Record<
  PermissionRequest['status'],
  { label: string; badgeClass: string }
> = {
  pendiente_presidente: {
    label: 'Paso 1/3 · Presidencia',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  },
  pendiente_vicepresidente: {
    label: 'Paso 2/3 · Vicepresidencia',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  },
  pendiente_secretario: {
    label: 'Paso 3/3 · Secretaría',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300',
  },
  aprobada: {
    label: 'Aprobada y Activa',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  rechazada: {
    label: 'Rechazada',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  },
  cancelada: {
    label: 'Cancelada',
    badgeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

const ROLE_APPROVAL_KEY: Record<'Presidente' | 'Vicepresidente' | 'Secretario', PermissionKey> = {
  Presidente: 'permisos.aprobar_presidencia',
  Vicepresidente: 'permisos.aprobar_vicepresidencia',
  Secretario: 'permisos.aprobar_secretaria',
};

function formatDateTime(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isOverdue48h(req: PermissionRequest): boolean {
  if (!req.status.startsWith('pendiente_')) return false;
  const ref = new Date(String(req.updatedAt || req.createdAt || '')).getTime();
  if (Number.isNaN(ref)) return false;
  return Date.now() - ref >= 48 * 60 * 60 * 1000;
}

type EffectiveRequestBadge = {
  state: 'pendiente' | 'aprobada' | 'rechazada' | 'vencida' | 'revocado' | 'cancelada';
  label: string;
  badgeClass: string;
};

function getEffectiveRequestBadge(
  req: PermissionRequest,
  grants: GrantedPermission[]
): EffectiveRequestBadge {
  if (req.status.startsWith('pendiente_')) {
    const meta = STATUS_META[req.status];
    return {
      state: 'pendiente',
      label: `Pendiente · ${meta.label}`,
      badgeClass: meta.badgeClass,
    };
  }
  if (req.status === 'rechazada') {
    return {
      state: 'rechazada',
      label: STATUS_META.rechazada.label,
      badgeClass: STATUS_META.rechazada.badgeClass,
    };
  }
  if (req.status === 'cancelada') {
    return {
      state: 'cancelada',
      label: STATUS_META.cancelada.label,
      badgeClass: STATUS_META.cancelada.badgeClass,
    };
  }
  const linkedGrant = grants.find((g) => g.requestId === req.id);
  if (linkedGrant?.revokedAt) {
    return {
      state: 'revocado',
      label: 'Revocada',
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    };
  }
  const isExpiredByGrant = linkedGrant ? !isGrantActive(linkedGrant) : false;
  const expTs = req.expiresAt ? Date.parse(req.expiresAt) : NaN;
  const isExpiredByDate =
    req.durationType === 'temporal' &&
    !Number.isNaN(expTs) &&
    expTs <= Date.now();
  if (isExpiredByGrant || isExpiredByDate) {
    return {
      state: 'vencida',
      label: 'Vencida',
      badgeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };
  }
  return {
    state: 'aprobada',
    label: 'Aprobada',
    badgeClass: STATUS_META.aprobada.badgeClass,
  };
}

export function PermissionsModule({
  uid,
  roleLabel,
  commissions,
  publicCouncilors,
  privateCouncilors,
  permissionRequests,
  permissionApprovalSteps,
  grantedPermissions,
  prefill,
  onClearPrefill,
}: {
  uid: string;
  roleLabel: RoleLabel;
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  privateCouncilors: CouncilorPrivate[];
  permissionRequests: PermissionRequest[];
  permissionApprovalSteps: PermissionApprovalStep[];
  grantedPermissions: GrantedPermission[];
  prefill?: PermissionRequestPrefill | null;
  onClearPrefill?: () => void;
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();

  const canApproveAny =
    can('permisos.aprobar_presidencia') ||
    can('permisos.aprobar_vicepresidencia') ||
    can('permisos.aprobar_secretaria') ||
    can('permisos.revocar') ||
    permissionApprovalSteps.some((s) => s.expectedApproverUid === uid && s.status === 'pendiente');

  const requestableOptions = useMemo(
    () =>
      PERMISSIONS_CATALOG.filter(
        (item) => item.requestable && !can(item.key)
      ),
    [can]
  );

  const initialKey: PermissionKey =
    (prefill?.permissionKey &&
      PERMISSIONS_CATALOG.find((p) => p.key === prefill.permissionKey && p.requestable)?.key) ||
    requestableOptions[0]?.key ||
    'actas.crear';

  const [tab, setTab] = useState<'solicitar' | 'mis_solicitudes' | 'aprobaciones'>(
    prefill ? 'solicitar' : canApproveAny ? 'aprobaciones' : 'solicitar'
  );

  // Formulario de nueva solicitud
  const [selectedPermKey, setSelectedPermKey] = useState<PermissionKey>(initialKey);
  const [targetCommissionId, setTargetCommissionId] = useState<string>(prefill?.commissionId || '');
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');
  const [durationType, setDurationType] = useState<PermissionDurationType>('temporal');
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<PermissionRequest | null>(null);
  const [downloadingDocxId, setDownloadingDocxId] = useState<string | null>(null);

  // Filtros en bandeja de aprobaciones / historial
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'todas' | 'pendientes_mi' | 'en_curso' | 'aprobada' | 'rechazada' | 'vencida_revocada'
  >(canApproveAny ? 'pendientes_mi' : 'en_curso');
  const [page, setPage] = useState(1);

  // Modales de decisión, delegación, revocación y cancelación
  const [decideTarget, setDecideTarget] = useState<{
    req: PermissionRequest;
    decision: 'aprobar' | 'rechazar';
  } | null>(null);
  const [decideComment, setDecideComment] = useState('');
  const [delegateTarget, setDelegateTarget] = useState<PermissionRequest | null>(null);
  const [delegateToUid, setDelegateToUid] = useState('');
  const [delegateReason, setDelegateReason] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<GrantedPermission | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [cancelTarget, setCancelTarget] = useState<PermissionRequest | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  React.useEffect(() => {
    if (prefill?.permissionKey) {
      setSelectedPermKey(prefill.permissionKey);
      if (prefill.commissionId) setTargetCommissionId(prefill.commissionId);
      setTab('solicitar');
    }
  }, [prefill]);

  const selectedMeta = useMemo(() => getPermissionMeta(selectedPermKey), [selectedPermKey]);
  const realReasonChars = useMemo(() => countRealJustificationChars(reason), [reason]);
  const liveValidation = useMemo(
    () =>
      validatePermissionJustification({
        reason,
        purpose,
        targetModule: selectedMeta.moduleLabel,
        durationType,
        expiresAt,
      }),
    [reason, purpose, selectedMeta.moduleLabel, durationType, expiresAt]
  );

  const stepsByReq = useMemo(() => {
    const map = new Map<string, PermissionApprovalStep[]>();
    for (const s of permissionApprovalSteps) {
      const list = map.get(s.requestId) || [];
      list.push(s);
      map.set(s.requestId, list);
    }
    for (const [k, list] of map.entries()) {
      map.set(
        k,
        [...list].sort((a, b) => a.stepOrder - b.stepOrder)
      );
    }
    return map;
  }, [permissionApprovalSteps]);

  const isMyPendingTurn = (req: PermissionRequest): boolean => {
    if (!req.status.startsWith('pendiente_')) return false;
    if (req.requesterUid === uid) return false;
    const steps = stepsByReq.get(req.id) || [];
    const currentStep = steps.find((s) => s.stepOrder === req.currentStepOrder);
    if (!currentStep || currentStep.status !== 'pendiente') return false;
    const rolePerm = ROLE_APPROVAL_KEY[currentStep.approverRole];
    return can(rolePerm) || currentStep.expectedApproverUid === uid;
  };

  const pendingForMeCount = useMemo(
    () => permissionRequests.filter((r) => isMyPendingTurn(r)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permissionRequests, permissionApprovalSteps, uid, roleLabel]
  );

  const myRequests = useMemo(
    () => permissionRequests.filter((r) => r.requesterUid === uid),
    [permissionRequests, uid]
  );

  const myActiveGrants = useMemo(
    () => grantedPermissions.filter((g) => g.userUid === uid && isGrantActive(g)),
    [grantedPermissions, uid]
  );

  const allActiveGrants = useMemo(
    () => grantedPermissions.filter((g) => isGrantActive(g)),
    [grantedPermissions]
  );

  const duplicatePendingRequest = useMemo(() => {
    const scopeId = selectedMeta.commissionScoped ? targetCommissionId : '';
    return myRequests.find(
      (r) =>
        r.permissionKey === selectedPermKey &&
        (r.targetCommissionId || '') === scopeId &&
        r.status.startsWith('pendiente_')
    );
  }, [myRequests, selectedPermKey, selectedMeta.commissionScoped, targetCommissionId]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permissionRequests.filter((r) => {
      const eff = getEffectiveRequestBadge(r, grantedPermissions);
      if (statusFilter === 'pendientes_mi' && !isMyPendingTurn(r)) return false;
      if (statusFilter === 'en_curso' && !r.status.startsWith('pendiente_')) return false;
      if (statusFilter === 'aprobada' && eff.state !== 'aprobada') return false;
      if (statusFilter === 'rechazada' && eff.state !== 'rechazada') return false;
      if (statusFilter === 'vencida_revocada' && eff.state !== 'vencida' && eff.state !== 'revocado') {
        return false;
      }
      if (!q) return true;
      return (
        r.requesterName.toLowerCase().includes(q) ||
        r.permissionLabel.toLowerCase().includes(q) ||
        r.targetModule.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionRequests, grantedPermissions, statusFilter, search, permissionApprovalSteps, uid]);

  const PAGE_SIZE = 6;
  const pagedRequests = filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeDelegationCandidates = useMemo(() => {
    const activeUids = new Set(privateCouncilors.filter((u) => u.active !== false).map((u) => u.uid));
    return publicCouncilors.filter((c) => c.active && (activeUids.size === 0 || activeUids.has(c.uid)));
  }, [publicCouncilors, privateCouncilors]);

  const handleDownloadWord = async (req: PermissionRequest) => {
    setDownloadingDocxId(req.id);
    try {
      const applicantPub = publicCouncilors.find((p) => p.uid === req.requesterUid);
      const applicantPriv = privateCouncilors.find((p) => p.uid === req.requesterUid);
      const eff = getEffectiveRequestBadge(req, grantedPermissions);
      await downloadPermissionRequestDocx({
        request: req,
        applicantPosition:
          applicantPub?.cargoDeclarado || applicantPriv?.cargoDeclarado || req.requesterRoleLabel,
        applicantCommission:
          applicantPub?.commissionName ||
          req.targetCommissionName ||
          'Sin comisión asignada',
        steps: stepsByReq.get(req.id) || [],
        effectiveStatusLabel: eff.label,
      });
      showToast('Plantilla Word (.docx) descargada correctamente.', 'success');
    } catch {
      showToast('No fue posible generar el documento Word.', 'error');
    } finally {
      setDownloadingDocxId(null);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicatePendingRequest) {
      showToast('Ya tienes una solicitud pendiente en curso para este permiso.', 'error');
      return;
    }
    if (!liveValidation.valid) {
      showToast(liveValidation.error || 'Completa la justificación obligatoria.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<{ id: string; status: PermissionRequest['status']; request?: PermissionRequest; ok: boolean }>(
        '/api/permissions/requests',
        {
          method: 'POST',
          body: {
            permissionKey: selectedPermKey,
            targetModule: selectedMeta.moduleLabel,
            targetCommissionId: selectedMeta.commissionScoped ? targetCommissionId : '',
            purpose: purpose.trim(),
            reason: reason.trim(),
            durationType,
            expiresAt: durationType === 'temporal' ? new Date(expiresAt).toISOString() : '',
            attachmentUrl,
            attachmentName,
          },
        }
      );
      if (res.request) {
        setLastSubmittedRequest(res.request);
      }
      showToast('Solicitud radicada en flujo secuencial (Presidente → Vicepresidente → Secretario).', 'success');
      setPurpose('');
      setReason('');
      setAttachmentUrl('');
      setAttachmentName('');
      onClearPrefill?.();
      setTab('mis_solicitudes');
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'No fue posible radicar la solicitud.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDecision = async () => {
    if (!decideTarget) return;
    if (decideTarget.decision === 'rechazar' && decideComment.trim().length < 10) {
      showToast('Indica el motivo del rechazo (mínimo 10 caracteres).', 'error');
      return;
    }
    setActionBusy(true);
    try {
      await apiRequest(`/api/permissions/requests/${decideTarget.req.id}/decide`, {
        method: 'POST',
        body: {
          decision: decideTarget.decision,
          comment: decideComment.trim(),
        },
      });
      showToast(
        decideTarget.decision === 'aprobar'
          ? 'Decisión de aprobación registrada en la cadena.'
          : 'Solicitud rechazada y notificada al solicitante.',
        'success'
      );
      setDecideTarget(null);
      setDecideComment('');
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al procesar decisión.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmDelegate = async () => {
    if (!delegateTarget) return;
    if (!delegateToUid || delegateReason.trim().length < 10) {
      showToast('Selecciona un suplente activo y explica el motivo de ausencia (>= 10 caracteres).', 'error');
      return;
    }
    setActionBusy(true);
    try {
      await apiRequest(`/api/permissions/requests/${delegateTarget.id}/delegate`, {
        method: 'POST',
        body: {
          delegateToUid,
          reason: delegateReason.trim(),
        },
      });
      showToast('Paso delegado correctamente al directivo suplente.', 'success');
      setDelegateTarget(null);
      setDelegateToUid('');
      setDelegateReason('');
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al delegar paso.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    if (revokeReason.trim().length < 10) {
      showToast('El motivo de revocación es obligatorio (mínimo 10 caracteres).', 'error');
      return;
    }
    setActionBusy(true);
    try {
      await apiRequest(`/api/permissions/grants/${revokeTarget.id}/revoke`, {
        method: 'POST',
        body: { reason: revokeReason.trim() },
      });
      showToast('Permiso especial revocado de inmediato.', 'success');
      setRevokeTarget(null);
      setRevokeReason('');
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al revocar permiso.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelTarget) return;
    setActionBusy(true);
    try {
      await apiRequest(`/api/permissions/requests/${cancelTarget.id}/cancel`, { method: 'POST' });
      showToast('Solicitud cancelada.', 'info');
      setCancelTarget(null);
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al cancelar.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportExcel = async () => {
    await exportStyledWorkbook({
      fileName: `Permisos_Especiales_CMJ_${new Date().toISOString().slice(0, 10)}.xlsx`,
      reportTitle: 'HISTORIAL DE SOLICITUDES Y PERMISOS ESPECIALES',
      moduleName: 'Solicitudes de Permisos',
      sheets: [
        {
          name: 'Solicitudes',
          title: 'HISTORIAL DE SOLICITUDES DE PERMISOS ESPECIALES — CMJ FLANDES',
          subtitle: `Generado: ${new Date().toLocaleString('es-CO')} · Total: ${permissionRequests.length}`,
          columns: [
            { key: 'fecha', header: 'Fecha', minWidth: 20 },
            { key: 'solicitante', header: 'Solicitante', minWidth: 24 },
            { key: 'cargo', header: 'Cargo', minWidth: 16 },
            { key: 'permiso', header: 'Permiso', minWidth: 32 },
            { key: 'alcance', header: 'Módulo / Alcance', minWidth: 24 },
            { key: 'duracion', header: 'Duración', minWidth: 14 },
            { key: 'expira', header: 'Expira', minWidth: 20 },
            { key: 'estado', header: 'Estado', minWidth: 22 },
            { key: 'justificacion', header: 'Justificación', minWidth: 45, wrap: true },
          ],
          rows: permissionRequests.map((r) => ({
            fecha: formatDateTime(r.createdAt),
            solicitante: r.requesterName,
            cargo: r.requesterRoleLabel,
            permiso: r.permissionLabel,
            alcance: r.targetCommissionName ? `${r.targetModule} (${r.targetCommissionName})` : r.targetModule,
            duracion: r.durationType === 'permanente' ? 'Permanente' : 'Temporal',
            expira: r.expiresAt ? formatDateTime(r.expiresAt) : 'N/A',
            estado: STATUS_META[r.status]?.label || r.status,
            justificacion: r.reason,
          })),
        },
        {
          name: 'Permisos Otorgados',
          title: 'PERMISOS ESPECIALES OTORGADOS Y REVOCADOS — CMJ FLANDES',
          subtitle: `Registros: ${grantedPermissions.length}`,
          columns: [
            { key: 'usuario', header: 'Usuario', minWidth: 24 },
            { key: 'permiso', header: 'Permiso', minWidth: 32 },
            { key: 'estado', header: 'Estado Actual', minWidth: 16 },
            { key: 'vigencia', header: 'Vigencia', minWidth: 14 },
            { key: 'expira', header: 'Expira', minWidth: 20 },
            { key: 'revocadoPor', header: 'Revocado Por', minWidth: 22 },
            { key: 'motivoRevocacion', header: 'Motivo Revocación', minWidth: 36, wrap: true },
          ],
          rows: grantedPermissions.map((g) => ({
            usuario: g.userName,
            permiso: g.permissionLabel,
            estado: isGrantActive(g) ? 'Activo' : g.revokedAt ? 'Revocado' : 'Expirado',
            vigencia: g.durationType === 'permanente' ? 'Permanente' : 'Temporal',
            expira: g.expiresAt ? formatDateTime(g.expiresAt) : 'N/A',
            revocadoPor: g.revokedByName || '—',
            motivoRevocacion: g.revocationReason || '—',
          })),
        },
      ],
    });
    showToast('Reporte de permisos exportado a Excel.', 'success');
  };

  const renderTimeline = (req: PermissionRequest) => {
    const steps = stepsByReq.get(req.id) || [];
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2">
        {steps.map((step) => {
          const isCurrent = req.status.startsWith('pendiente_') && req.currentStepOrder === step.stepOrder;
          const badge =
            step.status === 'aprobado'
              ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/25'
              : step.status === 'rechazado'
              ? 'border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/25'
              : step.status === 'omitido'
              ? 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40'
              : isCurrent
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 ring-1 ring-amber-400/40'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40';
          return (
            <div key={step.id} className={`rounded-xl border p-3 space-y-1 text-xs ${badge}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {step.stepOrder}. {step.approverRole}
                </span>
                <span className="font-semibold text-[11px]">
                  {step.status === 'aprobado' && 'Aprobado'}
                  {step.status === 'rechazado' && 'Rechazado'}
                  {step.status === 'omitido' && 'Omitido'}
                  {step.status === 'pendiente' && (isCurrent ? 'En turno' : 'En espera')}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                {step.decidedByName || step.expectedApproverName || `Titular de ${step.approverRole}`}
              </p>
              {step.delegatedFromUid && (
                <p className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                  Delegado por ausencia: {step.delegatedReason}
                </p>
              )}
              {step.comment && (
                <p className="text-[11px] text-slate-700 dark:text-slate-200 italic">
                  “{step.comment}”
                </p>
              )}
              {step.decidedAt && (
                <p className="text-[10px] text-slate-400">{formatDateTime(step.decidedAt)}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Solicitudes y Permisos Especiales
          </h2>
          <p className="text-sm text-slate-500">
            Flujo secuencial obligatorio: 1. Presidencia → 2. Vicepresidencia → 3. Secretaría.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can('permisos.exportar') && permissionRequests.length > 0 && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" /> Exportar historial
            </button>
          )}
        </div>
      </div>

      {/* Pestañas principales */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setTab('solicitar')}
          className={`min-h-[40px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
            tab === 'solicitar'
              ? 'bg-emerald-700 text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Send className="h-3.5 w-3.5" /> Nueva solicitud
        </button>
        <button
          type="button"
          onClick={() => setTab('mis_solicitudes')}
          className={`min-h-[40px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
            tab === 'mis_solicitudes'
              ? 'bg-emerald-700 text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" /> Mis solicitudes ({myRequests.length})
        </button>
        {canApproveAny && (
          <button
            type="button"
            onClick={() => setTab('aprobaciones')}
            className={`min-h-[40px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap ${
              tab === 'aprobaciones'
                ? 'bg-emerald-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Aprobaciones y Vigentes
            {pendingForMeCount > 0 && (
              <span className="rounded-md bg-rose-600 text-white px-1.5 py-0.5 text-[10px] font-mono-num">
                {pendingForMeCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TAB 1: SOLICITAR PERMISO */}
      {tab === 'solicitar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={handleSubmitRequest}
            className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Radicar solicitud de permiso especial
            </h3>

            {requestableOptions.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="h-7 w-7 text-emerald-600" />}
                title="Ya cuentas con todos los permisos solicitables"
                description="Tu cargo actual ya incluye los permisos operativos del portal."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Permiso solicitado *
                    </label>
                    <select
                      value={selectedPermKey}
                      onChange={(e) => setSelectedPermKey(e.target.value as PermissionKey)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
                    >
                      {requestableOptions.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.moduleLabel} — {item.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">{selectedMeta.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Alcance o comisión (opcional)
                    </label>
                    {selectedMeta.commissionScoped ? (
                      <select
                        value={targetCommissionId}
                        onChange={(e) => setTargetCommissionId(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        <option value="">Todas / Alcance general del permiso</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            Comisión {c.number}: {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/60 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                        Módulo: {selectedMeta.moduleLabel}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Finalidad concreta (¿Para qué lo necesitas?) *
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Ej: Subir actas y soportes de la jornada juvenil del barrio La Capilla"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Justificación detallada obligatoria (mínimo 100 caracteres reales) *
                    </label>
                    <span
                      className={`text-[11px] font-bold font-mono-num ${
                        realReasonChars >= 100 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'
                      }`}
                    >
                      {realReasonChars} / 100 reales
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explica detalladamente el motivo institucional, las actividades o sesiones que respaldan esta solicitud y por qué requieres el acceso..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs leading-relaxed"
                  />
                  {reason.trim().length > 0 && !liveValidation.valid && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      {liveValidation.error}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Duración solicitada *
                    </label>
                    <select
                      value={durationType}
                      onChange={(e) => setDurationType(e.target.value as PermissionDurationType)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
                    >
                      <option value="temporal">Temporal (con fecha de vencimiento)</option>
                      <option value="permanente">Permanente (sujeto a revocación)</option>
                    </select>
                  </div>

                  {durationType === 'temporal' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Fecha y hora de expiración *
                      </label>
                      <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                      />
                    </div>
                  )}
                </div>

                {duplicatePendingRequest && (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Solicitud duplicada detectada</p>
                      <p className="text-[11px] mt-0.5">
                        Ya tienes una solicitud pendiente ({duplicatePendingRequest.id}) para este mismo permiso y alcance. Espera su decisión o cancélala en “Mis solicitudes” antes de radicar otra.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Documento o soporte opcional (PDF/imagen)
                  </label>
                  <MediaUploader
                    storageFolder="permission-supports"
                    label={attachmentName ? `Adjunto: ${attachmentName}` : 'Adjuntar soporte (opcional)'}
                    helperText="Puedes adjuntar un archivo PDF o imagen de respaldo institucional (máx. 20 MB)."
                    onUploaded={(files) => {
                      const first = files[0];
                      if (first) {
                        setAttachmentUrl(first.url);
                        setAttachmentName(first.fileName);
                      }
                    }}
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !liveValidation.valid || Boolean(duplicatePendingRequest)}
                    className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? 'Enviando solicitud...' : 'Enviar para aprobación'}
                  </button>
                </div>
              </>
            )}
          </form>

          <aside className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 h-fit">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Reglas de aprobación CMJ
            </h4>
            <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">1.</span>
                <span>
                  <strong>Presidencia</strong> revisa la pertinencia institucional y riesgo del permiso.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">2.</span>
                <span>
                  <strong>Vicepresidencia</strong> valida el alcance en comisiones y operatividad.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">3.</span>
                <span>
                  <strong>Secretaría</strong> otorga la firma final que activa el permiso en el sistema.
                </span>
              </li>
            </ol>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-[11px] text-slate-500 space-y-1">
              <p>• Ningún usuario puede aprobar su propia solicitud.</p>
              <p>• Si un directivo tarda más de 48h, el portal envía recordatorio automático.</p>
              <p>• Presidencia puede revocar cualquier permiso activo en cualquier momento.</p>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 2: MIS SOLICITUDES Y PERMISOS ACTIVOS */}
      {tab === 'mis_solicitudes' && (
        <div className="space-y-6">
          {lastSubmittedRequest && (
            <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  Solicitud radicada con éxito (Radicado: {lastSubmittedRequest.id})
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Puedes descargar ahora la plantilla oficial en Word con todos tus datos, justificación y espacios de firma.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={downloadingDocxId === lastSubmittedRequest.id}
                  onClick={() => handleDownloadWord(lastSubmittedRequest)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" />
                  {downloadingDocxId === lastSubmittedRequest.id
                    ? 'Generando Word...'
                    : 'Descargar plantilla Word'}
                </button>
                <button
                  type="button"
                  onClick={() => setLastSubmittedRequest(null)}
                  className="min-h-[40px] rounded-xl border border-emerald-300 dark:border-emerald-800 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 cursor-pointer"
                >
                  Ocultar
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Mis permisos especiales vigentes ({myActiveGrants.length})
            </h3>
            {myActiveGrants.length === 0 ? (
              <p className="text-xs text-slate-500">
                No tienes permisos especiales activos fuera de tu cargo ({roleLabel}).
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myActiveGrants.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {g.permissionLabel}
                      </span>
                      <span className="rounded-md bg-emerald-700 text-white px-2 py-0.5 text-[10px] font-bold">
                        {g.durationType === 'permanente' ? 'Permanente' : 'Temporal'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Módulo: {g.targetModule}
                      {g.expiresAt ? ` · Expira: ${formatDateTime(g.expiresAt)}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <EmptyState
                icon={<FileCheck2 className="h-7 w-7 text-slate-400" />}
                title="Aún no has enviado solicitudes"
                description="Cuando necesites realizar una acción fuera de tu rol actual, podrás justificarla aquí."
              />
            ) : (
              myRequests.map((req) => {
                const eff = getEffectiveRequestBadge(req, grantedPermissions);
                return (
                  <div
                    key={req.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {req.permissionLabel}
                          </h4>
                          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${eff.badgeClass}`}>
                            {eff.label}
                          </span>
                          {isOverdue48h(req) && (
                            <span className="rounded-md bg-amber-600 text-white px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> +48h sin respuesta
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Radicado: <span className="font-mono-num">{req.id}</span> · Alcance: {req.targetModule}
                          {req.targetCommissionName ? ` (${req.targetCommissionName})` : ''} ·{' '}
                          {req.durationType === 'permanente'
                            ? 'Permanente'
                            : `Temporal hasta ${formatDateTime(req.expiresAt)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={downloadingDocxId === req.id}
                          onClick={() => handleDownloadWord(req)}
                          className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap disabled:opacity-60"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {downloadingDocxId === req.id ? 'Generando...' : 'Descargar plantilla Word'}
                        </button>
                        {req.status.startsWith('pendiente_') && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(req)}
                            className="min-h-[36px] rounded-xl border border-rose-200 dark:border-rose-900 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                          >
                            Cancelar solicitud
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                      <strong>Finalidad:</strong> {req.purpose} — {req.reason}
                    </p>
                    {req.rejectionReason && (
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                        Motivo del rechazo: {req.rejectionReason}
                      </p>
                    )}
                    {renderTimeline(req)}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: APROBACIONES Y REVOCACIÓN */}
      {tab === 'aprobaciones' && canApproveAny && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row gap-3 justify-between">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por solicitante, permiso o justificación..."
              className="w-full sm:max-w-sm min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['pendientes_mi', `Por mi firma (${pendingForMeCount})`],
                  ['en_curso', 'En curso'],
                  ['aprobada', 'Aprobadas'],
                  ['rechazada', 'Rechazadas'],
                  ['vencida_revocada', 'Vencidas / Revocadas'],
                  ['todas', 'Todas'],
                ] as const
              ).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setStatusFilter(val);
                    setPage(1);
                  }}
                  className={`min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap ${
                    statusFilter === val
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {pagedRequests.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-7 w-7 text-emerald-600" />}
              title="No hay solicitudes en esta bandeja"
              description="Cambia el filtro para consultar solicitudes históricas o ya aprobadas."
            />
          ) : (
            <div className="space-y-4">
              {pagedRequests.map((req) => {
                const eff = getEffectiveRequestBadge(req, grantedPermissions);
                const myTurn = isMyPendingTurn(req);
                const overdue = isOverdue48h(req);
                return (
                  <div
                    key={req.id}
                    className={`rounded-2xl border p-5 space-y-3 bg-white dark:bg-slate-900 ${
                      myTurn
                        ? 'border-emerald-300 dark:border-emerald-800'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {req.requesterName} ({req.requesterRoleLabel}) → {req.permissionLabel}
                          </h4>
                          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${eff.badgeClass}`}>
                            {eff.label}
                          </span>
                          {overdue && (
                            <span className="rounded-md bg-amber-600 text-white px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Demora +48h
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Radicado: <span className="font-mono-num">{req.id}</span> · {req.requesterEmail} · Alcance: {req.targetModule}
                          {req.targetCommissionName ? ` (${req.targetCommissionName})` : ''} ·{' '}
                          {req.durationType === 'permanente'
                            ? 'Permanente'
                            : `Temporal hasta ${formatDateTime(req.expiresAt)}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={downloadingDocxId === req.id}
                          onClick={() => handleDownloadWord(req)}
                          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap disabled:opacity-60"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {downloadingDocxId === req.id ? 'Generando...' : 'Descargar plantilla Word'}
                        </button>
                        {myTurn && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setDecideTarget({ req, decision: 'aprobar' });
                                setDecideComment('');
                              }}
                              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar paso {req.currentStepOrder}/3
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDecideTarget({ req, decision: 'rechazar' });
                                setDecideComment('');
                              }}
                              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 cursor-pointer whitespace-nowrap"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Rechazar
                            </button>
                          </>
                        )}

                        {req.status.startsWith('pendiente_') && can('permisos.delegar') && (
                          <button
                            type="button"
                            onClick={() => {
                              setDelegateTarget(req);
                              setDelegateToUid('');
                              setDelegateReason('');
                            }}
                            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Delegar paso
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3 text-xs space-y-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        Finalidad: {req.purpose}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {req.reason}
                      </p>
                      {req.attachmentUrl && (
                        <a
                          href={req.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline pt-1"
                        >
                          <Paperclip className="h-3 w-3" /> Ver soporte adjunto ({req.attachmentName || 'archivo'})
                        </a>
                      )}
                    </div>

                    {renderTimeline(req)}
                  </div>
                );
              })}

              <PaginationBar
                page={page}
                totalItems={filteredRequests.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}

          {/* Lista de permisos especiales activos revocables por Presidencia */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-600" /> Permisos especiales activos en el portal ({allActiveGrants.length})
            </h3>
            {allActiveGrants.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay permisos especiales activos otorgados en este momento.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {allActiveGrants.map((g) => (
                  <div key={g.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {g.userName} · {g.permissionLabel}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {g.userEmail} · Alcance: {g.targetModule} ·{' '}
                        {g.durationType === 'permanente'
                          ? 'Permanente'
                          : `Expira ${formatDateTime(g.expiresAt)}`}
                      </p>
                    </div>
                    {can('permisos.revocar') && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevokeTarget(g);
                          setRevokeReason('');
                        }}
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer whitespace-nowrap"
                      >
                        <Ban className="h-3.5 w-3.5" /> Revocar permiso
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL APROBAR / RECHAZAR */}
      <ResponsiveModal
        open={Boolean(decideTarget)}
        onClose={() => !actionBusy && setDecideTarget(null)}
        title={
          decideTarget?.decision === 'aprobar'
            ? `Aprobar paso ${decideTarget.req.currentStepOrder}/3`
            : 'Rechazar solicitud de permiso'
        }
        maxWidthClass="max-w-lg"
      >
        {decideTarget && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Solicitante: <strong>{decideTarget.req.requesterName}</strong> · Permiso:{' '}
              <strong>{decideTarget.req.permissionLabel}</strong>
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">
                {decideTarget.decision === 'rechazar'
                  ? 'Motivo obligatorio del rechazo (mínimo 10 caracteres) *'
                  : 'Observación de respaldo (opcional)'}
              </label>
              <textarea
                rows={3}
                value={decideComment}
                onChange={(e) => setDecideComment(e.target.value)}
                placeholder={
                  decideTarget.decision === 'rechazar'
                    ? 'Explica con claridad por qué no procede esta solicitud...'
                    : 'Ej: Verificada la necesidad para la jornada en territorio...'
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDecideTarget(null)}
                disabled={actionBusy}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={actionBusy}
                className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold text-white cursor-pointer ${
                  decideTarget.decision === 'aprobar'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionBusy
                  ? 'Guardando...'
                  : decideTarget.decision === 'aprobar'
                  ? 'Confirmar aprobación'
                  : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* MODAL DELEGAR */}
      <ResponsiveModal
        open={Boolean(delegateTarget)}
        onClose={() => !actionBusy && setDelegateTarget(null)}
        title="Delegar paso pendiente por ausencia o inactividad"
        maxWidthClass="max-w-lg"
      >
        {delegateTarget && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Si el titular de la firma en turno se encuentra ausente o inactivo, designa un directivo o consejero activo para suplir este paso.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Directivo / Consejero suplente *</label>
              <select
                value={delegateToUid}
                onChange={(e) => setDelegateToUid(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="">Selecciona un miembro activo...</option>
                {activeDelegationCandidates
                  .filter((c) => c.uid !== delegateTarget.requesterUid)
                  .map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.fullName} ({c.roleLabel})
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Motivo de la delegación (mínimo 10 caracteres) *</label>
              <textarea
                rows={3}
                value={delegateReason}
                onChange={(e) => setDelegateReason(e.target.value)}
                placeholder="Ej: Ausencia temporal del titular por incapacidad / licencia..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDelegateTarget(null)}
                disabled={actionBusy}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelegate}
                disabled={actionBusy}
                className="min-h-[40px] rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                {actionBusy ? 'Delegando...' : 'Delegar paso'}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* MODAL REVOCAR */}
      <ResponsiveModal
        open={Boolean(revokeTarget)}
        onClose={() => !actionBusy && setRevokeTarget(null)}
        title="Revocar permiso especial activo"
        maxWidthClass="max-w-lg"
      >
        {revokeTarget && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Se desactivará inmediatamente el permiso <strong>{revokeTarget.permissionLabel}</strong> de{' '}
              <strong>{revokeTarget.userName}</strong>.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Motivo obligatorio de revocación (mínimo 10 caracteres) *</label>
              <textarea
                rows={3}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Explica la razón de la revocación anticipada..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                disabled={actionBusy}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={actionBusy}
                className="min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                {actionBusy ? 'Revocando...' : 'Revocar inmediatamente'}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="¿Cancelar solicitud pendiente?"
        description="Esta solicitud dejará de estar en turno de aprobación. Podrás crear una nueva cuando la necesites."
        confirmLabel="Sí, cancelar solicitud"
        tone="danger"
        loading={actionBusy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelRequest}
      />
    </div>
  );
}
export default PermissionsModule;
