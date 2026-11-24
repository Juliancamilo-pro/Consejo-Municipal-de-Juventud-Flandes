import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  Paperclip,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type {
  AccessTier,
  AttendanceStatus,
  Commission,
  CouncilSession,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

function generateSessionCode(): string {
  return `CMJ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function DeterministicQrSvg({ code }: { code: string }) {
  const cells = useMemo(() => {
    const size = 11;
    const grid: boolean[] = [];
    let seed = 0;
    for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i) * (i + 7);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const corner =
          (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
        const val = corner || ((seed + r * 17 + c * 31 + r * c) % 3 !== 0);
        grid.push(val);
      }
    }
    return grid;
  }, [code]);

  return (
    <svg
      viewBox="0 0 110 110"
      className="h-24 w-24 rounded-xl bg-white p-2 border border-slate-200 shrink-0"
      aria-label={`Código QR visual ${code}`}
    >
      {cells.map((filled, idx) => {
        if (!filled) return null;
        const r = Math.floor(idx / 11);
        const c = idx % 11;
        return <rect key={idx} x={c * 10 + 1} y={r * 10 + 1} width="8" height="8" rx="1.5" fill="#0f172a" />;
      })}
    </svg>
  );
}

const ATT_LABELS: Record<AttendanceStatus, { label: string; short: string; cls: string; cellCls: string }> = {
  presente: {
    label: 'Presente',
    short: 'P',
    cls: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    cellCls: 'bg-emerald-500 text-white',
  },
  tarde: {
    label: 'Tarde',
    short: 'T',
    cls: 'bg-amber-500 text-white border-amber-500 shadow-sm',
    cellCls: 'bg-amber-400 text-slate-950',
  },
  excusa: {
    label: 'Excusa',
    short: 'E',
    cls: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    cellCls: 'bg-blue-500 text-white',
  },
  ausente: {
    label: 'Ausente',
    short: 'A',
    cls: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    cellCls: 'bg-rose-500 text-white',
  },
};

export function SessionsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  sessions,
  publicCouncilors,
  commissions = [],
  onOpenActas,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  sessions: CouncilSession[];
  publicCouncilors: PublicCouncilor[];
  commissions?: Commission[];
  onOpenActas?: (sessionId: string) => void;
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const activeCouncilors = useMemo(
    () =>
      publicCouncilors
        .filter((c) => c.active)
        .sort((a, b) => (a.displayOrder ?? 50) - (b.displayOrder ?? 50)),
    [publicCouncilors]
  );

  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState('Ordinaria');
  const [dateIso, setDateIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeRange, setTimeRange] = useState('09:00 a.m. – 11:00 a.m.');
  const [location, setLocation] = useState('Salón de Sesiones · Flandes');
  const [agenda, setAgenda] = useState(
    '1. Llamado a lista y verificación de quórum\n2. Lectura y aprobación del acta anterior\n3. Informes de comisiones\n4. Proposiciones y varios'
  );
  const [creating, setCreating] = useState(false);

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

  // Edición de sesión seleccionada
  const [editingSession, setEditingSession] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('Ordinaria');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editQuorum, setEditQuorum] = useState(1);
  const [editAgenda, setEditAgenda] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const defaultQuorum = Math.max(1, Math.floor(activeCouncilors.length / 2) + 1);

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
    if (!title.trim()) return;
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
        body: {
          targetUid: councilorUid,
          status,
        },
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
        action: mode === 'all_present' ? 'Marcó asistencia masiva Presente' : 'Marcó restantes Ausentes',
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
      const res = await apiRequest<{ checkInCode: string }>(`/api/sessions/${encodeURIComponent(session.id)}/rotate-code`, {
        method: 'POST',
        body: { durationMinutes: rotateMinutes },
      });
      showToast(`Nuevo código QR: ${res.checkInCode}`, 'success', `Válido por ${rotateMinutes} minutos.`);
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

  const handleDeleteSession = async (session: CouncilSession) => {
    try {
      await apiRequest(`/api/sessions/${encodeURIComponent(session.id)}`, {
        method: 'DELETE',
      });
      showToast('Sesión eliminada', 'info');
    } catch {
      showToast('No se pudo eliminar la sesión', 'error');
    }
  };

  // Sesiones filtradas por periodo
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

        // Calcular inasistencias consecutivas (más recientes primero)
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

  const handleExportAttendanceExcel = () => {
    const summaryRows = councilorStats.map((st, i) => ({
      '#': i + 1,
      Consejero: st.councilor.fullName,
      Cargo: st.councilor.roleLabel,
      Comisión: st.councilor.commissionName || 'Sin comisión',
      Asistencias: st.attended,
      Excusas: st.excuses,
      Ausencias: st.absences,
      'Sesiones Registradas': st.recordedCount,
      'Cumplimiento (%)': st.pct,
      'Inasistencias Consecutivas': st.consecutiveAbsences,
    }));

    const matrixRows = activeCouncilors.map((c) => {
      const row: Record<string, string> = {
        Consejero: c.fullName,
        Cargo: c.roleLabel,
      };
      for (const s of filteredSessionsForStats) {
        row[`${s.dateIso} · ${s.title.slice(0, 18)}`] =
          s.attendance?.[c.uid]?.toUpperCase() || 'SIN REGISTRO';
      }
      return row;
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Consolidado');
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'Matriz Asistencia');
    XLSX.writeFile(wb, `CMJ_Flandes_Asistencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Reporte Excel descargado', 'success');
  };

  const currentPresentCount = selectedSession
    ? Object.values(selectedSession.attendance || {}).filter(
        (v) => v === 'presente' || v === 'tarde'
      ).length
    : 0;
  const requiredQuorum = selectedSession?.quorumRequired || defaultQuorum;
  const hasQuorum = currentPresentCount >= requiredQuorum;
  const quorumPct = Math.min(100, Math.round((currentPresentCount / Math.max(1, requiredQuorum)) * 100));

  return (
    <div className="space-y-6">
      {isLeader && (
        <form
          onSubmit={handleCreateSession}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 no-print"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Convocar Sesión y Control de Asistencia
              </h2>
              <p className="text-xs text-slate-500">
                Crea sesiones, registra asistencia rápida con fotos y código QR rotatorio, recibe excusas y exporta reportes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Sesión Ordinaria No. 01"
              className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
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
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
            />
            <input
              type="text"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              placeholder="Horario"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Lugar o enlace virtual"
              className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Convocando...' : 'Convocar sesión'}
            </button>
          </div>

          <textarea
            rows={2}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="Orden del día"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
        </form>
      )}

      {/* Alertas automáticas por inasistencia consecutiva / umbral */}
      {absenceAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="flex items-start gap-3">
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
                      `${a.councilor.fullName} (${a.consecutiveAbsences >= 2 ? `${a.consecutiveAbsences} ausencias seguidas` : `${a.pct}% asistencia`})`
                  )
                  .join(' · ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista + Detalle de Sesión */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        <div className="lg:col-span-4 space-y-2.5">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Sesiones registradas ({sessions.length})
          </h3>
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
              No hay sesiones convocadas todavía.
            </div>
          ) : (
            sessions.map((s) => {
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
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                    <span className="text-blue-600 dark:text-cyan-400">
                      {s.sessionType} · {s.status.replace('_', ' ')}
                    </span>
                    <span className="font-mono-num text-slate-500">{s.dateIso}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {s.title}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">{s.location}</span>
                    <span className="font-mono-num font-semibold text-emerald-600 shrink-0">
                      {pCount} pres.
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-8">
          {!selectedSession ? (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
              Selecciona o convoca una sesión para gestionar asistencia y quórum.
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase text-blue-600 dark:text-cyan-400">
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
                  {isLeader && (
                    <>
                      <select
                        value={selectedSession.status}
                        onChange={(e) =>
                          handleChangeStatus(selectedSession, e.target.value as CouncilSession['status'])
                        }
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold"
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
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Editar
                      </button>
                    </>
                  )}
                  {onOpenActas && (
                    <button
                      type="button"
                      onClick={() => onOpenActas(selectedSession.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      Redactar Acta
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPrintableActa(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Lista PDF
                  </button>
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(selectedSession)}
                      className="rounded-xl p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {editingSession && isLeader && (
                <form
                  onSubmit={handleSaveSessionEdit}
                  className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-950 p-4 space-y-3"
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
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" /> Guardar cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSession(false)}
                      className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
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
                    className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-cyan-400 hover:underline"
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
                          {hasQuorum ? 'Quórum deliberatorio alcanzado' : 'Quórum pendiente'} ({currentPresentCount}/{requiredQuorum})
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
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Registrar mi asistencia
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
                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-cyan-300 cursor-pointer"
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
                          <QrCode className="h-3.5 w-3.5 text-blue-600" /> Código QR
                        </p>
                        <p className="mt-0.5 font-mono-num text-base font-extrabold text-blue-600 dark:text-cyan-400">
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

                    {isLeader && selectedSession.status !== 'finalizada' && (
                      <div className="flex items-center gap-1.5">
                        <select
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
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer disabled:opacity-60"
                        >
                          <RefreshCw className={`h-3 w-3 ${rotatingQr ? 'animate-spin' : ''}`} />
                          Rotar código QR
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lista táctil 1-clic con foto de consejero y acciones masivas */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Llamado a Lista ({activeCouncilors.length} consejeros activos)
                  </h4>
                  {isLeader && selectedSession.status !== 'finalizada' && activeCouncilors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={bulkSaving}
                        onClick={() => handleBulkMark(selectedSession, 'all_present')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Todos presentes
                      </button>
                      <button
                        type="button"
                        disabled={bulkSaving}
                        onClick={() => handleBulkMark(selectedSession, 'remaining_absent')}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
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
                                current === 'presente' || current === 'tarde' ? 'in_session' : 'active'
                              }
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {c.fullName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {c.roleLabel} {c.commissionName ? `· ${c.commissionName}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {(['presente', 'tarde', 'excusa', 'ausente'] as AttendanceStatus[]).map(
                              (st) => {
                                const active = current === st;
                                const disabled = !isLeader || selectedSession.status === 'finalizada';
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handleSetAttendance(selectedSession, c.uid, st)}
                                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-45 ${
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
                            {isLeader && selectedSession.status !== 'finalizada' && (
                              <button
                                type="button"
                                title="Registrar excusa con soporte"
                                onClick={() => {
                                  setExcuseModalTargetUid(c.uid);
                                  setExcuseReason(excuse?.reason || '');
                                  setExcuseFileUrl(excuse?.attachmentUrl || '');
                                  setExcuseFileName(excuse?.attachmentName || '');
                                }}
                                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 text-slate-500 hover:text-blue-600 cursor-pointer"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {excuse && (
                          <div className="ml-12 rounded-xl border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
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
                                <Download className="h-3 w-3" /> {excuse.attachmentName || 'Ver soporte'}
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

      {/* Analítica Visual: Filtros, Gráfica de Tendencia SVG, Ranking y Mapa de Calor */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Analítica de Asistencia y Mapa de Calor
            </h3>
            <p className="text-xs text-slate-500">
              Seguimiento por consejero, comisión y periodo con exportación directa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statsPeriodFilter}
              onChange={(e) => setStatsPeriodFilter(e.target.value as typeof statsPeriodFilter)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="all">Todo el periodo</option>
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="year">Año vigente</option>
            </select>
            <select
              value={statsCommissionFilter}
              onChange={(e) => setStatsCommissionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="todas">Todas las comisiones</option>
              {commissions.map((cm) => (
                <option key={cm.id} value={cm.id}>
                  {cm.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportAttendanceExcel}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
            </button>
          </div>
        </div>

        {/* Gráfica de tendencia por sesión */}
        {sessionTrend.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Tendencia de quórum y asistencia (% por sesión)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 items-end h-32 pt-4">
              {sessionTrend.map((pt) => (
                <div key={pt.id} className="flex flex-col items-center gap-1 h-full justify-end">
                  <span className="font-mono-num text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {pt.pct}%
                  </span>
                  <div className="w-full max-w-[34px] h-20 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-end overflow-hidden">
                    <div
                      title={`${pt.title}: ${pt.pct}%`}
                      className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-cyan-500 transition-all duration-300"
                      style={{ height: `${Math.max(4, pt.pct)}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-[10px] text-slate-500 truncate max-w-full">
                    {pt.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ranking de consejeros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {councilorStats.map(({ councilor, recordedCount, attended, absences, consecutiveAbsences, pct }) => (
            <div
              key={councilor.uid}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarBadge
                    name={councilor.fullName}
                    photoUrl={councilor.photoUrl}
                    thumbUrl={councilor.photoThumbUrl}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {councilor.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {attended}/{recordedCount} asistencias · {absences} aus.
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono-num text-sm font-extrabold ${
                    pct >= 80
                      ? 'text-emerald-600'
                      : pct >= 60
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    pct >= 80 ? 'bg-emerald-600' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {consecutiveAbsences >= 2 && (
                <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                  Alerta: {consecutiveAbsences} inasistencias consecutivas
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Mapa de calor compacto */}
        {filteredSessionsForStats.length > 0 && filteredCouncilorsForStats.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-emerald-600" />
                Matriz / Mapa de Calor (últimas {Math.min(12, filteredSessionsForStats.length)} sesiones)
              </p>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500 inline-block" /> P</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-400 inline-block" /> T</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-blue-500 inline-block" /> E</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-rose-500 inline-block" /> A</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className="py-1.5 px-2 text-left font-semibold text-slate-500">Consejero</th>
                    {filteredSessionsForStats.slice(-12).map((s) => (
                      <th key={s.id} title={s.title} className="py-1.5 px-1 text-center font-mono-num text-slate-400">
                        {s.dateIso.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCouncilorsForStats.map((c) => (
                    <tr key={c.uid}>
                      <td className="py-1.5 px-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                        {c.fullName}
                      </td>
                      {filteredSessionsForStats.slice(-12).map((s) => {
                        const st = s.attendance?.[c.uid];
                        const meta = st ? ATT_LABELS[st] : null;
                        return (
                          <td key={s.id} className="py-1 px-1 text-center">
                            <span
                              title={meta ? `${s.title}: ${meta.label}` : `${s.title}: Sin registro`}
                              className={`inline-flex items-center justify-center h-6 w-6 rounded-md font-bold text-[10px] ${
                                meta
                                  ? meta.cellCls
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              }`}
                            >
                              {meta ? meta.short : '·'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Enviar Excusa */}
      {excuseModalTargetUid && selectedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setExcuseModalTargetUid(null)}
        >
          <form
            onSubmit={handleSubmitExcuse}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Registrar Excusa Formal
                </h4>
                <p className="text-xs text-slate-500">
                  {activeCouncilors.find((c) => c.uid === excuseModalTargetUid)?.fullName || actorName} ·{' '}
                  {selectedSession.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExcuseModalTargetUid(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              rows={3}
              required
              value={excuseReason}
              onChange={(e) => setExcuseReason(e.target.value)}
              placeholder="Motivo de inasistencia o incapacidad (ej: horario académico, laboral, fuerza mayor)..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />

            <MediaUploader
              storageFolder={`excuses/${selectedSession.id}`}
              label="Adjuntar soporte opcional (PDF, imagen o certificado)"
              onUploaded={(files) => {
                if (files[0]) {
                  setExcuseFileUrl(files[0].url);
                  setExcuseFileName(files[0].fileName);
                }
              }}
            />
            {excuseFileUrl && (
              <p className="text-[11px] font-semibold text-emerald-600">
                Soporte listo: {excuseFileName || 'Archivo adjunto'}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExcuseModalTargetUid(null)}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingExcuse}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                {submittingExcuse ? 'Guardando...' : 'Guardar excusa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vista imprimible Acta / Listado PDF */}
      {showPrintableActa && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 overflow-y-auto flex justify-center print:static print:bg-white print:p-0 print:block">
          <div className="w-full max-w-3xl bg-white text-slate-900 rounded-2xl p-8 space-y-5 shadow-2xl my-auto print:shadow-none print:max-w-none print:p-2">
            <div className="flex items-start justify-between border-b border-slate-300 pb-4">
              <div className="flex items-center gap-3">
                <BrandLogo size="md" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Consejo Municipal de Juventudes de Flandes · Tolima
                  </p>
                  <h2 className="mt-0.5 text-xl font-extrabold">{selectedSession.title}</h2>
                  <p className="text-xs text-slate-600">
                    Tipo: {selectedSession.sessionType} · Fecha: {selectedSession.dateIso} ·{' '}
                    {selectedSession.timeRange} · Lugar: {selectedSession.location}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintableActa(false)}
                  className="rounded-xl bg-slate-200 p-2 text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase">Orden del Día</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">
                {selectedSession.agenda || 'Sin orden del día detallado.'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase mb-2">
                Registro Oficial de Asistencia y Quórum ({currentPresentCount}/{requiredQuorum})
              </h3>
              <table className="w-full text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">Consejero(a)</th>
                    <th className="border border-slate-300 p-2 text-left">Cargo</th>
                    <th className="border border-slate-300 p-2 text-left">Estado</th>
                    <th className="border border-slate-300 p-2 text-left">Observación / Excusa</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCouncilors.map((c) => {
                    const st = selectedSession.attendance?.[c.uid] || 'ausente';
                    const exc = selectedSession.excuses?.[c.uid];
                    return (
                      <tr key={c.uid}>
                        <td className="border border-slate-300 p-2 flex items-center gap-2">
                          <AvatarBadge
                            name={c.fullName}
                            photoUrl={c.photoUrl}
                            thumbUrl={c.photoThumbUrl}
                            size="xs"
                          />
                          <span>{c.fullName}</span>
                        </td>
                        <td className="border border-slate-300 p-2">{c.roleLabel}</td>
                        <td className="border border-slate-300 p-2 font-semibold capitalize">{st}</td>
                        <td className="border border-slate-300 p-2 text-slate-600">
                          {exc?.reason || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-center">
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold">Presidencia CMJ Flandes</p>
                <p className="text-slate-500">Firma</p>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <p className="font-bold">Secretaría General CMJ Flandes</p>
                <p className="text-slate-500">Firma y Fe Pública</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
