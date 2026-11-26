import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileCheck,
  Paperclip,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { useUnsavedChangesGuard } from '../../lib/unsavedChanges';
import type {
  AccessTier,
  AttendanceStatus,
  Commission,
  CouncilSession,
  PublicCouncilor,
  RoleLabel,
  SessionAgendaProposal,
} from '../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { EmptyState } from '../ui/AnimatedPrimitives';
import { ConfirmDialog, DataToolbar, PaginationBar } from '../ui/DataTableUI';
import { recordAudit } from './auditHelper';
import { SessionAnalyticsSection } from './sessions/SessionAnalyticsSection';
import { SessionExcuseModal, SessionPrintableModal } from './sessions/SessionModals';
import { ATT_LABELS, DeterministicQrSvg, generateSessionCode } from './sessions/sessionShared';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

export function SessionsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier: _accessTier,
  sessions,
  publicCouncilors,
  commissions = [],
  sessionAgendaProposals = [],
  onOpenActas,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  sessions: CouncilSession[];
  publicCouncilors: PublicCouncilor[];
  commissions?: Commission[];
  sessionAgendaProposals?: SessionAgendaProposal[];
  onOpenActas?: (sessionId: string) => void;
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canCreateSession = can('sesiones.crear');
  const canEditSession = can('sesiones.editar');
  const canDeleteSession = can('sesiones.eliminar');
  const canManageAttendance = can('sesiones.asistencia_gestionar');
  const canProposeAgenda = can('sesiones.proponer_agenda');
  const activeCouncilors = useMemo(
    () =>
      publicCouncilors
        .filter((c) => c.active)
        .sort((a, b) => (a.displayOrder ?? 50) - (b.displayOrder ?? 50)),
    [publicCouncilors]
  );

  // Convocar nueva sesión
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState('Ordinaria');
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeRange, setTimeRange] = useState('09:00 a.m. – 11:00 a.m.');
  const [location, setLocation] = useState('Salón de Sesiones · Flandes');
  const [agenda, setAgenda] = useState(
    '1. Llamado a lista y verificación de quórum\n2. Lectura y aprobación del acta anterior\n3. Informes de comisiones\n4. Proposiciones y varios'
  );
  const [creating, setCreating] = useState(false);

  // Filtros y paginación de la lista
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'todas' | CouncilSession['status']>('todas');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || '');
  const selectedSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;

  const [selfCodeInput, setSelfCodeInput] = useState('');
  const [showPrintableActa, setShowPrintableActa] = useState(false);
  const [rotateMinutes, setRotateMinutes] = useState(30);
  const [rotatingQr, setRotatingQr] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Filtros analíticos
  const [statsCommissionFilter, setStatsCommissionFilter] = useState('todas');
  const [statsPeriodFilter, setStatsPeriodFilter] = useState<'all' | '30d' | '90d' | 'year'>('all');

  // Modal de excusa
  const [excuseModalTargetUid, setExcuseModalTargetUid] = useState<string | null>(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [excuseFileUrl, setExcuseFileUrl] = useState('');
  const [excuseFileName, setExcuseFileName] = useState('');
  const [submittingExcuse, setSubmittingExcuse] = useState(false);

  // Confirmación eliminar
  const [deleteTarget, setDeleteTarget] = useState<CouncilSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edición de sesión seleccionada
  const [editingSession, setEditingSession] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('Ordinaria');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editQuorum, setEditQuorum] = useState(1);
  const [editAgenda, setEditAgenda] = useState('');

  // Propuestas al Orden del Día (Consejero Departamental / consejeros con permiso)
  const [proposeAgendaOpen, setProposeAgendaOpen] = useState(false);
  const [agendaPropTitle, setAgendaPropTitle] = useState('');
  const [agendaPropJust, setAgendaPropJust] = useState('');
  const [submittingAgendaProp, setSubmittingAgendaProp] = useState(false);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);
  const [rejectProposalNote, setRejectProposalNote] = useState('');
  const [decidingProposalId, setDecidingProposalId] = useState<string | null>(null);

  useUnsavedChangesGuard(
    'sessions-editor',
    showCreateForm ||
      editingSession ||
      Boolean(proposeAgendaOpen && (agendaPropTitle.trim() || agendaPropJust.trim()))
  );

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const defaultQuorum = Math.max(1, Math.floor(activeCouncilors.length / 2) + 1);

  const filteredSessionsList = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    return sessions.filter((s) => {
      if (sessionStatusFilter !== 'todas' && s.status !== sessionStatusFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.sessionType.toLowerCase().includes(q) ||
        s.dateIso.includes(q)
      );
    });
  }, [sessions, sessionSearch, sessionStatusFilter]);

  const paginatedSessions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSessionsList.slice(start, start + pageSize);
  }, [filteredSessionsList, page, pageSize]);

  const qrRemainingText = useMemo(() => {
    if (!selectedSession?.checkInExpiresAt) return 'Sin vencimiento';
    const diff = Date.parse(selectedSession.checkInExpiresAt) - nowTick;
    if (Number.isNaN(diff)) return 'Vigente';
    if (diff <= 0) return 'Expirado';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [selectedSession?.checkInExpiresAt, nowTick]);

  const qrExpired = qrRemainingText === 'Expirado';

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Ingresa un título para la sesión', 'error');
      return;
    }
    setCreating(true);
    try {
      const code = generateSessionCode();
      const res = await apiRequest<{ id: string; ok: boolean }>('/api/sessions', {
        method: 'POST',
        body: {
          title: title.trim(),
          sessionType,
          dateIso,
          timeRange: timeRange.trim(),
          location: location.trim(),
          agenda: agenda.trim(),
          checkInCode: code,
          quorumRequired: defaultQuorum,
          checkInDurationMinutes: 120,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Convocó nueva sesión',
        module: 'Sesiones y Actas',
        targetTitle: title.trim(),
      });
      setActiveSessionId(res.id);
      setTitle('');
      setShowCreateForm(false);
      showToast('Sesión convocada', 'success', `Código QR inicial: ${code}`);
    } catch {
      showToast('No se pudo crear la sesión', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSetAttendance = async (
    session: CouncilSession,
    councilorUid: string,
    status: AttendanceStatus
  ) => {
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(session.id)}/attendance`, {
        method: 'POST',
        body: { targetUid: councilorUid, status },
      });
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo registrar la asistencia';
      showToast(msg, 'error');
    }
  };

  const handleBulkMark = async (
    session: CouncilSession,
    mode: 'all_present' | 'remaining_absent'
  ) => {
    setBulkSaving(true);
    try {
      const entries: Record<string, AttendanceStatus> = {};
      for (const c of activeCouncilors) {
        if (mode === 'all_present') {
          entries[c.uid] = 'presente';
        } else if (!session.attendance?.[c.uid]) {
          entries[c.uid] = 'ausente';
        }
      }
      await apiRequest(`/api/sessions/${encodeURIComponent(session.id)}/attendance-bulk`, {
        method: 'POST',
        body: { entries },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action:
          mode === 'all_present'
            ? 'Marcó asistencia masiva Presente'
            : 'Marcó restantes Ausentes',
        module: 'Sesiones y Asistencia',
        targetTitle: session.title,
      });
      showToast(
        mode === 'all_present'
          ? 'Todos los consejeros marcados como Presentes'
          : 'Restantes marcados como Ausentes',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'Error al guardar asistencia masiva',
        'error'
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const handleRotateQr = async (session: CouncilSession) => {
    setRotatingQr(true);
    try {
      const res = await apiRequest<{ checkInCode: string }>(
        `/api/sessions/${encodeURIComponent(session.id)}/rotate-code`,
        {
          method: 'POST',
          body: { durationMinutes: rotateMinutes },
        }
      );
      showToast(
        `Nuevo código QR: ${res.checkInCode}`,
        'success',
        `Válido por ${rotateMinutes} minutos.`
      );
    } catch {
      showToast('No se pudo rotar el código QR', 'error');
    } finally {
      setRotatingQr(false);
    }
  };

  const handleSubmitExcuse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !excuseModalTargetUid) return;
    if (excuseReason.trim().length < 4) {
      showToast('Describe brevemente el motivo de la excusa', 'error');
      return;
    }
    setSubmittingExcuse(true);
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(selectedSession.id)}/excuse`, {
        method: 'POST',
        body: {
          targetUid: excuseModalTargetUid,
          reason: excuseReason.trim(),
          attachmentUrl: excuseFileUrl,
          attachmentName: excuseFileName,
        },
      });
      setExcuseModalTargetUid(null);
      setExcuseReason('');
      setExcuseFileUrl('');
      setExcuseFileName('');
      showToast('Excusa registrada con soporte', 'success');
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'No se pudo registrar la excusa',
        'error'
      );
    } finally {
      setSubmittingExcuse(false);
    }
  };

  const handleSelfCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    if (!selectedSession.checkInCode) {
      showToast('Esta sesión no tiene código habilitado', 'info');
      return;
    }
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(selectedSession.id)}/checkin`, {
        method: 'POST',
        body: { code: selfCodeInput.trim() },
      });
      setSelfCodeInput('');
      showToast('Tu asistencia quedó registrada como Presente', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'El código de asistencia no coincide';
      showToast(msg, 'error');
    }
  };

  const handleChangeStatus = async (
    session: CouncilSession,
    nextStatus: CouncilSession['status']
  ) => {
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(session.id)}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      showToast(`Estado actualizado a ${nextStatus.replace('_', ' ')}`, 'success');
    } catch {
      showToast('No se pudo cambiar el estado', 'error');
    }
  };

  const openEditSession = (sess: CouncilSession) => {
    setEditTitle(sess.title);
    setEditType(sess.sessionType);
    setEditDate(sess.dateIso);
    setEditTime(sess.timeRange || '');
    setEditLocation(sess.location);
    setEditQuorum(sess.quorumRequired || defaultQuorum);
    setEditAgenda(sess.agenda || '');
    setEditingSession(true);
  };

  const handleSaveSessionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !editTitle.trim()) return;
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(selectedSession.id)}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          sessionType: editType,
          dateIso: editDate,
          timeRange: editTime.trim(),
          location: editLocation.trim(),
          quorumRequired: Math.max(1, Number(editQuorum) || 1),
          agenda: editAgenda.trim(),
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Editó datos o agenda de sesión',
        module: 'Sesiones y Actas',
        targetTitle: editTitle.trim(),
      });
      setEditingSession(false);
      showToast('Sesión actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la sesión', 'error');
    }
  };

  const handleActaUploaded = async (files: UploadedFileInfo[]) => {
    const first = files[0];
    if (!first || !selectedSession) return;
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(selectedSession.id)}`, {
        method: 'PATCH',
        body: { actaUrl: first.url },
      });
      showToast('Acta adjuntada a la sesión', 'success');
    } catch {
      showToast('No se pudo adjuntar el acta', 'error');
    }
  };

  const handleConfirmDeleteSession = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      if (activeSessionId === deleteTarget.id) setActiveSessionId('');
      showToast('Sesión eliminada', 'info');
      setDeleteTarget(null);
    } catch {
      showToast('No se pudo eliminar la sesión', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleProposeAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    if (agendaPropTitle.trim().length < 4 || agendaPropJust.trim().length < 10) {
      showToast(
        'Completa título (mín. 4 caracteres) y justificación (mín. 10 caracteres)',
        'error'
      );
      return;
    }
    setSubmittingAgendaProp(true);
    try {
      await apiRequest(
        `/api/sessions/${encodeURIComponent(selectedSession.id)}/agenda-proposals`,
        {
          method: 'POST',
          body: {
            title: agendaPropTitle.trim(),
            justification: agendaPropJust.trim(),
          },
        }
      );
      setAgendaPropTitle('');
      setAgendaPropJust('');
      setProposeAgendaOpen(false);
      showToast('Propuesta enviada al Orden del Día de Mesa Directiva', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudo enviar la propuesta al Orden del Día';
      showToast(msg, 'error');
    } finally {
      setSubmittingAgendaProp(false);
    }
  };

  const handleDecideAgendaProposal = async (
    proposal: SessionAgendaProposal,
    status: 'aprobada' | 'rechazada',
    notes?: string
  ) => {
    if (!selectedSession) return;
    setDecidingProposalId(proposal.id);
    try {
      await apiRequest(
        `/api/sessions/${encodeURIComponent(selectedSession.id)}/agenda-proposals/${encodeURIComponent(proposal.id)}`,
        {
          method: 'PATCH',
          body: {
            status,
            ...(notes?.trim() ? { decisionNotes: notes.trim() } : {}),
          },
        }
      );
      setRejectProposalId(null);
      setRejectProposalNote('');
      showToast(
        status === 'aprobada'
          ? 'Punto incorporado al Orden del Día de la sesión'
          : 'Propuesta marcada como no incluida',
        status === 'aprobada' ? 'success' : 'info'
      );
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo decidir la propuesta';
      showToast(msg, 'error');
    } finally {
      setDecidingProposalId(null);
    }
  };

  const selectedAgendaProposals = useMemo(
    () =>
      selectedSession
        ? sessionAgendaProposals.filter((p) => p.sessionId === selectedSession.id)
        : [],
    [sessionAgendaProposals, selectedSession]
  );

  // Estadísticas y filtros analíticos
  const filteredSessionsForStats = useMemo(() => {
    const sorted = sessions.slice().sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    if (statsPeriodFilter === 'all') return sorted;
    const now = new Date();
    const cutoff = new Date();
    if (statsPeriodFilter === '30d') cutoff.setDate(now.getDate() - 30);
    else if (statsPeriodFilter === '90d') cutoff.setDate(now.getDate() - 90);
    else if (statsPeriodFilter === 'year') cutoff.setMonth(0, 1);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return sorted.filter((s) => s.dateIso >= cutoffIso);
  }, [sessions, statsPeriodFilter]);

  const filteredCouncilorsForStats = useMemo(() => {
    if (statsCommissionFilter === 'todas') return activeCouncilors;
    return activeCouncilors.filter((c) => c.commissionId === statsCommissionFilter);
  }, [activeCouncilors, statsCommissionFilter]);

  const councilorStats = useMemo(() => {
    return filteredCouncilorsForStats
      .map((c) => {
        const recorded = filteredSessionsForStats.filter(
          (s) => s.attendance && c.uid in s.attendance
        );
        const attended = recorded.filter(
          (s) => s.attendance?.[c.uid] === 'presente' || s.attendance?.[c.uid] === 'tarde'
        ).length;
        const excuses = recorded.filter((s) => s.attendance?.[c.uid] === 'excusa').length;
        const absences = recorded.filter((s) => s.attendance?.[c.uid] === 'ausente').length;
        const pct = recorded.length ? Math.round((attended / recorded.length) * 100) : 0;

        const chrono = recorded.slice().sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        let consecutiveAbsences = 0;
        for (const s of chrono) {
          if (s.attendance?.[c.uid] === 'ausente') consecutiveAbsences++;
          else break;
        }
        return {
          councilor: c,
          recordedCount: recorded.length,
          attended,
          excuses,
          absences,
          pct,
          consecutiveAbsences,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [filteredCouncilorsForStats, filteredSessionsForStats]);

  const absenceAlerts = useMemo(
    () =>
      councilorStats.filter(
        (s) => s.consecutiveAbsences >= 2 || (s.recordedCount >= 3 && s.pct < 70)
      ),
    [councilorStats]
  );

  const sessionTrend = useMemo(() => {
    return filteredSessionsForStats.slice(-10).map((s) => {
      const total = Math.max(1, activeCouncilors.length);
      const present = Object.values(s.attendance || {}).filter(
        (v) => v === 'presente' || v === 'tarde'
      ).length;
      return {
        id: s.id,
        label: s.dateIso.slice(5),
        title: s.title,
        present,
        pct: Math.round((present / total) * 100),
      };
    });
  }, [filteredSessionsForStats, activeCouncilors.length]);

  const currentPresentCount = selectedSession
    ? Object.values(selectedSession.attendance || {}).filter(
        (v) => v === 'presente' || v === 'tarde'
      ).length
    : 0;
  const requiredQuorum = selectedSession?.quorumRequired || defaultQuorum;
  const hasQuorum = currentPresentCount >= requiredQuorum;
  const quorumPct = Math.min(
    100,
    Math.round((currentPresentCount / Math.max(1, requiredQuorum)) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Encabezado y convocatoria colapsable */}
      <div className="cmj-card p-6 space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              Sesiones y Control de Asistencia
            </h2>
            <p className="text-xs text-slate-500">
              Convoca sesiones, gestiona quórum con QR rotatorio, recibe excusas y exporta reportes Excel.
            </p>
          </div>
          {canCreateSession ? (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              {showCreateForm ? 'Cerrar formulario' : 'Convocar nueva sesión'}
            </button>
          ) : (
            <PermissionDeniedBanner
              permission="sesiones.crear"
              compact
              customText="No tienes permiso para convocar sesiones."
            />
          )}
        </div>

        {canCreateSession && showCreateForm && (
          <form
            onSubmit={handleCreateSession}
            className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-slate-950 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Sesión Ordinaria No. 01"
                className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              <select
                aria-label="Tipo de sesión"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm"
              >
                <option value="Ordinaria">Ordinaria</option>
                <option value="Extraordinaria">Extraordinaria</option>
                <option value="Mesa Directiva">Mesa Directiva</option>
                <option value="Comisión">Comisión</option>
              </select>
              <input
                type="date"
                required
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm"
              />
              <input
                type="text"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                placeholder="Horario"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Lugar o enlace virtual"
                className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={creating}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                {creating ? 'Convocando...' : 'Guardar y convocar'}
              </button>
            </div>
            <textarea
              rows={2}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Orden del día"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs"
            />
          </form>
        )}
      </div>

      {/* Alertas reglamentarias */}
      {absenceAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-4 flex items-start gap-3 no-print">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Alerta de Seguimiento Reglamentario ({absenceAlerts.length}{' '}
              {absenceAlerts.length === 1 ? 'consejero' : 'consejeros'})
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
              {absenceAlerts
                .map(
                  (a) =>
                    `${a.councilor.fullName} (${
                      a.consecutiveAbsences >= 2
                        ? `${a.consecutiveAbsences} ausencias seguidas`
                        : `${a.pct}% asistencia`
                    })`
                )
                .join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Lista con buscador + Detalle de Sesión */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        <div className="lg:col-span-4 space-y-3">
          <DataToolbar
            search={sessionSearch}
            onSearchChange={(v) => {
              setSessionSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Buscar sesión o lugar..."
          >
            <select
              aria-label="Filtrar estado de sesión"
              value={sessionStatusFilter}
              onChange={(e) => {
                setSessionStatusFilter(e.target.value as typeof sessionStatusFilter);
                setPage(1);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="todas">Todas</option>
              <option value="programada">Programadas</option>
              <option value="en_curso">En curso</option>
              <option value="finalizada">Finalizadas</option>
            </select>
          </DataToolbar>

          {paginatedSessions.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Sin sesiones coincidentes"
              description="Ajusta el buscador o convoca una nueva sesión plenaria."
            />
          ) : (
            <div className="space-y-2">
              {paginatedSessions.map((s) => {
                const pCount = Object.values(s.attendance || {}).filter(
                  (v) => v === 'presente' || v === 'tarde'
                ).length;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSessionId(s.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                      selectedSession?.id === s.id
                        ? 'border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {s.sessionType} · {s.status.replace('_', ' ')}
                      </span>
                      <span className="font-mono-num text-slate-500">{s.dateIso}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {s.title}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate">{s.location}</span>
                      <span className="font-mono-num font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                        {pCount} pres.
                      </span>
                    </div>
                  </button>
                );
              })}
              <PaginationBar
                totalItems={filteredSessionsList.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[6, 12, 24]}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          {!selectedSession ? (
            <div className="cmj-card p-10 text-center text-sm text-slate-500">
              Selecciona o convoca una sesión para gestionar asistencia y quórum.
            </div>
          ) : (
            <div className="cmj-card p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                    {selectedSession.sessionType} · {selectedSession.dateIso}
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    {selectedSession.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedSession.timeRange} · {selectedSession.location}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canEditSession && (
                    <>
                      <select
                        aria-label="Cambiar estado de sesión"
                        value={selectedSession.status}
                        onChange={(e) =>
                          handleChangeStatus(
                            selectedSession,
                            e.target.value as CouncilSession['status']
                          )
                        }
                        className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold"
                      >
                        <option value="programada">Programada</option>
                        <option value="en_curso">En curso</option>
                        <option value="finalizada">Finalizada</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          editingSession ? setEditingSession(false) : openEditSession(selectedSession)
                        }
                        className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Editar
                      </button>
                    </>
                  )}
                  {onOpenActas && (
                    <button
                      type="button"
                      onClick={() => onOpenActas(selectedSession.id)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      Redactar Acta
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPrintableActa(true)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Lista PDF
                  </button>
                  {canDeleteSession && (
                    <button
                      type="button"
                      aria-label="Eliminar sesión"
                      onClick={() => setDeleteTarget(selectedSession)}
                      className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {editingSession && canEditSession && (
                <form
                  onSubmit={handleSaveSessionEdit}
                  className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-slate-950 p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título de la sesión"
                      className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    >
                      <option value="Ordinaria">Ordinaria</option>
                      <option value="Extraordinaria">Extraordinaria</option>
                      <option value="Mesa Directiva">Mesa Directiva</option>
                      <option value="Comisión">Comisión</option>
                    </select>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      placeholder="Horario"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      value={editQuorum}
                      onChange={(e) => setEditQuorum(Number(e.target.value))}
                      placeholder="Quórum"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      required
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Lugar o enlace"
                      className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={editAgenda}
                    onChange={(e) => setEditAgenda(e.target.value)}
                    placeholder="Orden del día"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                  <MediaUploader
                    storageFolder={`actas/${selectedSession.id}`}
                    label="Adjuntar archivo de Acta firmada (PDF / DOCX)"
                    onUploaded={handleActaUploaded}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                    >
                      <Save className="h-3.5 w-3.5" /> Guardar cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSession(false)}
                      className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {selectedSession.actaUrl && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2 text-xs">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Acta oficial adjunta disponible
                  </span>
                  <a
                    href={selectedSession.actaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Abrir acta <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              {/* Quórum y Código QR Rotatorio */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                <div className="md:col-span-7 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck
                          className={`h-4 w-4 ${hasQuorum ? 'text-emerald-600' : 'text-amber-500'}`}
                        />
                        <span
                          className={
                            hasQuorum
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }
                        >
                          {hasQuorum ? 'Quórum deliberatorio alcanzado' : 'Quórum pendiente'} (
                          {currentPresentCount}/{requiredQuorum})
                        </span>
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-500">{quorumPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          hasQuorum ? 'bg-emerald-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${quorumPct}%` }}
                      />
                    </div>
                  </div>

                  {selectedSession.agenda && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedSession.agenda}
                    </p>
                  )}

                  {selectedSession.status !== 'finalizada' && (
                    <div className="pt-1 flex flex-wrap gap-2">
                      {selectedSession.checkInCode && (
                        <form onSubmit={handleSelfCheckIn} className="flex flex-wrap gap-2 flex-1">
                          <input
                            type="text"
                            value={selfCodeInput}
                            onChange={(e) => setSelfCodeInput(e.target.value)}
                            placeholder={`Código (${selectedSession.checkInCode})`}
                            className="w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs uppercase font-mono-num"
                          />
                          <button
                            type="submit"
                            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Registrar asistencia
                          </button>
                        </form>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setExcuseModalTargetUid(uid);
                          setExcuseReason(selectedSession.excuses?.[uid]?.reason || '');
                          setExcuseFileUrl(selectedSession.excuses?.[uid]?.attachmentUrl || '');
                          setExcuseFileName(selectedSession.excuses?.[uid]?.attachmentName || '');
                        }}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Enviar excusa
                      </button>
                    </div>
                  )}
                </div>

                {selectedSession.checkInCode && (
                  <div className="md:col-span-5 flex flex-col justify-between gap-3 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-3 md:pt-0 md:pl-4">
                    <div className="flex items-center gap-3">
                      <DeterministicQrSvg code={selectedSession.checkInCode} />
                      <div className="text-xs min-w-0">
                        <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          <QrCode className="h-3.5 w-3.5 text-emerald-700" /> Código QR
                        </p>
                        <p className="mt-0.5 font-mono-num text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                          {selectedSession.checkInCode}
                        </p>
                        <p
                          className={`mt-1 inline-flex items-center gap-1 font-mono-num text-[11px] font-semibold ${
                            qrExpired ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          <Clock className="h-3 w-3" />
                          {qrExpired ? 'Expirado' : `Expira: ${qrRemainingText}`}
                        </p>
                      </div>
                    </div>

                    {canManageAttendance && selectedSession.status !== 'finalizada' && (
                      <div className="flex items-center gap-1.5">
                        <select
                          aria-label="Duración del código QR"
                          value={rotateMinutes}
                          onChange={(e) => setRotateMinutes(Number(e.target.value))}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px]"
                        >
                          <option value={15}>15 min</option>
                          <option value={30}>30 min</option>
                          <option value={60}>1 hora</option>
                          <option value={120}>2 horas</option>
                        </select>
                        <button
                          type="button"
                          disabled={rotatingQr}
                          onClick={() => handleRotateQr(selectedSession)}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                        >
                          <RefreshCw className={`h-3 w-3 ${rotatingQr ? 'animate-spin' : ''}`} />
                          Rotar código QR
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Propuestas al Orden del Día */}
              {(selectedAgendaProposals.length > 0 ||
                (canProposeAgenda && selectedSession.status !== 'finalizada')) && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Propuestas al Orden del Día ({selectedAgendaProposals.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Puntos sugeridos para incorporar en la agenda de esta sesión. La Mesa Directiva aprueba su inclusión.
                      </p>
                    </div>
                    {canProposeAgenda && selectedSession.status !== 'finalizada' && (
                      <button
                        type="button"
                        onClick={() => setProposeAgendaOpen((v) => !v)}
                        className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {proposeAgendaOpen ? 'Cerrar propuesta' : 'Proponer punto al Orden del Día'}
                      </button>
                    )}
                  </div>

                  {proposeAgendaOpen && canProposeAgenda && (
                    <form
                      onSubmit={handleProposeAgenda}
                      className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 p-3.5 space-y-2.5"
                    >
                      <input
                        type="text"
                        required
                        minLength={4}
                        value={agendaPropTitle}
                        onChange={(e) => setAgendaPropTitle(e.target.value)}
                        placeholder="Título del punto a incluir en el Orden del Día..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                      />
                      <textarea
                        rows={2}
                        required
                        minLength={10}
                        value={agendaPropJust}
                        onChange={(e) => setAgendaPropJust(e.target.value)}
                        placeholder="Justificación e impacto juvenil (ej: concertación departamental, informe de veeduría)..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setProposeAgendaOpen(false)}
                          className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={submittingAgendaProp}
                          className="min-h-[36px] rounded-xl bg-purple-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-60 cursor-pointer"
                        >
                          {submittingAgendaProp ? 'Enviando...' : 'Enviar propuesta'}
                        </button>
                      </div>
                    </form>
                  )}

                  {selectedAgendaProposals.length > 0 && (
                    <div className="space-y-2">
                      {selectedAgendaProposals.map((p) => {
                        const statusCls =
                          p.status === 'aprobada'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : p.status === 'rechazada'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300';
                        const isDeciding = decidingProposalId === p.id;
                        return (
                          <div
                            key={p.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 p-3 space-y-2"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white">
                                  {p.title}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Propone: <strong className="text-slate-700 dark:text-slate-300">{p.proposerName}</strong> · {p.proposerRoleLabel}
                                </p>
                              </div>
                              <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${statusCls}`}>
                                {p.status}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {p.justification}
                            </p>

                            {p.decisionNotes && (
                              <p className="text-[11px] text-slate-500 italic">
                                Nota Mesa Directiva: {p.decisionNotes}
                                {p.decidedByName ? ` (${p.decidedByName})` : ''}
                              </p>
                            )}

                            {canEditSession && p.status === 'pendiente' && (
                              <div className="pt-1 space-y-2">
                                {rejectProposalId === p.id ? (
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                      type="text"
                                      value={rejectProposalNote}
                                      onChange={(e) => setRejectProposalNote(e.target.value)}
                                      placeholder="Motivo breve (opcional)"
                                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                                    />
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        disabled={isDeciding}
                                        onClick={() =>
                                          handleDecideAgendaProposal(
                                            p,
                                            'rechazada',
                                            rejectProposalNote
                                          )
                                        }
                                        className="min-h-[36px] rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                                      >
                                        Confirmar no incluir
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRejectProposalId(null);
                                          setRejectProposalNote('');
                                        }}
                                        className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={isDeciding}
                                      onClick={() => handleDecideAgendaProposal(p, 'aprobada')}
                                      className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Incluir en agenda
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isDeciding}
                                      onClick={() => {
                                        setRejectProposalId(p.id);
                                        setRejectProposalNote('');
                                      }}
                                      className="min-h-[36px] rounded-xl border border-rose-200 dark:border-rose-900 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-60 cursor-pointer"
                                    >
                                      No incluir
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Llamado a Lista */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Llamado a Lista ({activeCouncilors.length} consejeros activos)
                  </h4>
                  {canManageAttendance &&
                    selectedSession.status !== 'finalizada' &&
                    activeCouncilors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={bulkSaving}
                          onClick={() => handleBulkMark(selectedSession, 'all_present')}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> Todos presentes
                        </button>
                        <button
                          type="button"
                          disabled={bulkSaving}
                          onClick={() => handleBulkMark(selectedSession, 'remaining_absent')}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          Restantes ausentes
                        </button>
                      </div>
                    )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeCouncilors.map((c) => {
                    const current = selectedSession.attendance?.[c.uid];
                    const excuse = selectedSession.excuses?.[c.uid];
                    const commColor = commissions.find((cm) => cm.id === c.commissionId)?.accentColor;
                    return (
                      <div key={c.uid} className="py-3 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <AvatarBadge
                              name={c.fullName}
                              photoUrl={c.photoUrl}
                              thumbUrl={c.photoThumbUrl}
                              mediumUrl={c.photoMediumUrl}
                              accentColor={commColor}
                              statusIndicator={
                                current === 'presente' || current === 'tarde'
                                  ? 'in_session'
                                  : 'active'
                              }
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {c.fullName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {c.roleLabel}
                                {c.commissionName ? ` · ${c.commissionName}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {(['presente', 'tarde', 'excusa', 'ausente'] as AttendanceStatus[]).map(
                              (st) => {
                                const active = current === st;
                                const disabled =
                                  !canManageAttendance || selectedSession.status === 'finalizada';
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleSetAttendance(selectedSession, c.uid, st)}
                                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-45 whitespace-nowrap ${
                                      active
                                        ? ATT_LABELS[st].cls
                                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {ATT_LABELS[st].label}
                                  </button>
                                );
                              }
                            )}
                            {canManageAttendance && selectedSession.status !== 'finalizada' && (
                              <button
                                type="button"
                                title="Registrar excusa con soporte"
                                aria-label={`Registrar excusa para ${c.fullName}`}
                                onClick={() => {
                                  setExcuseModalTargetUid(c.uid);
                                  setExcuseReason(excuse?.reason || '');
                                  setExcuseFileUrl(excuse?.attachmentUrl || '');
                                  setExcuseFileName(excuse?.attachmentName || '');
                                }}
                                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 text-slate-500 hover:text-emerald-700 cursor-pointer"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {excuse && (
                          <div className="ml-0 sm:ml-12 rounded-xl border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-200">
                              <strong className="text-blue-700 dark:text-cyan-300">Excusa:</strong>{' '}
                              {excuse.reason}
                            </span>
                            {excuse.attachmentUrl && (
                              <a
                                href={excuse.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-cyan-400 hover:underline"
                              >
                                <Download className="h-3 w-3" />{' '}
                                {excuse.attachmentName || 'Ver soporte'}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analítica y Exportación ExcelJS */}
      <SessionAnalyticsSection
        actorName={actorName}
        commissions={commissions}
        statsPeriodFilter={statsPeriodFilter}
        statsCommissionFilter={statsCommissionFilter}
        onPeriodChange={setStatsPeriodFilter}
        onCommissionChange={setStatsCommissionFilter}
        councilorStats={councilorStats}
        sessionTrend={sessionTrend}
        filteredSessionsForStats={filteredSessionsForStats}
        filteredCouncilorsForStats={filteredCouncilorsForStats}
        activeCouncilors={activeCouncilors}
      />

      {/* Modales */}
      <SessionExcuseModal
        open={Boolean(excuseModalTargetUid && selectedSession)}
        councilorName={
          activeCouncilors.find((c) => c.uid === excuseModalTargetUid)?.fullName || actorName
        }
        session={selectedSession}
        reason={excuseReason}
        fileUrl={excuseFileUrl}
        fileName={excuseFileName}
        submitting={submittingExcuse}
        onReasonChange={setExcuseReason}
        onFileUploaded={(url, name) => {
          setExcuseFileUrl(url);
          setExcuseFileName(name);
        }}
        onSubmit={handleSubmitExcuse}
        onClose={() => setExcuseModalTargetUid(null)}
      />

      <SessionPrintableModal
        open={showPrintableActa}
        session={selectedSession}
        activeCouncilors={activeCouncilors}
        presentCount={currentPresentCount}
        requiredQuorum={requiredQuorum}
        onClose={() => setShowPrintableActa(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar sesión"
        description={`¿Confirmas eliminar "${deleteTarget?.title || ''}"? Esta acción borrará el registro de asistencia asociado.`}
        confirmLabel="Sí, eliminar sesión"
        loading={deleting}
        onConfirm={handleConfirmDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
export default SessionsModule;
