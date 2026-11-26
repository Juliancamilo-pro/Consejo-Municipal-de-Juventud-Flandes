import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  Lock,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { exportStyledWorkbook } from '../../lib/excelExport';
import { useUnsavedChangesGuard } from '../../lib/unsavedChanges';
import type {
  Commission,
  DeptInterlocutionReport,
  DeptOversightRecord,
  DeptProposal,
  DeptPublicationStatus,
  RoleLabel,
} from '../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { useToast } from '../ToastProvider';
import { EmptyState } from '../ui/AnimatedPrimitives';
import { ConfirmDialog, DataToolbar, ResponsiveModal } from '../ui/DataTableUI';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

type DeptTab = 'propuestas' | 'veeduria' | 'informes' | 'aprobaciones';
type DeptKind = 'proposals' | 'oversight' | 'reports';

const PUB_STATUS_META: Record<DeptPublicationStatus, { label: string; cls: string }> = {
  privado: {
    label: 'Privado interno',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  pendiente_presidencia: {
    label: 'Pendiente Presidencia',
    cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  },
  publicado: {
    label: 'Publicado en Portal',
    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  rechazado: {
    label: 'Devuelto por Presidencia',
    cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  },
};

const PROPOSAL_STATUS_LABELS: Record<DeptProposal['status'], string> = {
  borrador: 'Borrador',
  radicada: 'Radicada',
  en_concertacion: 'En concertación',
  aprobada: 'Aprobada / Acogida',
  archivada: 'Archivada',
};

const OVERSIGHT_STATUS_LABELS: Record<DeptOversightRecord['status'], string> = {
  en_seguimiento: 'En seguimiento',
  alerta: 'Alerta temprana',
  subsanada: 'Subsanada',
  cerrada: 'Cerrada',
};

const RISK_LABELS: Record<DeptOversightRecord['riskLevel'], { label: string; cls: string }> = {
  bajo: { label: 'Riesgo bajo', cls: 'text-emerald-700 dark:text-emerald-400' },
  medio: { label: 'Riesgo medio', cls: 'text-amber-700 dark:text-amber-400' },
  alto: { label: 'Riesgo alto', cls: 'text-rose-600 dark:text-rose-400' },
};

export function DepartamentalModule({
  uid,
  actorName,
  actorRoleLabel,
  commissions,
  deptProposals,
  deptOversight,
  deptReports,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  commissions: Commission[];
  deptProposals: DeptProposal[];
  deptOversight: DeptOversightRecord[];
  deptReports: DeptInterlocutionReport[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();

  const canView = can('departamental.ver') || can('departamental.publicacion_aprobar');
  const canCreateProposal = can('departamental.propuestas_crear');
  const canManageOversight = can('departamental.veeduria_gestionar');
  const canManageReports = can('departamental.informes_gestionar');
  const canApprovePublish = can('departamental.publicacion_aprobar');

  const isLeadership = ['Presidente', 'Vicepresidente', 'Secretario'].includes(actorRoleLabel);

  const [tab, setTab] = useState<DeptTab>('propuestas');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Modal / Form Propuestas
  const [proposalFormOpen, setProposalFormOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<DeptProposal | null>(null);
  const [propTitle, setPropTitle] = useState('');
  const [propEntity, setPropEntity] = useState('Gobernación del Tolima / Alcaldía de Flandes');
  const [propAxis, setPropAxis] = useState('Política Pública de Juventud');
  const [propCommId, setPropCommId] = useState('');
  const [propStatus, setPropStatus] = useState<DeptProposal['status']>('borrador');
  const [propSummary, setPropSummary] = useState('');
  const [propJustification, setPropJustification] = useState('');
  const [propFileUrl, setPropFileUrl] = useState('');
  const [propFileName, setPropFileName] = useState('');
  const [propRequestPub, setPropRequestPub] = useState(false);
  const [savingProp, setSavingProp] = useState(false);

  // Modal / Form Veeduría
  const [oversightFormOpen, setOversightFormOpen] = useState(false);
  const [editingOversight, setEditingOversight] = useState<DeptOversightRecord | null>(null);
  const [ovTitle, setOvTitle] = useState('');
  const [ovEntity, setOvEntity] = useState('');
  const [ovPolicy, setOvPolicy] = useState('');
  const [ovCommId, setOvCommId] = useState('');
  const [ovRisk, setOvRisk] = useState<DeptOversightRecord['riskLevel']>('medio');
  const [ovStatus, setOvStatus] = useState<DeptOversightRecord['status']>('en_seguimiento');
  const [ovFindings, setOvFindings] = useState('');
  const [ovRecommendations, setOvRecommendations] = useState('');
  const [ovFileUrl, setOvFileUrl] = useState('');
  const [ovFileName, setOvFileName] = useState('');
  const [ovRequestPub, setOvRequestPub] = useState(false);
  const [savingOv, setSavingOv] = useState(false);

  // Modal / Form Informes
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<DeptInterlocutionReport | null>(null);
  const [repTitle, setRepTitle] = useState('');
  const [repPeriod, setRepPeriod] = useState('Trimestre Actual');
  const [repDate, setRepDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repSpace, setRepSpace] = useState('Consejo Departamental de Juventud del Tolima');
  const [repCommId, setRepCommId] = useState('');
  const [repSummary, setRepSummary] = useState('');
  const [repAgreements, setRepAgreements] = useState('');
  const [repStrategies, setRepStrategies] = useState('');
  const [repFileUrl, setRepFileUrl] = useState('');
  const [repFileName, setRepFileName] = useState('');
  const [repRequestPub, setRepRequestPub] = useState(false);
  const [savingRep, setSavingRep] = useState(false);

  // Eliminar
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: DeptKind;
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Decisión de Presidencia (Rechazo con motivo obligatorio)
  const [rejectTarget, setRejectTarget] = useState<{
    kind: DeptKind;
    id: string;
    title: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [decidingPubId, setDecidingPubId] = useState<string | null>(null);

  const isDirty =
    proposalFormOpen || oversightFormOpen || reportFormOpen || Boolean(rejectTarget);
  useUnsavedChangesGuard('departamental-editor', isDirty);

  const pendingApprovals = useMemo(() => {
    const items: {
      kind: DeptKind;
      kindLabel: string;
      id: string;
      title: string;
      authorName: string;
      detail: string;
      subtitle: string;
      fileUrl?: string;
      fileName?: string;
    }[] = [];
    deptProposals
      .filter((p) => p.publicationStatus === 'pendiente_presidencia')
      .forEach((p) =>
        items.push({
          kind: 'proposals',
          kindLabel: 'Propuesta',
          id: p.id,
          title: p.title,
          authorName: p.authorName,
          subtitle: `${p.targetEntity} · ${p.thematicAxis}`,
          detail: p.summary,
          fileUrl: p.attachmentUrl,
          fileName: p.attachmentName,
        })
      );
    deptOversight
      .filter((o) => o.publicationStatus === 'pendiente_presidencia')
      .forEach((o) =>
        items.push({
          kind: 'oversight',
          kindLabel: 'Veeduría',
          id: o.id,
          title: o.title,
          authorName: o.authorName,
          subtitle: `${o.watchedEntity} · ${o.policyOrPlan}`,
          detail: o.findings,
          fileUrl: o.evidenceUrl,
          fileName: o.evidenceName,
        })
      );
    deptReports
      .filter((r) => r.publicationStatus === 'pendiente_presidencia')
      .forEach((r) =>
        items.push({
          kind: 'reports',
          kindLabel: 'Informe',
          id: r.id,
          title: r.title,
          authorName: r.authorName,
          subtitle: `${r.departamentalSpace} · ${r.reportPeriod}`,
          detail: r.summary,
          fileUrl: r.attachmentUrl,
          fileName: r.attachmentName,
        })
      );
    return items;
  }, [deptProposals, deptOversight, deptReports]);

  const filteredProposals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deptProposals.filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.targetEntity.toLowerCase().includes(q) ||
        p.thematicAxis.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q)
    );
  }, [deptProposals, search]);

  const filteredOversight = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deptOversight.filter(
      (o) =>
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.watchedEntity.toLowerCase().includes(q) ||
        o.policyOrPlan.toLowerCase().includes(q) ||
        o.findings.toLowerCase().includes(q)
    );
  }, [deptOversight, search]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deptReports.filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.departamentalSpace.toLowerCase().includes(q) ||
        r.reportPeriod.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q)
    );
  }, [deptReports, search]);

  if (!canView) {
    return (
      <div className="cmj-card p-6">
        <PermissionDeniedBanner permission="departamental.ver" />
      </div>
    );
  }

  // Helpers abrir modales
  const openCreateProposal = () => {
    setEditingProposal(null);
    setPropTitle('');
    setPropEntity('Gobernación del Tolima / Alcaldía de Flandes');
    setPropAxis('Política Pública de Juventud');
    setPropCommId('');
    setPropStatus('borrador');
    setPropSummary('');
    setPropJustification('');
    setPropFileUrl('');
    setPropFileName('');
    setPropRequestPub(false);
    setProposalFormOpen(true);
  };

  const openEditProposal = (p: DeptProposal) => {
    setEditingProposal(p);
    setPropTitle(p.title);
    setPropEntity(p.targetEntity);
    setPropAxis(p.thematicAxis);
    setPropCommId(p.commissionId || '');
    setPropStatus(p.status);
    setPropSummary(p.summary);
    setPropJustification(p.justification || '');
    setPropFileUrl(p.attachmentUrl || '');
    setPropFileName(p.attachmentName || '');
    setPropRequestPub(false);
    setProposalFormOpen(true);
  };

  const openCreateOversight = () => {
    setEditingOversight(null);
    setOvTitle('');
    setOvEntity('');
    setOvPolicy('');
    setOvCommId('');
    setOvRisk('medio');
    setOvStatus('en_seguimiento');
    setOvFindings('');
    setOvRecommendations('');
    setOvFileUrl('');
    setOvFileName('');
    setOvRequestPub(false);
    setOversightFormOpen(true);
  };

  const openEditOversight = (o: DeptOversightRecord) => {
    setEditingOversight(o);
    setOvTitle(o.title);
    setOvEntity(o.watchedEntity);
    setOvPolicy(o.policyOrPlan);
    setOvCommId(o.commissionId || '');
    setOvRisk(o.riskLevel);
    setOvStatus(o.status);
    setOvFindings(o.findings);
    setOvRecommendations(o.recommendations || '');
    setOvFileUrl(o.evidenceUrl || '');
    setOvFileName(o.evidenceName || '');
    setOvRequestPub(false);
    setOversightFormOpen(true);
  };

  const openCreateReport = () => {
    setEditingReport(null);
    setRepTitle('');
    setRepPeriod('');
    setRepDate(new Date().toISOString().slice(0, 10));
    setRepSpace('Consejo Departamental de Juventud del Tolima');
    setRepCommId('');
    setRepSummary('');
    setRepAgreements('');
    setRepStrategies('');
    setRepFileUrl('');
    setRepFileName('');
    setRepRequestPub(false);
    setReportFormOpen(true);
  };

  const openEditReport = (r: DeptInterlocutionReport) => {
    setEditingReport(r);
    setRepTitle(r.title);
    setRepPeriod(r.reportPeriod);
    setRepDate(r.sessionDate || '');
    setRepSpace(r.departamentalSpace);
    setRepCommId(r.commissionId || '');
    setRepSummary(r.summary);
    setRepAgreements(r.agreements || '');
    setRepStrategies(r.participationStrategies || '');
    setRepFileUrl(r.attachmentUrl || '');
    setRepFileName(r.attachmentName || '');
    setRepRequestPub(false);
    setReportFormOpen(true);
  };

  // Submits
  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (propTitle.trim().length < 4 || propEntity.trim().length < 3 || propSummary.trim().length < 10) {
      showToast('Completa título, entidad y resumen (mín. 10 caracteres)', 'error');
      return;
    }
    setSavingProp(true);
    try {
      const payload = {
        title: propTitle.trim(),
        targetEntity: propEntity.trim(),
        thematicAxis: propAxis.trim(),
        commissionId: propCommId,
        status: propStatus,
        summary: propSummary.trim(),
        justification: propJustification.trim(),
        attachmentUrl: propFileUrl,
        attachmentName: propFileName,
        requestPublish: propRequestPub,
      };
      if (editingProposal) {
        await apiRequest(`/api/departamental/proposals/${encodeURIComponent(editingProposal.id)}`, {
          method: 'PATCH',
          body: payload,
        });
        showToast('Propuesta actualizada', 'success');
      } else {
        await apiRequest('/api/departamental/proposals', {
          method: 'POST',
          body: payload,
        });
        showToast(
          propRequestPub
            ? 'Propuesta guardada y enviada a Presidencia para publicación'
            : 'Propuesta guardada en repositorio privado',
          'success'
        );
      }
      setProposalFormOpen(false);
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al guardar propuesta', 'error');
    } finally {
      setSavingProp(false);
    }
  };

  const handleSaveOversight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      ovTitle.trim().length < 4 ||
      ovEntity.trim().length < 3 ||
      ovPolicy.trim().length < 3 ||
      ovFindings.trim().length < 10
    ) {
      showToast('Completa título, entidad vigilada, política/plan y hallazgos (mín. 10 caracteres)', 'error');
      return;
    }
    setSavingOv(true);
    try {
      const payload = {
        title: ovTitle.trim(),
        watchedEntity: ovEntity.trim(),
        policyOrPlan: ovPolicy.trim(),
        commissionId: ovCommId,
        riskLevel: ovRisk,
        status: ovStatus,
        findings: ovFindings.trim(),
        recommendations: ovRecommendations.trim(),
        evidenceUrl: ovFileUrl,
        evidenceName: ovFileName,
        requestPublish: ovRequestPub,
      };
      if (editingOversight) {
        await apiRequest(`/api/departamental/oversight/${encodeURIComponent(editingOversight.id)}`, {
          method: 'PATCH',
          body: payload,
        });
        showToast('Registro de veeduría actualizado', 'success');
      } else {
        await apiRequest('/api/departamental/oversight', {
          method: 'POST',
          body: payload,
        });
        showToast(
          ovRequestPub
            ? 'Veeduría guardada y enviada a Presidencia para publicación'
            : 'Registro de veeduría guardado en privado',
          'success'
        );
      }
      setOversightFormOpen(false);
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al guardar veeduría', 'error');
    } finally {
      setSavingOv(false);
    }
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (repTitle.trim().length < 4 || repPeriod.trim().length < 2 || repSummary.trim().length < 10) {
      showToast('Completa título, período y resumen ejecutivo (mín. 10 caracteres)', 'error');
      return;
    }
    setSavingRep(true);
    try {
      const payload = {
        title: repTitle.trim(),
        reportPeriod: repPeriod.trim(),
        sessionDate: repDate,
        departamentalSpace: repSpace.trim(),
        commissionId: repCommId,
        summary: repSummary.trim(),
        agreements: repAgreements.trim(),
        participationStrategies: repStrategies.trim(),
        attachmentUrl: repFileUrl,
        attachmentName: repFileName,
        requestPublish: repRequestPub,
      };
      if (editingReport) {
        await apiRequest(`/api/departamental/reports/${encodeURIComponent(editingReport.id)}`, {
          method: 'PATCH',
          body: payload,
        });
        showToast('Informe actualizado', 'success');
      } else {
        await apiRequest('/api/departamental/reports', {
          method: 'POST',
          body: payload,
        });
        showToast(
          repRequestPub
            ? 'Informe guardado y enviado a Presidencia para publicación'
            : 'Informe de interlocución guardado en privado',
          'success'
        );
      }
      setReportFormOpen(false);
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al guardar informe', 'error');
    } finally {
      setSavingRep(false);
    }
  };

  const handleRequestPublish = async (kind: DeptKind, id: string) => {
    try {
      await apiRequest(`/api/departamental/${kind}/${encodeURIComponent(id)}/request-publish`, {
        method: 'POST',
      });
      showToast('Enviado a Presidencia para revisión y publicación', 'success');
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'No se pudo solicitar la publicación',
        'error'
      );
    }
  };

  const handlePublishDecision = async (
    kind: DeptKind,
    id: string,
    decision: 'aprobar' | 'rechazar',
    reasonText = ''
  ) => {
    if (decision === 'rechazar' && reasonText.trim().length < 5) {
      showToast('Indica el motivo de devolución (mínimo 5 caracteres)', 'error');
      return;
    }
    setDecidingPubId(id);
    try {
      await apiRequest(`/api/departamental/${kind}/${encodeURIComponent(id)}/publish-decision`, {
        method: 'POST',
        body: { decision, rejectionReason: reasonText.trim() },
      });
      showToast(
        decision === 'aprobar'
          ? 'Publicado en el Portal de Transparencia ciudadano'
          : 'Devuelto al autor con observaciones',
        decision === 'aprobar' ? 'success' : 'info'
      );
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'Error al procesar decisión',
        'error'
      );
    } finally {
      setDecidingPubId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(
        `/api/departamental/${deleteTarget.kind}/${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' }
      );
      showToast('Registro eliminado', 'info');
      setDeleteTarget(null);
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al eliminar', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportStyledWorkbook({
        fileName: 'CMJ_Flandes_Gestion_Departamental',
        reportTitle: 'Gestión e Interlocución Departamental · Tolima',
        moduleName: 'Gestión Departamental',
        generatedBy: actorName,
        sheets: [
          {
            name: 'Propuestas',
            title: 'Propuestas ante la Administración Municipal y Departamental',
            columns: [
              { key: 'titulo', header: 'Título', minWidth: 28 },
              { key: 'entidad', header: 'Entidad Destinataria', minWidth: 24 },
              { key: 'eje', header: 'Eje Temático', minWidth: 20 },
              { key: 'estado', header: 'Estado', minWidth: 16 },
              { key: 'visibilidad', header: 'Publicación', minWidth: 18 },
              { key: 'autor', header: 'Autor', minWidth: 20 },
            ],
            rows: deptProposals.map((p) => ({
              titulo: p.title,
              entidad: p.targetEntity,
              eje: p.thematicAxis,
              estado: PROPOSAL_STATUS_LABELS[p.status],
              visibilidad: PUB_STATUS_META[p.publicationStatus].label,
              autor: p.authorName,
            })),
          },
          {
            name: 'Veeduria',
            title: 'Veeduría y Control Social sobre Políticas de Juventud',
            columns: [
              { key: 'titulo', header: 'Título', minWidth: 28 },
              { key: 'entidad', header: 'Entidad Vigilada', minWidth: 24 },
              { key: 'politica', header: 'Política / Plan', minWidth: 24 },
              { key: 'riesgo', header: 'Nivel de Riesgo', minWidth: 14 },
              { key: 'estado', header: 'Estado', minWidth: 16 },
              { key: 'visibilidad', header: 'Publicación', minWidth: 18 },
            ],
            rows: deptOversight.map((o) => ({
              titulo: o.title,
              entidad: o.watchedEntity,
              politica: o.policyOrPlan,
              riesgo: RISK_LABELS[o.riskLevel].label,
              estado: OVERSIGHT_STATUS_LABELS[o.status],
              visibilidad: PUB_STATUS_META[o.publicationStatus].label,
            })),
          },
          {
            name: 'Informes',
            title: 'Informes de Interlocución Departamental',
            columns: [
              { key: 'titulo', header: 'Título', minWidth: 28 },
              { key: 'periodo', header: 'Período', minWidth: 16 },
              { key: 'fecha', header: 'Fecha', minWidth: 14, type: 'date' },
              { key: 'espacio', header: 'Espacio Departamental', minWidth: 26 },
              { key: 'visibilidad', header: 'Publicación', minWidth: 18 },
              { key: 'autor', header: 'Autor', minWidth: 20 },
            ],
            rows: deptReports.map((r) => ({
              titulo: r.title,
              periodo: r.reportPeriod,
              fecha: r.sessionDate || '—',
              espacio: r.departamentalSpace,
              visibilidad: PUB_STATUS_META[r.publicationStatus].label,
              autor: r.authorName,
            })),
          },
        ],
      });
      showToast('Reporte Excel de Gestión Departamental descargado', 'success');
    } catch {
      showToast('No fue posible exportar a Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="cmj-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="truncate">Gestión e Interlocución Departamental · Tolima</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Articulación con el Consejo Departamental de Juventud del Tolima (Ley 1622 de 2013 y Ley 1885 de 2018): propuestas, veeduría juvenil e informes de gestión.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportExcel}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>

            {tab === 'propuestas' && canCreateProposal && (
              <button
                type="button"
                onClick={openCreateProposal}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Nueva propuesta
              </button>
            )}
            {tab === 'veeduria' && canManageOversight && (
              <button
                type="button"
                onClick={openCreateOversight}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Nuevo registro de veeduría
              </button>
            )}
            {tab === 'informes' && canManageReports && (
              <button
                type="button"
                onClick={openCreateReport}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Nuevo informe
              </button>
            )}
          </div>
        </div>

        {/* Regla de visibilidad */}
        <div className="rounded-2xl border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/60 dark:bg-purple-950/20 px-4 py-3 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-purple-700 dark:text-purple-400" />
          <p className="leading-relaxed">
            <strong>Control de publicación ciudadana:</strong> Todo documento creado aquí permanece privado por defecto. Solo <strong>Presidencia</strong> puede autorizar su visibilidad en la sección pública de Transparencia.
          </p>
        </div>

        {/* Pestañas */}
        <div className="flex flex-wrap gap-2 pt-1">
          {(
            [
              { id: 'propuestas', label: `Propuestas (${deptProposals.length})` },
              { id: 'veeduria', label: `Veeduría y Control (${deptOversight.length})` },
              { id: 'informes', label: `Informes de Interlocución (${deptReports.length})` },
            ] as { id: DeptTab; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-emerald-700 text-white'
                  : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}

          {canApprovePublish && (
            <button
              type="button"
              onClick={() => setTab('aprobaciones')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'aprobaciones'
                  ? 'bg-amber-600 text-white'
                  : 'border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Aprobación Presidencia ({pendingApprovals.length})
            </button>
          )}
        </div>

        {tab !== 'aprobaciones' && (
          <DataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por título, entidad, eje o hallazgos..."
          />
        )}
      </div>

      {/* TAB 1: PROPUESTAS */}
      {tab === 'propuestas' && (
        <div className="space-y-4">
          {filteredProposals.length === 0 ? (
            <div className="cmj-card p-6">
              <EmptyState
                icon={FileText}
                title="No hay propuestas departamentales registradas"
                description="Registra planes, programas o iniciativas de juventud dirigidas a la administración municipal o departamental."
                actionLabel={canCreateProposal ? 'Crear primera propuesta' : undefined}
                onAction={canCreateProposal ? openCreateProposal : undefined}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredProposals.map((p) => {
                const pubMeta = PUB_STATUS_META[p.publicationStatus];
                const commName = commissions.find((c) => c.id === p.commissionId)?.name;
                const canModify = canCreateProposal && (p.authorUid === uid || isLeadership || canApprovePublish);
                return (
                  <article
                    key={p.id}
                    className="cmj-card p-5 flex flex-col gap-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                        {p.thematicAxis} · {PROPOSAL_STATUS_LABELS[p.status]}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold ${pubMeta.cls}`}>
                        {p.publicationStatus === 'publicado' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {pubMeta.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{p.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Destino: <strong className="text-slate-700 dark:text-slate-300">{p.targetEntity}</strong>
                        {commName ? ` · ${commName}` : ''}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {p.summary}
                    </p>

                    {p.justification && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-3 text-[11px] text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-100">Impacto / Estrategia juvenil:</strong>{' '}
                        {p.justification}
                      </div>
                    )}

                    {p.publicationStatus === 'rechazado' && p.rejectionReason && (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200">
                        <strong>Observación Presidencia:</strong> {p.rejectionReason}
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
                        <span className="truncate">Por {p.authorName}</span>
                        {p.attachmentUrl && (
                          <a
                            href={p.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                          >
                            <Download className="h-3 w-3" /> {p.attachmentName || 'Adjunto'}
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {canModify &&
                          (p.publicationStatus === 'privado' || p.publicationStatus === 'rechazado') && (
                            <button
                              type="button"
                              onClick={() => handleRequestPublish('proposals', p.id)}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                            >
                              <Send className="h-3 w-3" /> Solicitar publicación
                            </button>
                          )}
                        {canApprovePublish && p.publicationStatus === 'pendiente_presidencia' && (
                          <button
                            type="button"
                            onClick={() => handlePublishDecision('proposals', p.id, 'aprobar')}
                            className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Publicar
                          </button>
                        )}
                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditProposal(p)}
                              aria-label={`Editar ${p.title}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ kind: 'proposals', id: p.id, title: p.title })
                              }
                              aria-label={`Eliminar ${p.title}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VEEDURÍA */}
      {tab === 'veeduria' && (
        <div className="space-y-4">
          {filteredOversight.length === 0 ? (
            <div className="cmj-card p-6">
              <EmptyState
                icon={Eye}
                title="No hay registros de veeduría juvenil"
                description="Documenta el control social y seguimiento sobre políticas públicas, planes de desarrollo y programas para la juventud."
                actionLabel={canManageOversight ? 'Registrar veeduría' : undefined}
                onAction={canManageOversight ? openCreateOversight : undefined}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOversight.map((o) => {
                const pubMeta = PUB_STATUS_META[o.publicationStatus];
                const riskMeta = RISK_LABELS[o.riskLevel];
                const canModify =
                  canManageOversight && (o.authorUid === uid || isLeadership || canApprovePublish);
                return (
                  <article key={o.id} className="cmj-card p-5 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className={`inline-flex items-center gap-1 font-bold uppercase ${riskMeta.cls}`}>
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {riskMeta.label} · {OVERSIGHT_STATUS_LABELS[o.status]}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold ${pubMeta.cls}`}>
                        {pubMeta.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{o.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Entidad vigilada: <strong className="text-slate-700 dark:text-slate-300">{o.watchedEntity}</strong> · {o.policyOrPlan}
                      </p>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {o.findings}
                    </p>

                    {o.recommendations && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-3 text-[11px] text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-100">Recomendaciones:</strong>{' '}
                        {o.recommendations}
                      </div>
                    )}

                    {o.publicationStatus === 'rechazado' && o.rejectionReason && (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200">
                        <strong>Observación Presidencia:</strong> {o.rejectionReason}
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
                        <span className="truncate">Por {o.authorName}</span>
                        {o.evidenceUrl && (
                          <a
                            href={o.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                          >
                            <Download className="h-3 w-3" /> {o.evidenceName || 'Evidencia'}
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {canModify &&
                          (o.publicationStatus === 'privado' || o.publicationStatus === 'rechazado') && (
                            <button
                              type="button"
                              onClick={() => handleRequestPublish('oversight', o.id)}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                            >
                              <Send className="h-3 w-3" /> Solicitar publicación
                            </button>
                          )}
                        {canApprovePublish && o.publicationStatus === 'pendiente_presidencia' && (
                          <button
                            type="button"
                            onClick={() => handlePublishDecision('oversight', o.id, 'aprobar')}
                            className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Publicar
                          </button>
                        )}
                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditOversight(o)}
                              aria-label={`Editar ${o.title}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ kind: 'oversight', id: o.id, title: o.title })
                              }
                              aria-label={`Eliminar ${o.title}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INFORMES */}
      {tab === 'informes' && (
        <div className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="cmj-card p-6">
              <EmptyState
                icon={Building2}
                title="No hay informes de interlocución departamental"
                description="Documenta sesiones ante el Consejo Departamental de Juventud del Tolima, compromisos intermunicipales y estrategias de participación."
                actionLabel={canManageReports ? 'Crear informe departamental' : undefined}
                onAction={canManageReports ? openCreateReport : undefined}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredReports.map((r) => {
                const pubMeta = PUB_STATUS_META[r.publicationStatus];
                const canModify =
                  canManageReports && (r.authorUid === uid || isLeadership || canApprovePublish);
                return (
                  <article key={r.id} className="cmj-card p-5 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                        {r.reportPeriod} {r.sessionDate ? `· ${r.sessionDate}` : ''}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-semibold ${pubMeta.cls}`}>
                        {pubMeta.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{r.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{r.departamentalSpace}</p>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {r.summary}
                    </p>

                    {r.agreements && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-3 text-[11px] text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-100">Acuerdos alcanzados:</strong>{' '}
                        {r.agreements}
                      </div>
                    )}

                    {r.participationStrategies && (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 p-3 text-[11px] text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-100">Estrategias de participación:</strong>{' '}
                        {r.participationStrategies}
                      </div>
                    )}

                    {r.publicationStatus === 'rechazado' && r.rejectionReason && (
                      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-3 py-2 text-[11px] text-rose-800 dark:text-rose-200">
                        <strong>Observación Presidencia:</strong> {r.rejectionReason}
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
                        <span className="truncate">Por {r.authorName}</span>
                        {r.attachmentUrl && (
                          <a
                            href={r.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                          >
                            <Download className="h-3 w-3" /> {r.attachmentName || 'Informe'}
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {canModify &&
                          (r.publicationStatus === 'privado' || r.publicationStatus === 'rechazado') && (
                            <button
                              type="button"
                              onClick={() => handleRequestPublish('reports', r.id)}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                            >
                              <Send className="h-3 w-3" /> Solicitar publicación
                            </button>
                          )}
                        {canApprovePublish && r.publicationStatus === 'pendiente_presidencia' && (
                          <button
                            type="button"
                            onClick={() => handlePublishDecision('reports', r.id, 'aprobar')}
                            className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Publicar
                          </button>
                        )}
                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditReport(r)}
                              aria-label={`Editar ${r.title}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ kind: 'reports', id: r.id, title: r.title })
                              }
                              aria-label={`Eliminar ${r.title}`}
                              className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BANDEJA PRESIDENCIA */}
      {tab === 'aprobaciones' && canApprovePublish && (
        <div className="cmj-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Bandeja de Publicación Ciudadana (Exclusivo Presidencia)
              </h3>
              <p className="text-xs text-slate-500">
                Revisa las propuestas, veedurías e informes departamentales antes de habilitar su visibilidad en Transparencia.
              </p>
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Sin publicaciones departamentales pendientes"
              description="Cuando el Consejero Departamental solicite publicar un registro en el portal público, aparecerá aquí para tu autorización."
            />
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-slate-950 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-300">
                        {item.kindLabel} · Solicitado por {item.authorName}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500">{item.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={decidingPubId === item.id}
                        onClick={() => handlePublishDecision(item.kind, item.id, 'aprobar')}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar y publicar
                      </button>
                      <button
                        type="button"
                        disabled={decidingPubId === item.id}
                        onClick={() => {
                          setRejectTarget({ kind: item.kind, id: item.id, title: item.title });
                          setRejectReason('');
                        }}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Devolver
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {item.detail}
                  </p>
                  {item.fileUrl && (
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Ver adjunto ({item.fileName || 'Archivo'})
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Crear/Editar Propuesta */}
      <ResponsiveModal
        open={proposalFormOpen}
        onClose={() => setProposalFormOpen(false)}
        title={editingProposal ? 'Editar Propuesta Departamental' : 'Nueva Propuesta ante Administración'}
        subtitle="Mecanismo de interlocución y concertación juvenil (Ley 1622 / Ley 1885)"
        maxWidthClass="sm:max-w-xl"
      >
        <form onSubmit={handleSaveProposal} className="space-y-3.5">
          <input
            type="text"
            required
            value={propTitle}
            onChange={(e) => setPropTitle(e.target.value)}
            placeholder="Título de la propuesta *"
            className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={propEntity}
              onChange={(e) => setPropEntity(e.target.value)}
              placeholder="Entidad destinataria *"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="text"
              value={propAxis}
              onChange={(e) => setPropAxis(e.target.value)}
              placeholder="Eje temático"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <select
              value={propCommId}
              onChange={(e) => setPropCommId(e.target.value)}
              aria-label="Comisión vinculada"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">Transversal (sin comisión específica)</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={propStatus}
              onChange={(e) => setPropStatus(e.target.value as DeptProposal['status'])}
              aria-label="Estado de la propuesta"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              {Object.entries(PROPOSAL_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={3}
            required
            value={propSummary}
            onChange={(e) => setPropSummary(e.target.value)}
            placeholder="Descripción del plan o programa propuesto (mín. 10 caracteres) *"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <textarea
            rows={2}
            value={propJustification}
            onChange={(e) => setPropJustification(e.target.value)}
            placeholder="Estrategia de participación juvenil e impacto esperado..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <MediaUploader
            storageFolder="departamental/proposals"
            label="Adjuntar documento soporte (PDF / DOCX opcional)"
            onUploaded={(files: UploadedFileInfo[]) => {
              if (files[0]) {
                setPropFileUrl(files[0].url);
                setPropFileName(files[0].fileName);
              }
            }}
          />
          {!editingProposal && (
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={propRequestPub}
                onChange={(e) => setPropRequestPub(e.target.checked)}
              />
              <span>Solicitar autorización de Presidencia para publicar en Transparencia</span>
            </label>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setProposalFormOpen(false)}
              className="min-h-[42px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingProp}
              className="min-h-[42px] sm:min-h-[38px] rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
            >
              {savingProp ? 'Guardando...' : editingProposal ? 'Guardar cambios' : 'Registrar propuesta'}
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* Modal Crear/Editar Veeduría */}
      <ResponsiveModal
        open={oversightFormOpen}
        onClose={() => setOversightFormOpen(false)}
        title={editingOversight ? 'Editar Registro de Veeduría' : 'Nuevo Registro de Veeduría Juvenil'}
        subtitle="Control social sobre políticas públicas y planes de desarrollo juvenil"
        maxWidthClass="sm:max-w-xl"
      >
        <form onSubmit={handleSaveOversight} className="space-y-3.5">
          <input
            type="text"
            required
            value={ovTitle}
            onChange={(e) => setOvTitle(e.target.value)}
            placeholder="Título de la veeduría o seguimiento *"
            className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={ovEntity}
              onChange={(e) => setOvEntity(e.target.value)}
              placeholder="Entidad o secretaría vigilada *"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={ovPolicy}
              onChange={(e) => setOvPolicy(e.target.value)}
              placeholder="Plan de desarrollo o política pública *"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <select
              value={ovRisk}
              onChange={(e) => setOvRisk(e.target.value as DeptOversightRecord['riskLevel'])}
              aria-label="Nivel de riesgo"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="bajo">Riesgo bajo</option>
              <option value="medio">Riesgo medio</option>
              <option value="alto">Riesgo alto</option>
            </select>
            <select
              value={ovStatus}
              onChange={(e) => setOvStatus(e.target.value as DeptOversightRecord['status'])}
              aria-label="Estado de seguimiento"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              {Object.entries(OVERSIGHT_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <select
            value={ovCommId}
            onChange={(e) => setOvCommId(e.target.value)}
            aria-label="Comisión relacionada"
            className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="">Transversal (sin comisión específica)</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            required
            value={ovFindings}
            onChange={(e) => setOvFindings(e.target.value)}
            placeholder="Hallazgos, avance presupuestal o ejecución observada (mín. 10 caracteres) *"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <textarea
            rows={2}
            value={ovRecommendations}
            onChange={(e) => setOvRecommendations(e.target.value)}
            placeholder="Recomendaciones y acciones de mejora..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <MediaUploader
            storageFolder="departamental/oversight"
            label="Adjuntar evidencia o acta de visita (opcional)"
            onUploaded={(files: UploadedFileInfo[]) => {
              if (files[0]) {
                setOvFileUrl(files[0].url);
                setOvFileName(files[0].fileName);
              }
            }}
          />
          {!editingOversight && (
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={ovRequestPub}
                onChange={(e) => setOvRequestPub(e.target.checked)}
              />
              <span>Solicitar autorización de Presidencia para publicar en Transparencia</span>
            </label>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOversightFormOpen(false)}
              className="min-h-[42px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingOv}
              className="min-h-[42px] sm:min-h-[38px] rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
            >
              {savingOv ? 'Guardando...' : editingOversight ? 'Guardar cambios' : 'Guardar veeduría'}
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* Modal Crear/Editar Informe */}
      <ResponsiveModal
        open={reportFormOpen}
        onClose={() => setReportFormOpen(false)}
        title={editingReport ? 'Editar Informe Departamental' : 'Nuevo Informe de Interlocución'}
        subtitle="Representación del municipio ante el Consejo Departamental de Juventud del Tolima"
        maxWidthClass="sm:max-w-xl"
      >
        <form onSubmit={handleSaveReport} className="space-y-3.5">
          <input
            type="text"
            required
            value={repTitle}
            onChange={(e) => setRepTitle(e.target.value)}
            placeholder="Título del informe *"
            className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={repPeriod}
              onChange={(e) => setRepPeriod(e.target.value)}
              placeholder="Período (Ej: Trimestre II - 2026) *"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="date"
              value={repDate}
              onChange={(e) => setRepDate(e.target.value)}
              aria-label="Fecha de sesión"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={repSpace}
              onChange={(e) => setRepSpace(e.target.value)}
              placeholder="Espacio departamental"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <select
              value={repCommId}
              onChange={(e) => setRepCommId(e.target.value)}
              aria-label="Comisión vinculada"
              className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">Plenaria / Todas las comisiones</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={3}
            required
            value={repSummary}
            onChange={(e) => setRepSummary(e.target.value)}
            placeholder="Resumen ejecutivo de la gestión ante el Tolima (mín. 10 caracteres) *"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <textarea
            rows={2}
            value={repAgreements}
            onChange={(e) => setRepAgreements(e.target.value)}
            placeholder="Acuerdos y compromisos interinstitucionales..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <textarea
            rows={2}
            value={repStrategies}
            onChange={(e) => setRepStrategies(e.target.value)}
            placeholder="Estrategias para promover la participación juvenil..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <MediaUploader
            storageFolder="departamental/reports"
            label="Adjuntar documento del informe (opcional)"
            onUploaded={(files: UploadedFileInfo[]) => {
              if (files[0]) {
                setRepFileUrl(files[0].url);
                setRepFileName(files[0].fileName);
              }
            }}
          />
          {!editingReport && (
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={repRequestPub}
                onChange={(e) => setRepRequestPub(e.target.checked)}
              />
              <span>Solicitar autorización de Presidencia para publicar en Transparencia</span>
            </label>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setReportFormOpen(false)}
              className="min-h-[42px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingRep}
              className="min-h-[42px] sm:min-h-[38px] rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
            >
              {savingRep ? 'Guardando...' : editingReport ? 'Guardar cambios' : 'Guardar informe'}
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* Modal Devolución de Presidencia */}
      <ResponsiveModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Devolver solicitud de publicación"
        subtitle={rejectTarget?.title}
        maxWidthClass="sm:max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <p>
              El registro permanecerá privado en el portal interno y el autor recibirá una notificación con tus observaciones.
            </p>
          </div>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Describe el ajuste necesario antes de publicar (mín. 5 caracteres)..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="min-h-[42px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!rejectTarget || decidingPubId === rejectTarget.id}
              onClick={() =>
                rejectTarget &&
                handlePublishDecision(rejectTarget.kind, rejectTarget.id, 'rechazar', rejectReason)
              }
              className="min-h-[42px] sm:min-h-[38px] rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
            >
              Confirmar devolución
            </button>
          </div>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar registro departamental"
        description={`¿Confirmas eliminar "${deleteTarget?.title || ''}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
export default DepartamentalModule;
