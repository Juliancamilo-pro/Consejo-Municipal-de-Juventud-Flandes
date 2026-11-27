import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  Hand,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Unlock,
  UserX,
  Vote,
} from 'lucide-react';
import { ApiRequestError, apiRequest, triggerPortalRefresh } from '../../lib/apiClient';
import { exportStyledWorkbook } from '../../lib/excelExport';
import {
  BLANK_VOTE_OPTION,
  ELECTIVE_ROLE_OPTIONS,
  bogotaLocalInputToUtcIso,
  formatBogotaDateTime,
  requiresCommissionForRole,
} from '../../lib/roleTerms';
import { useUnsavedChangesGuard } from '../../lib/unsavedChanges';
import type {
  AccessTier,
  Commission,
  Commitment,
  CouncilSession,
  CouncilVote,
  ElectiveRoleLabel,
  MajorityType,
  PublicCouncilor,
  RoleLabel,
  RoleTerm,
  VoteKind,
  VoteMode,
} from '../../types/cmj';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { AnimatedCounter, ConfettiBurst, EmptyState } from '../ui/AnimatedPrimitives';
import { ConfirmDialog, DataToolbar, PaginationBar } from '../ui/DataTableUI';
import { recordAudit } from './auditHelper';
import { CommitmentsSection } from './votes/CommitmentsSection';
import { PrintableVoteModal } from './votes/PrintableVoteModal';
import {
  MAJORITY_LABELS,
  MODE_LABELS,
  VOTE_COLORS,
  VOTE_STATUS_META,
  VoteDonutChart,
} from './votes/voteShared';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

export function VotesAndCommitmentsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier: _accessTier,
  commissions,
  publicCouncilors,
  sessions = [],
  votes,
  commitments,
  roleTerms = [],
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  sessions?: CouncilSession[];
  votes: CouncilVote[];
  commitments: Commitment[];
  roleTerms?: RoleTerm[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canCreateVote = can('votaciones.crear');
  const canEditVote = can('votaciones.editar');
  const canCloseVote = can('votaciones.cerrar');
  const canDeleteVote = can('votaciones.eliminar');
  const activeCouncilors = useMemo(
    () => publicCouncilors.filter((c) => c.active),
    [publicCouncilors]
  );

  // Nueva votación
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [voteKind, setVoteKind] = useState<VoteKind>('general');
  const [targetRole, setTargetRole] = useState<ElectiveRoleLabel>('Presidente');
  const [targetCommissionId, setTargetCommissionId] = useState('');
  const [selectedCandidateUids, setSelectedCandidateUids] = useState<string[]>([]);
  const [allowSelfVote, setAllowSelfVote] = useState(false);
  const [voteTitle, setVoteTitle] = useState('');
  const [voteDesc, setVoteDesc] = useState('');
  const [voteMode, setVoteMode] = useState<VoteMode>('nominal');
  const [majorityType, setMajorityType] = useState<MajorityType>('simple');
  const [sessionId, setSessionId] = useState('');
  const [optionsText, setOptionsText] = useState('Sí\nNo\nAbstención\nEn blanco');
  const [quorumReq, setQuorumReq] = useState(() =>
    Math.max(1, Math.floor(activeCouncilors.length / 2) + 1)
  );
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [printableVote, setPrintableVote] = useState<CouncilVote | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [creatingRunoffId, setCreatingRunoffId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Buscador y paginación de votaciones
  const [voteSearch, setVoteSearch] = useState('');
  const [voteStatusFilter, setVoteStatusFilter] = useState<'todas' | 'abierta' | 'cerrada'>('todas');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Confirmación eliminar votación
  const [deleteVoteTarget, setDeleteVoteTarget] = useState<CouncilVote | null>(null);
  const [deletingVote, setDeletingVote] = useState(false);

  // Editar votación
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);
  const [editVoteTitle, setEditVoteTitle] = useState('');
  const [editVoteDesc, setEditVoteDesc] = useState('');
  const [editVoteMode, setEditVoteMode] = useState<VoteMode>('nominal');
  const [editVoteMajority, setEditVoteMajority] = useState<MajorityType>('simple');
  const [editVoteSessionId, setEditVoteSessionId] = useState('');
  const [editVoteQuorum, setEditVoteQuorum] = useState(1);
  const [editVoteDeadline, setEditVoteDeadline] = useState('');
  const [editVoteOptions, setEditVoteOptions] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useUnsavedChangesGuard(
    'votes-editor',
    (showCreateForm && Boolean(voteTitle.trim() || voteDesc.trim())) || Boolean(editingVoteId)
  );

  const triggerConfetti = () => {
    setConfettiActive(true);
    window.setTimeout(() => setConfettiActive(false), 1600);
  };

  const linkedSessionObj = sessions.find((s) => s.id === sessionId);
  const linkedSessionPresent = linkedSessionObj
    ? Object.values(linkedSessionObj.attendance || {}).filter(
        (v) => v === 'presente' || v === 'tarde'
      ).length
    : null;
  const linkedSessionQuorumMet =
    linkedSessionObj && linkedSessionPresent !== null
      ? linkedSessionPresent >= (linkedSessionObj.quorumRequired || 1)
      : true;

  const openPendingVotes = votes.filter((v) => v.status === 'abierta' && !v.voterUids.includes(uid));

  const filteredVotes = useMemo(() => {
    const q = voteSearch.trim().toLowerCase();
    return votes.filter((v) => {
      if (voteStatusFilter === 'abierta' && v.status !== 'abierta') return false;
      if (voteStatusFilter === 'cerrada' && v.status === 'abierta') return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q) ||
        (v.resultSummary || '').toLowerCase().includes(q) ||
        (v.targetRole || '').toLowerCase().includes(q) ||
        (v.winnerName || '').toLowerCase().includes(q)
      );
    });
  }, [votes, voteSearch, voteStatusFilter]);

  const paginatedVotes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVotes.slice(start, start + pageSize);
  }, [filteredVotes, page, pageSize]);

  const handleCreateVote = async (e: React.FormEvent) => {
    e.preventDefault();
    const isElection = voteKind === 'eleccion_cargo';
    const opts = isElection
      ? []
      : optionsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

    if (!voteTitle.trim()) {
      showToast('Ingresa el título de la votación', 'error');
      return;
    }

    if (isElection) {
      if (requiresCommissionForRole(targetRole) && !targetCommissionId) {
        showToast('Selecciona la comisión para la elección de Coordinador', 'error');
        return;
      }
      if (selectedCandidateUids.length < 1) {
        showToast('Selecciona al menos 1 candidato activo para la elección', 'error');
        return;
      }
    } else if (opts.length < 2) {
      showToast('Ingresa al menos 2 opciones', 'error');
      return;
    }

    if (linkedSessionObj && !linkedSessionQuorumMet) {
      showToast(
        'Quórum insuficiente en la sesión vinculada',
        'error',
        `Asistencia actual ${linkedSessionPresent}/${linkedSessionObj.quorumRequired || 1}. Verifica el llamado a lista primero.`
      );
      return;
    }

    const opensAtIso = opensAt ? bogotaLocalInputToUtcIso(opensAt) : '';
    const closesAtIso = closesAt ? bogotaLocalInputToUtcIso(closesAt) : '';

    try {
      await apiRequest('/api/votes', {
        method: 'POST',
        body: {
          title: voteTitle.trim(),
          description:
            voteDesc.trim() ||
            (isElection
              ? `Elección democrática para el cargo de ${targetRole}`
              : 'Votación oficial de plenaria CMJ Flandes'),
          kind: voteKind,
          targetRole: isElection ? targetRole : '',
          targetCommissionId:
            isElection && requiresCommissionForRole(targetRole) ? targetCommissionId : '',
          candidateUids: isElection ? selectedCandidateUids : undefined,
          allowSelfVote: isElection ? allowSelfVote : true,
          sessionId,
          voteMode,
          majorityType,
          options: opts,
          quorumRequired: Math.max(1, Number(quorumReq) || 1),
          opensAt: opensAtIso,
          closesAt: closesAtIso,
          deadline: closesAtIso,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: isElection
          ? `Abrió elección de cargo (${targetRole} · ${MODE_LABELS[voteMode]})`
          : `Abrió votación (${MODE_LABELS[voteMode]})`,
        module: 'Votaciones',
        targetTitle: voteTitle.trim(),
      });
      setVoteTitle('');
      setVoteDesc('');
      setSelectedCandidateUids([]);
      setVoteKind('general');
      setAllowSelfVote(false);
      setShowCreateForm(false);
      triggerPortalRefresh();
      showToast('Votación abierta y notificada a los consejeros', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo crear la votación';
      showToast(msg, 'error');
    }
  };

  const handleCastVote = async (vote: CouncilVote, option: string) => {
    if (vote.status !== 'abierta') return;
    if (vote.voterUids.includes(uid)) {
      showToast('Ya registraste tu voto en esta consulta', 'info');
      return;
    }
    try {
      await apiRequest(`/api/votes/${encodeURIComponent(vote.id)}/cast`, {
        method: 'POST',
        body: { option },
      });
      triggerPortalRefresh();
      showToast(
        vote.voteMode === 'secreto'
          ? 'Tu voto secreto quedó registrado de forma anónima'
          : `Voto registrado: ${option}`,
        'success'
      );
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo registrar el voto';
      showToast(msg, 'error');
    }
  };

  const handleToggleVoteStatus = async (vote: CouncilVote) => {
    const next = vote.status === 'abierta' ? 'cerrada' : 'abierta';
    try {
      await apiRequest(`/api/votes/${encodeURIComponent(vote.id)}`, {
        method: 'PATCH',
        body: { status: next },
      });
      triggerPortalRefresh();
      if (next === 'cerrada') {
        const total = vote.voterUids.length;
        const quorumMet = total >= (vote.quorumRequired || 1);
        const yesVotes = vote.tallies?.['Sí'] || vote.tallies?.['A favor'] || 0;
        const topOpt = vote.options
          .slice()
          .sort((a, b) => (vote.tallies?.[b] || 0) - (vote.tallies?.[a] || 0))[0];
        if (quorumMet && (yesVotes > 0 || topOpt === vote.options[0])) {
          triggerConfetti();
        }
      }
      showToast(
        next === 'cerrada' ? 'Votación cerrada y escrutada' : 'Votación reabierta',
        'info'
      );
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'Error al actualizar votación',
        'error'
      );
    }
  };

  const handleCreateRunoff = async (vote: CouncilVote) => {
    setCreatingRunoffId(vote.id);
    try {
      await apiRequest(`/api/votes/${encodeURIComponent(vote.id)}/runoff`, {
        method: 'POST',
        body: {},
      });
      triggerPortalRefresh();
      showToast('Segunda vuelta (desempate) abierta y notificada', 'success');
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'No se pudo crear el desempate',
        'error'
      );
    } finally {
      setCreatingRunoffId(null);
    }
  };

  const startEditVote = (v: CouncilVote) => {
    setEditingVoteId(v.id);
    setEditVoteTitle(v.title);
    setEditVoteDesc(v.description || '');
    setEditVoteMode(v.voteMode || 'nominal');
    setEditVoteMajority(v.majorityType || 'simple');
    setEditVoteSessionId(v.sessionId || '');
    setEditVoteQuorum(v.quorumRequired || 1);
    setEditVoteDeadline(v.closesAt || v.deadline || '');
    setEditVoteOptions(v.options.join('\n'));
  };

  const handleSaveVoteEdit = async (v: CouncilVote) => {
    if (!editVoteTitle.trim()) return;
    try {
      const payload: Record<string, unknown> = {
        title: editVoteTitle.trim(),
        description: editVoteDesc.trim(),
        sessionId: editVoteSessionId,
        majorityType: editVoteMajority,
        quorumRequired: Math.max(1, Number(editVoteQuorum) || 1),
        closesAt: editVoteDeadline,
        deadline: editVoteDeadline,
      };
      if (v.voterUids.length === 0) {
        const opts = editVoteOptions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (opts.length >= 2) payload.options = opts;
        payload.voteMode = editVoteMode;
      }
      await apiRequest(`/api/votes/${encodeURIComponent(v.id)}`, {
        method: 'PATCH',
        body: payload,
      });
      setEditingVoteId(null);
      showToast('Votación actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la votación', 'error');
    }
  };

  const handleConfirmDeleteVote = async () => {
    if (!deleteVoteTarget) return;
    setDeletingVote(true);
    try {
      await apiRequest(`/api/votes/${encodeURIComponent(deleteVoteTarget.id)}`, {
        method: 'DELETE',
      });
      showToast('Votación eliminada', 'info');
      setDeleteVoteTarget(null);
    } catch {
      showToast('No se pudo eliminar', 'error');
    } finally {
      setDeletingVote(false);
    }
  };

  const handleExportVoteExcel = async (v: CouncilVote) => {
    const total = v.voterUids.length;
    const escrutinioRows = v.options.map((opt) => {
      const count = v.tallies?.[opt] || 0;
      const pctFraction = total > 0 ? count / total : 0;
      return {
        mocion: v.title,
        modalidad: MODE_LABELS[v.voteMode || 'nominal'],
        mayoria: MAJORITY_LABELS[v.majorityType || 'simple'],
        opcion: opt,
        votos: count,
        porcentaje: pctFraction,
        resultado: v.resultSummary || 'En curso',
      };
    });

    const sheets = [
      {
        name: 'Escrutinio',
        title: `Escrutinio: ${v.title}`,
          kpis: [
          { label: 'Total sufragantes', value: total },
          { label: 'Quórum requerido', value: v.quorumRequired || 1 },
          { label: 'Estado', value: (VOTE_STATUS_META[v.status] || VOTE_STATUS_META.cerrada).label },
        ],
        columns: [
          { key: 'mocion', header: 'Moción / Acuerdo', type: 'text' as const, minWidth: 28, wrap: true },
          { key: 'modalidad', header: 'Modalidad', type: 'text' as const, minWidth: 20 },
          { key: 'mayoria', header: 'Mayoría', type: 'text' as const, minWidth: 22 },
          { key: 'opcion', header: 'Opción', type: 'text' as const, minWidth: 16 },
          { key: 'votos', header: 'Votos', type: 'integer' as const, minWidth: 10 },
          { key: 'porcentaje', header: 'Porcentaje', type: 'percent' as const, minWidth: 13 },
          { key: 'resultado', header: 'Dictamen', type: 'text' as const, minWidth: 24 },
        ],
        rows: escrutinioRows,
      },
    ];

    if (v.voteMode !== 'secreto' && v.nominalBallots && Object.keys(v.nominalBallots).length > 0) {
      sheets.push({
        name: 'Voto Nominal',
        title: 'Registro Nominal por Consejero',
        kpis: [],
        columns: [
          { key: 'consejero', header: 'Consejero(a)', type: 'text' as const, minWidth: 24, wrap: false },
          { key: 'cargo', header: 'Cargo', type: 'text' as const, minWidth: 16, wrap: false },
          { key: 'comision', header: 'Comisión', type: 'text' as const, minWidth: 22, wrap: false },
          { key: 'voto', header: 'Decisión emitida', type: 'text' as const, minWidth: 16, wrap: false },
        ] as never,
        rows: Object.entries(v.nominalBallots).map(([voterUid, choice]) => {
          const c = publicCouncilors.find((u) => u.uid === voterUid);
          return {
            consejero: c?.fullName || 'Consejero',
            cargo: c?.roleLabel || 'Consejero',
            comision: c?.commissionName || 'Sin comisión',
            voto: choice,
          };
        }) as never,
      });
    }

    await exportStyledWorkbook({
      fileName: `Escrutinio_${v.title.slice(0, 24).replace(/\s+/g, '_')}.xlsx`,
      reportTitle: 'Acta de Escrutinio CMJ Flandes',
      moduleName: 'Votaciones de Plenaria',
      generatedBy: actorName,
      includeSummarySheet: sheets.length > 1,
      sheets,
    });
    showToast('Escrutinio exportado a Excel', 'success');
  };

  const handleExportAllVotesWorkbook = async () => {
    await exportStyledWorkbook({
      fileName: `CMJ_Flandes_Votaciones_Compromisos_${new Date().toISOString().slice(0, 10)}.xlsx`,
      reportTitle: 'Consolidado de Votaciones y Compromisos CMJ',
      moduleName: 'Votaciones y Compromisos',
      generatedBy: actorName,
      includeSummarySheet: true,
      sheets: [
        {
          name: 'Votaciones',
          title: 'Historial de Votaciones Plenarias',
          columns: [
            { key: 'titulo', header: 'Moción / Proposición', type: 'text', minWidth: 30, wrap: true },
            { key: 'modalidad', header: 'Modalidad', type: 'text', minWidth: 18 },
            { key: 'mayoria', header: 'Mayoría', type: 'text', minWidth: 20 },
            { key: 'estado', header: 'Estado', type: 'text', minWidth: 14 },
            { key: 'votos', header: 'Participantes', type: 'integer', minWidth: 13 },
            { key: 'quorum', header: 'Quórum req.', type: 'integer', minWidth: 12 },
            { key: 'resultado', header: 'Dictamen', type: 'text', minWidth: 26, wrap: true },
          ],
          rows: votes.map((v) => ({
            titulo: v.title,
            modalidad: MODE_LABELS[v.voteMode || 'nominal'],
            mayoria: MAJORITY_LABELS[v.majorityType || 'simple'],
            estado: (VOTE_STATUS_META[v.status] || VOTE_STATUS_META.cerrada).label.toUpperCase(),
            votos: v.voterUids.length,
            quorum: v.quorumRequired || 1,
            resultado: v.resultSummary || 'En curso',
          })),
        },
        {
          name: 'Compromisos',
          title: 'Matriz de Compromisos Institucionales',
          columns: [
            { key: 'titulo', header: 'Compromiso', type: 'text', minWidth: 32, wrap: true },
            { key: 'responsable', header: 'Responsable', type: 'text', minWidth: 22 },
            { key: 'estado', header: 'Estado', type: 'text', minWidth: 14 },
            { key: 'avance', header: 'Avance', type: 'percent', minWidth: 12 },
            { key: 'limite', header: 'Fecha límite', type: 'date', minWidth: 13 },
          ],
          rows: commitments.map((c) => ({
            titulo: c.title,
            responsable: c.responsibleName,
            estado: c.status.replace('_', ' ').toUpperCase(),
            avance: (c.progress ?? 0) / 100,
            limite: c.dueDate || '',
          })),
        },
      ],
    });
    showToast('Libro de Votaciones y Compromisos exportado', 'success');
  };

  const formatCountdown = (targetIso?: string) => {
    if (!targetIso) return null;
    const targetTs = Date.parse(targetIso);
    if (Number.isNaN(targetTs)) return null;
    const diff = targetTs - nowTick;
    if (diff <= 0) return 'Tiempo cumplido';
    const hrs = Math.floor(diff / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    const secs = Math.floor((diff % 60_000) / 1000);
    if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <ConfettiBurst active={confettiActive} />

      {openPendingVotes.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 flex items-center gap-3 no-print">
          <BellRing className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
            Tienes {openPendingVotes.length}{' '}
            {openPendingVotes.length === 1
              ? 'votación abierta pendiente'
              : 'votaciones abiertas pendientes'}{' '}
            por emitir tu voto.
          </p>
        </div>
      )}

      {/* Votaciones */}
      <div className="space-y-5 no-print">
        <div className="cmj-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Vote className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                Votaciones de Plenaria y Escrutinio
              </h2>
              <p className="text-xs text-slate-500">
                Modalidad nominal, secreta o mano alzada, mayoría reglamentaria y escrutinio en tiempo real.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportAllVotesWorkbook}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Consolidado Excel
              </button>
              {canCreateVote ? (
                <button
                  type="button"
                  onClick={() => setShowCreateForm((v) => !v)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  {showCreateForm ? 'Cerrar formulario' : 'Abrir votación'}
                </button>
              ) : (
                <PermissionDeniedBanner
                  permission="votaciones.crear"
                  compact
                  customText="Solo Mesa Directiva o permiso especial puede abrir votaciones."
                />
              )}
            </div>
          </div>

          {canCreateVote && showCreateForm && (
            <form
              onSubmit={handleCreateVote}
              className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-slate-950 p-4 space-y-3"
            >
              {/* Tipo de votación: General vs Elección de Cargo */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-emerald-200/70 dark:border-emerald-900/40">
                <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
                  <button
                    type="button"
                    onClick={() => setVoteKind('general')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      voteKind === 'general'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Votación general
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoteKind('eleccion_cargo');
                      if (!voteTitle.trim()) {
                        setVoteTitle(`Elección de ${targetRole}`);
                      }
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                      voteKind === 'eleccion_cargo'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Award className="h-3.5 w-3.5" />
                    Elección de cargo
                  </button>
                </div>

                {voteKind === 'eleccion_cargo' && (
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!allowSelfVote}
                      onChange={(e) => setAllowSelfVote(!e.target.checked)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <span>Impedir autovoto (candidatos no votan por sí mismos)</span>
                  </label>
                )}
              </div>

              {voteKind === 'eleccion_cargo' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 bg-white/80 dark:bg-slate-900/70 p-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Cargo a elegir *
                    </label>
                    <select
                      aria-label="Cargo a elegir"
                      value={targetRole}
                      onChange={(e) => {
                        const nextRole = e.target.value as ElectiveRoleLabel;
                        setTargetRole(nextRole);
                        if (!voteTitle.trim() || voteTitle.startsWith('Elección de ')) {
                          setVoteTitle(`Elección de ${nextRole}`);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                    >
                      {ELECTIVE_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.roleLabel} value={opt.roleLabel}>
                          {opt.roleLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {requiresCommissionForRole(targetRole) && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Comisión a coordinar *
                      </label>
                      <select
                        aria-label="Comisión a coordinar"
                        value={targetCommissionId}
                        onChange={(e) => setTargetCommissionId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                      >
                        <option value="">Selecciona una comisión...</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            Comisión {c.number}: {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={voteTitle}
                  onChange={(e) => setVoteTitle(e.target.value)}
                  placeholder={
                    voteKind === 'eleccion_cargo'
                      ? `Ej. Elección de ${targetRole} 2026`
                      : 'Proposición o acuerdo a votar'
                  }
                  className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
                />
                <select
                  aria-label="Modalidad de votación"
                  value={voteMode}
                  onChange={(e) => setVoteMode(e.target.value as VoteMode)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm"
                >
                  <option value="nominal">Votación Nominal (pública)</option>
                  <option value="secreto">Votación Secreta (anónima)</option>
                  <option value="mano_alzada">Mano Alzada (plenario)</option>
                </select>
                <select
                  aria-label="Tipo de mayoría"
                  value={majorityType}
                  onChange={(e) => setMajorityType(e.target.value as MajorityType)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm"
                >
                  <option value="simple">Mayoría simple</option>
                  <option value="absoluta">Mayoría absoluta (50%+1)</option>
                  <option value="dos_tercios">Mayoría calificada (2/3)</option>
                  <option value="unanimidad">Unanimidad (100%)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {voteKind === 'eleccion_cargo' ? (
                  <div className="sm:col-span-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Candidatos postulados ({selectedCandidateUids.length}) + {BLANK_VOTE_OPTION}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCandidateUids(activeCouncilors.map((c) => c.uid))}
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCandidateUids([])}
                          className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-1">
                      {activeCouncilors.map((c) => {
                        const checked = selectedCandidateUids.includes(c.uid);
                        return (
                          <label
                            key={c.uid}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedCandidateUids((prev) =>
                                  e.target.checked
                                    ? [...prev, c.uid]
                                    : prev.filter((id) => id !== c.uid)
                                )
                              }
                              className="h-3.5 w-3.5 accent-emerald-600 shrink-0"
                            />
                            <AvatarBadge
                              name={c.fullName}
                              photoUrl={c.photoUrl}
                              thumbUrl={c.photoThumbUrl}
                              size="xs"
                            />
                            <span className="truncate flex-1">{c.fullName}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">{c.roleLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="sm:col-span-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">
                        Opciones (1 por línea)
                      </span>
                      <button
                        type="button"
                        onClick={() => setOptionsText('Sí\nNo\nAbstención\nEn blanco')}
                        className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Plantilla estándar
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={optionsText}
                      onChange={(e) => setOptionsText(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs"
                    />
                  </div>
                )}

                <div className="sm:col-span-5 space-y-2">
                  <input
                    type="text"
                    value={voteDesc}
                    onChange={(e) => setVoteDesc(e.target.value)}
                    placeholder="Contexto breve o número de proposición"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label="Sesión vinculada"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
                    >
                      <option value="">Sin sesión vinculada</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.dateIso} · {s.title}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500 shrink-0">Quórum:</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={quorumReq}
                        onChange={(e) => setQuorumReq(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-mono-num"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="datetime-local"
                      title="Apertura programada en hora Colombia (opcional)"
                      value={opensAt}
                      onChange={(e) => setOpensAt(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px]"
                    />
                    <input
                      type="datetime-local"
                      title="Cierre programado en hora Colombia (opcional)"
                      value={closesAt}
                      onChange={(e) => setClosesAt(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11px]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4" /> Publicar
                  </button>
                </div>
              </div>

              {linkedSessionObj && !linkedSessionQuorumMet && (
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4" />
                  Advertencia: la sesión seleccionada tiene {linkedSessionPresent}/
                  {linkedSessionObj.quorumRequired || 1} presentes (sin quórum aún).
                </p>
              )}
            </form>
          )}

          <DataToolbar
            search={voteSearch}
            onSearchChange={(v) => {
              setVoteSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Buscar votación o proposición..."
          >
            <select
              aria-label="Filtrar estado de votación"
              value={voteStatusFilter}
              onChange={(e) => {
                setVoteStatusFilter(e.target.value as typeof voteStatusFilter);
                setPage(1);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="todas">Todas</option>
              <option value="abierta">Abiertas</option>
              <option value="cerrada">Cerradas</option>
            </select>
          </DataToolbar>
        </div>

        {paginatedVotes.length === 0 ? (
          <EmptyState
            icon={Vote}
            title="Sin votaciones coincidentes"
            description="Ajusta el filtro o convoca una nueva votación de plenaria."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {paginatedVotes.map((v) => {
                const totalVotes = v.voterUids.length;
                const alreadyVoted = v.voterUids.includes(uid);
                const quorumMet = totalVotes >= (v.quorumRequired || 1);
                const countdown =
                  v.status === 'abierta' ? formatCountdown(v.closesAt || v.deadline) : null;
                const linkedSess = v.sessionId
                  ? sessions.find((s) => s.id === v.sessionId)
                  : null;
                const mode = v.voteMode || 'nominal';
                const statusMeta = VOTE_STATUS_META[v.status] || VOTE_STATUS_META.cerrada;
                const isElection = v.kind === 'eleccion_cargo';
                const linkedTerm = isElection
                  ? roleTerms.find((t) => t.electedByVoteId === v.id)
                  : undefined;
                const targetCommName = v.targetCommissionId
                  ? commissions.find((c) => c.id === v.targetCommissionId)?.name
                  : undefined;
                const canReopenThis =
                  v.status === 'cerrada' && !isElection;

                return (
                  <div key={v.id} className="cmj-card p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                          <span className={`rounded-md px-2 py-0.5 ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                          {isElection && v.targetRole && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300 px-2 py-0.5">
                              <Award className="h-3 w-3" />
                              Elección: {v.targetRole}
                              {targetCommName ? ` (${targetCommName})` : ''}
                            </span>
                          )}
                          {v.parentVoteId && (
                            <span className="rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-2 py-0.5">
                              2.ª vuelta (desempate)
                            </span>
                          )}
                          {isElection && v.allowSelfVote === false && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5">
                              <UserX className="h-3 w-3" /> Sin autovoto
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            {mode === 'mano_alzada' && <Hand className="h-3 w-3" />}
                            {MODE_LABELS[mode]}
                          </span>
                          <span className="text-slate-500">
                            · {MAJORITY_LABELS[v.majorityType || 'simple']}
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                          {v.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono-num">
                          <span>
                            Quórum: <AnimatedCounter value={totalVotes} />/
                            {v.quorumRequired || 1} {quorumMet ? '✓' : '(pendiente)'}
                          </span>
                          {countdown && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Clock className="h-3 w-3" /> {countdown}
                            </span>
                          )}
                          {linkedSess && (
                            <span className="text-emerald-700 dark:text-emerald-400 font-sans">
                              Sesión: {linkedSess.title}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleExportVoteExcel(v)}
                          title="Exportar escrutinio a Excel"
                          aria-label="Exportar escrutinio a Excel"
                          className="rounded-lg p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintableVote(v)}
                          title="Imprimir acta de resultados"
                          aria-label="Imprimir acta de resultados"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {canEditVote && (
                          <button
                            type="button"
                            onClick={() =>
                              editingVoteId === v.id
                                ? setEditingVoteId(null)
                                : startEditVote(v)
                            }
                            title="Editar votación"
                            aria-label="Editar votación"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-700 cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        {canCloseVote && (v.status === 'abierta' || canReopenThis) && (
                          <button
                            type="button"
                            onClick={() => handleToggleVoteStatus(v)}
                            title={v.status === 'abierta' ? 'Cerrar votación' : 'Reabrir votación'}
                            aria-label={
                              v.status === 'abierta' ? 'Cerrar votación' : 'Reabrir votación'
                            }
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {v.status === 'abierta' ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {canDeleteVote && (
                          <button
                            type="button"
                            onClick={() => setDeleteVoteTarget(v)}
                            title="Eliminar votación"
                            aria-label="Eliminar votación"
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {v.resultSummary && (
                      <div
                        className={`rounded-xl px-3 py-2 text-xs font-bold ${
                          v.status === 'empate'
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                            : v.status === 'sin_resultado'
                              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                              : v.resultSummary.startsWith('Aprobada') || Boolean(v.winnerUid)
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        Resultado: {v.resultSummary}
                      </div>
                    )}

                    {v.status === 'empate' && isElection && canCreateVote && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          Empate registrado entre candidatos punteros. Convoca la segunda vuelta oficial.
                        </p>
                        <button
                          type="button"
                          disabled={creatingRunoffId === v.id}
                          onClick={() => handleCreateRunoff(v)}
                          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {creatingRunoffId === v.id ? 'Creando...' : 'Crear desempate'}
                        </button>
                      </div>
                    )}

                    {linkedTerm && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                          <CalendarClock className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                          {linkedTerm.status === 'vigente'
                            ? `Relevo aplicado desde ${formatBogotaDateTime(linkedTerm.startDate)}`
                            : linkedTerm.status === 'programado' && linkedTerm.startDate
                              ? `Entrega programada para el ${formatBogotaDateTime(linkedTerm.startDate)}`
                              : linkedTerm.status === 'programado'
                                ? 'Relevo pendiente por definir fecha de entrega en Usuarios y Mesa'
                                : linkedTerm.status === 'cancelado'
                                  ? 'Relevo cancelado'
                                  : 'Periodo finalizado'}
                        </span>
                      </div>
                    )}

                    {editingVoteId === v.id && canEditVote && (
                      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-slate-950 p-3.5 space-y-2.5">
                        <input
                          type="text"
                          value={editVoteTitle}
                          onChange={(e) => setEditVoteTitle(e.target.value)}
                          placeholder="Título"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={editVoteDesc}
                          onChange={(e) => setEditVoteDesc(e.target.value)}
                          placeholder="Descripción"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={1}
                            value={editVoteQuorum}
                            onChange={(e) => setEditVoteQuorum(Number(e.target.value))}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                          />
                          <select
                            value={editVoteMajority}
                            onChange={(e) => setEditVoteMajority(e.target.value as MajorityType)}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                          >
                            <option value="simple">Mayoría simple</option>
                            <option value="absoluta">Mayoría absoluta</option>
                            <option value="dos_tercios">2/3</option>
                            <option value="unanimidad">Unanimidad</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editVoteSessionId}
                            onChange={(e) => setEditVoteSessionId(e.target.value)}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                          >
                            <option value="">Sin sesión vinculada</option>
                            {sessions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.dateIso} · {s.title}
                              </option>
                            ))}
                          </select>
                          <input
                            type="datetime-local"
                            value={editVoteDeadline}
                            onChange={(e) => setEditVoteDeadline(e.target.value)}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                          />
                        </div>
                        {v.voterUids.length === 0 && (
                          <>
                            <select
                              value={editVoteMode}
                              onChange={(e) => setEditVoteMode(e.target.value as VoteMode)}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                            >
                              <option value="nominal">Votación Nominal</option>
                              <option value="secreto">Votación Secreta</option>
                              <option value="mano_alzada">Mano Alzada</option>
                            </select>
                            <textarea
                              rows={2}
                              value={editVoteOptions}
                              onChange={(e) => setEditVoteOptions(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                            />
                          </>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveVoteEdit(v)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                          >
                            <Check className="h-3.5 w-3.5" /> Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingVoteId(null)}
                            className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <VoteDonutChart options={v.options} tallies={v.tallies} />
                      <div className="flex-1 w-full space-y-2.5">
                        {v.options.map((opt, idx) => {
                          const count = v.tallies?.[opt] || 0;
                          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                          const barColor = VOTE_COLORS[idx % VOTE_COLORS.length];
                          const myCandidateEntry =
                            isElection && v.allowSelfVote === false
                              ? v.candidates?.find((c) => c.uid === uid)
                              : undefined;
                          const isBlockedSelfOption = Boolean(
                            myCandidateEntry &&
                              myCandidateEntry.fullName.trim().toLowerCase() ===
                                opt.trim().toLowerCase()
                          );
                          const optionDisabled =
                            v.status !== 'abierta' || alreadyVoted || isBlockedSelfOption;

                          return (
                            <div key={opt} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <button
                                  type="button"
                                  disabled={optionDisabled}
                                  title={
                                    isBlockedSelfOption
                                      ? 'El autovoto está deshabilitado en esta elección'
                                      : undefined
                                  }
                                  onClick={() => handleCastVote(v, opt)}
                                  className="font-semibold text-left text-slate-800 dark:text-slate-100 hover:text-emerald-700 disabled:cursor-default disabled:opacity-70 cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <span
                                    className="h-2.5 w-2.5 rounded-full inline-block shrink-0"
                                    style={{ backgroundColor: barColor }}
                                  />
                                  <span>{opt}</span>
                                  {isBlockedSelfOption && (
                                    <span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-normal text-slate-600 dark:text-slate-300">
                                      Tu candidatura
                                    </span>
                                  )}
                                </button>
                                <span className="font-mono-num text-slate-500">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={optionDisabled}
                                title={
                                  isBlockedSelfOption
                                    ? 'El autovoto está deshabilitado en esta elección'
                                    : undefined
                                }
                                onClick={() => handleCastVote(v, opt)}
                                className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer disabled:cursor-default text-left"
                              >
                                <motion.div
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: pct / 100 }}
                                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                                  style={{
                                    transformOrigin: 'left center',
                                    backgroundColor: barColor,
                                  }}
                                  className="h-full w-full"
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {alreadyVoted ? (
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Tu voto ya quedó registrado
                      </p>
                    ) : v.status === 'abierta' ? (
                      <p className="text-[11px] text-slate-500">
                        Haz clic en una barra u opción para emitir tu voto único.
                      </p>
                    ) : null}

                    {mode !== 'secreto' &&
                      v.nominalBallots &&
                      Object.keys(v.nominalBallots).length > 0 && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-[11px] font-bold text-slate-500 mb-2">
                            Registro nominal ({Object.keys(v.nominalBallots).length} consejeros):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(v.nominalBallots).map(([voterId, choice]) => {
                              const c = publicCouncilors.find((u) => u.uid === voterId);
                              return (
                                <span
                                  key={voterId}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-1 pr-2.5 py-1 text-[11px]"
                                >
                                  <AvatarBadge
                                    name={c?.fullName || 'Consejero'}
                                    photoUrl={c?.photoUrl}
                                    thumbUrl={c?.photoThumbUrl}
                                    size="xs"
                                  />
                                  <strong className="truncate max-w-[110px]">
                                    {c?.fullName || 'Consejero'}:
                                  </strong>{' '}
                                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                    {choice}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>

            <PaginationBar
              totalItems={filteredVotes.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[6, 12, 24]}
            />
          </div>
        )}
      </div>

      {/* Compromisos */}
      <CommitmentsSection
        uid={uid}
        actorName={actorName}
        isLeader={canEditVote || canCreateVote}
        commissions={commissions}
        activeCouncilors={activeCouncilors}
        publicCouncilors={publicCouncilors}
        commitments={commitments}
      />

      <PrintableVoteModal
        vote={printableVote}
        publicCouncilors={publicCouncilors}
        onClose={() => setPrintableVote(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteVoteTarget)}
        title="Eliminar votación"
        description={`¿Confirmas eliminar la votación "${deleteVoteTarget?.title || ''}" y su escrutinio?`}
        confirmLabel="Sí, eliminar votación"
        loading={deletingVote}
        onConfirm={handleConfirmDeleteVote}
        onCancel={() => setDeleteVoteTarget(null)}
      />
    </div>
  );
}
export default VotesAndCommitmentsModule;
