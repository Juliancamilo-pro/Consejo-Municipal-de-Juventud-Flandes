import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BellRing,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  FileSpreadsheet,
  Hand,
  Lock,
  Plus,
  Printer,
  ShieldAlert,
  Trash2,
  Unlock,
  Vote,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type {
  AccessTier,
  Commission,
  Commitment,
  CouncilSession,
  CouncilVote,
  MajorityType,
  PublicCouncilor,
  RoleLabel,
  VoteMode,
} from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { AnimatedCounter, ConfettiBurst } from '../ui/AnimatedPrimitives';
import { recordAudit } from './auditHelper';

const VOTE_COLORS = ['#059669', '#2563EB', '#F59E0B', '#E11D48', '#7C3AED', '#0D9488'];

const MAJORITY_LABELS: Record<MajorityType, string> = {
  simple: 'Mayoría simple',
  absoluta: 'Mayoría absoluta (50% + 1)',
  dos_tercios: 'Mayoría calificada (2/3)',
  unanimidad: 'Unanimidad (100%)',
};

const MODE_LABELS: Record<VoteMode, string> = {
  nominal: 'Nominal (voto público)',
  secreto: 'Secreta (anónima)',
  mano_alzada: 'Mano alzada (plenario)',
};

function VoteDonutChart({ options, tallies }: { options: string[]; tallies?: Record<string, number> }) {
  const total = options.reduce((acc, opt) => acc + (tallies?.[opt] || 0), 0);
  if (total === 0) {
    return (
      <div className="h-24 w-24 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
        0 votos
      </div>
    );
  }

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 90 90" className="h-24 w-24 shrink-0 -rotate-90" aria-label="Distribución de votos">
      {options.map((opt, idx) => {
        const count = tallies?.[opt] || 0;
        const frac = count / total;
        const dash = frac * circumference;
        const currentOffset = offset;
        offset += dash;
        if (count === 0) return null;
        return (
          <circle
            key={opt}
            cx="45"
            cy="45"
            r={radius}
            fill="transparent"
            stroke={VOTE_COLORS[idx % VOTE_COLORS.length]}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-currentOffset}
          />
        );
      })}
      <text
        x="45"
        y="48"
        textAnchor="middle"
        className="rotate-90 origin-center fill-slate-800 dark:fill-white text-[14px] font-extrabold font-mono-num"
      >
        {total}
      </text>
    </svg>
  );
}

export function VotesAndCommitmentsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  commissions,
  publicCouncilors,
  sessions = [],
  votes,
  commitments,
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
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const activeCouncilors = useMemo(
    () => publicCouncilors.filter((c) => c.active),
    [publicCouncilors]
  );

  // Nueva votación
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
  const [nowTick, setNowTick] = useState(() => Date.now());

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

  // Nuevo compromiso
  const [compTitle, setCompTitle] = useState('');
  const [compRespUid, setCompRespUid] = useState(uid);
  const [compCommId, setCompCommId] = useState('');
  const [compDue, setCompDue] = useState('');

  // Editar compromiso
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [editCompTitle, setEditCompTitle] = useState('');
  const [editCompRespUid, setEditCompRespUid] = useState('');
  const [editCompCommId, setEditCompCommId] = useState('');
  const [editCompDue, setEditCompDue] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const triggerConfetti = () => {
    setConfettiActive(true);
    window.setTimeout(() => setConfettiActive(false), 1600);
  };

  // Verificar quórum de sesión vinculada antes de abrir
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

  const handleCreateVote = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = optionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!voteTitle.trim() || opts.length < 2) {
      showToast('Ingresa título y al menos 2 opciones', 'error');
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

    try {
      await apiRequest('/api/votes', {
        method: 'POST',
        body: {
          title: voteTitle.trim(),
          description: voteDesc.trim() || 'Votación oficial de plenaria CMJ Flandes',
          sessionId,
          voteMode,
          majorityType,
          options: opts,
          quorumRequired: Math.max(1, Number(quorumReq) || 1),
          opensAt,
          closesAt,
          deadline: closesAt,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Abrió votación (${MODE_LABELS[voteMode]})`,
        module: 'Votaciones',
        targetTitle: voteTitle.trim(),
      });
      setVoteTitle('');
      setVoteDesc('');
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
      if (next === 'cerrada') {
        const total = vote.voterUids.length;
        const quorumMet = total >= (vote.quorumRequired || 1);
        const yesVotes = vote.tallies?.['Sí'] || vote.tallies?.['A favor'] || 0;
        const topOpt = vote.options.slice().sort((a, b) => (vote.tallies?.[b] || 0) - (vote.tallies?.[a] || 0))[0];
        if (quorumMet && (yesVotes > 0 || topOpt === vote.options[0])) {
          triggerConfetti();
        }
      }
      showToast(next === 'cerrada' ? 'Votación cerrada y escrutada' : 'Votación reabierta', 'info');
    } catch {
      showToast('Error al actualizar votación', 'error');
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

  const handleDeleteVote = async (vote: CouncilVote) => {
    try {
      await apiRequest(`/api/votes/${encodeURIComponent(vote.id)}`, {
        method: 'DELETE',
      });
      showToast('Votación eliminada', 'info');
    } catch {
      showToast('No se pudo eliminar', 'error');
    }
  };

  const handleExportVoteExcel = (v: CouncilVote) => {
    const total = v.voterUids.length;
    const summaryRows = v.options.map((opt) => {
      const count = v.tallies?.[opt] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        Moción: v.title,
        Modalidad: MODE_LABELS[v.voteMode || 'nominal'],
        Mayoría: MAJORITY_LABELS[v.majorityType || 'simple'],
        Opción: opt,
        Votos: count,
        Porcentaje: `${pct}%`,
        Resultado: v.resultSummary || 'En curso',
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Escrutinio');

    if (v.voteMode !== 'secreto' && v.nominalBallots && Object.keys(v.nominalBallots).length > 0) {
      const nominalRows = Object.entries(v.nominalBallots).map(([voterUid, choice]) => {
        const c = publicCouncilors.find((u) => u.uid === voterUid);
        return {
          Consejero: c?.fullName || 'Consejero',
          Cargo: c?.roleLabel || 'Consejero',
          Voto: choice,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nominalRows), 'Voto Nominal');
    }

    XLSX.writeFile(wb, `Escrutinio_${v.title.slice(0, 24).replace(/\s+/g, '_')}.xlsx`);
    showToast('Escrutinio exportado a Excel', 'success');
  };

  const handleCreateCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compTitle.trim()) return;
    const resp = publicCouncilors.find((c) => c.uid === compRespUid);
    try {
      await apiRequest('/api/commitments', {
        method: 'POST',
        body: {
          title: compTitle.trim(),
          description: '',
          responsibleUid: compRespUid || uid,
          responsibleName: resp?.fullName || actorName,
          commissionId: compCommId,
          dueDate: compDue,
        },
      });
      setCompTitle('');
      setCompDue('');
      showToast('Compromiso asignado', 'success');
    } catch {
      showToast('No se pudo crear el compromiso', 'error');
    }
  };

  const handleUpdateCommitment = async (
    c: Commitment,
    status: Commitment['status'],
    progress: number
  ) => {
    try {
      await apiRequest(`/api/commitments/${encodeURIComponent(c.id)}`, {
        method: 'PATCH',
        body: { status, progress },
      });
    } catch {
      showToast('Sin permisos para actualizar compromiso', 'error');
    }
  };

  const startEditComp = (c: Commitment) => {
    setEditingCompId(c.id);
    setEditCompTitle(c.title);
    setEditCompRespUid(c.responsibleUid);
    setEditCompCommId(c.commissionId || '');
    setEditCompDue(c.dueDate || '');
  };

  const handleSaveCompEdit = async (c: Commitment) => {
    if (!editCompTitle.trim()) return;
    const resp = publicCouncilors.find((u) => u.uid === editCompRespUid);
    try {
      await apiRequest(`/api/commitments/${encodeURIComponent(c.id)}`, {
        method: 'PATCH',
        body: {
          title: editCompTitle.trim(),
          responsibleUid: editCompRespUid || c.responsibleUid,
          responsibleName: resp?.fullName || c.responsibleName,
          commissionId: editCompCommId,
          dueDate: editCompDue,
        },
      });
      setEditingCompId(null);
      showToast('Compromiso actualizado', 'success');
    } catch {
      showToast('No se pudo actualizar el compromiso', 'error');
    }
  };

  const handleDeleteCommitment = async (c: Commitment) => {
    try {
      await apiRequest(`/api/commitments/${encodeURIComponent(c.id)}`, {
        method: 'DELETE',
      });
      showToast('Compromiso eliminado', 'info');
    } catch {
      showToast('No se pudo eliminar el compromiso', 'error');
    }
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
    <div className="space-y-8">
      <ConfettiBurst active={confettiActive} />

      {/* Aviso visual de votaciones abiertas pendientes */}
      {openPendingVotes.length > 0 && (
        <div className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/80 dark:bg-blue-950/30 p-4 flex items-center gap-3 no-print">
          <BellRing className="h-5 w-5 text-blue-600 dark:text-cyan-400 shrink-0 animate-pulse" />
          <p className="text-xs font-semibold text-blue-900 dark:text-cyan-100">
            Tienes {openPendingVotes.length}{' '}
            {openPendingVotes.length === 1 ? 'votación abierta pendiente' : 'votaciones abiertas pendientes'}{' '}
            por emitir tu voto.
          </p>
        </div>
      )}

      {/* Votaciones */}
      <div className="space-y-5 no-print">
        {isLeader && (
          <form
            onSubmit={handleCreateVote}
            className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Vote className="h-5 w-5 text-blue-600" /> Votaciones de Plenaria y Escrutinio
              </h2>
              <p className="text-xs text-slate-500">
                Configura modalidad (nominal, secreta o mano alzada), regla de mayoría, vinculación a sesión y horario programado.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={voteTitle}
                onChange={(e) => setVoteTitle(e.target.value)}
                placeholder="Proposición o acuerdo a votar"
                className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
              />
              <select
                value={voteMode}
                onChange={(e) => setVoteMode(e.target.value as VoteMode)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="nominal">Votación Nominal (pública)</option>
                <option value="secreto">Votación Secreta (anónima)</option>
                <option value="mano_alzada">Mano Alzada (plenario)</option>
              </select>
              <select
                value={majorityType}
                onChange={(e) => setMajorityType(e.target.value as MajorityType)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              >
                <option value="simple">Mayoría simple</option>
                <option value="absoluta">Mayoría absoluta (50%+1)</option>
                <option value="dos_tercios">Mayoría calificada (2/3)</option>
                <option value="unanimidad">Unanimidad (100%)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Opciones (1 por línea)</span>
                  <button
                    type="button"
                    onClick={() => setOptionsText('Sí\nNo\nAbstención\nEn blanco')}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Plantilla estándar
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                />
              </div>

              <div className="sm:col-span-5 space-y-2">
                <input
                  type="text"
                  value={voteDesc}
                  onChange={(e) => setVoteDesc(e.target.value)}
                  placeholder="Contexto breve o número de proposición"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
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
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs font-mono-num"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    title="Apertura programada (opcional)"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-[11px]"
                  />
                  <input
                    type="datetime-local"
                    title="Cierre programado (opcional)"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-[11px]"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Abrir
                </button>
              </div>
            </div>

            {linkedSessionObj && !linkedSessionQuorumMet && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4" />
                Advertencia: la sesión seleccionada tiene {linkedSessionPresent}/{linkedSessionObj.quorumRequired || 1} presentes (sin quórum aún).
              </p>
            )}
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {votes.length === 0 ? (
            <div className="lg:col-span-2 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
              No hay votaciones registradas aún.
            </div>
          ) : (
            votes.map((v) => {
              const totalVotes = v.voterUids.length;
              const alreadyVoted = v.voterUids.includes(uid);
              const quorumMet = totalVotes >= (v.quorumRequired || 1);
              const countdown = v.status === 'abierta' ? formatCountdown(v.closesAt || v.deadline) : null;
              const linkedSess = v.sessionId ? sessions.find((s) => s.id === v.sessionId) : null;
              const mode = v.voteMode || 'nominal';

              return (
                <div
                  key={v.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                        <span
                          className={`rounded-md px-2 py-0.5 ${
                            v.status === 'abierta'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                          }`}
                        >
                          {v.status === 'abierta' ? 'Abierta' : 'Cerrada'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-blue-700 dark:text-cyan-300">
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
                          Quórum: <AnimatedCounter value={totalVotes} />/{v.quorumRequired || 1}{' '}
                          {quorumMet ? '✓' : '(pendiente)'}
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
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintableVote(v)}
                        title="Imprimir acta de resultados"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {isLeader && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              editingVoteId === v.id ? setEditingVoteId(null) : startEditVote(v)
                            }
                            title="Editar votación"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleVoteStatus(v)}
                            title={v.status === 'abierta' ? 'Cerrar votación' : 'Reabrir votación'}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            {v.status === 'abierta' ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVote(v)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {v.resultSummary && (
                    <div
                      className={`rounded-xl px-3 py-2 text-xs font-bold ${
                        v.resultSummary.startsWith('Aprobada')
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-900'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      Resultado: {v.resultSummary}
                    </div>
                  )}

                  {editingVoteId === v.id && isLeader && (
                    <div className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-950 p-3.5 space-y-2.5">
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
                          className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" /> Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingVoteId(null)}
                          className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Gráfica de dona + barras animadas */}
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    <VoteDonutChart options={v.options} tallies={v.tallies} />
                    <div className="flex-1 w-full space-y-2.5">
                      {v.options.map((opt, idx) => {
                        const count = v.tallies?.[opt] || 0;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        const barColor = VOTE_COLORS[idx % VOTE_COLORS.length];
                        return (
                          <div key={opt} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <button
                                type="button"
                                disabled={v.status !== 'abierta' || alreadyVoted}
                                onClick={() => handleCastVote(v, opt)}
                                className="font-semibold text-left text-slate-800 dark:text-slate-100 hover:text-blue-600 disabled:cursor-default cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-full inline-block shrink-0"
                                  style={{ backgroundColor: barColor }}
                                />
                                {opt}
                              </button>
                              <span className="font-mono-num text-slate-500">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={v.status !== 'abierta' || alreadyVoted}
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
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
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
                                <span className="font-semibold text-blue-600 dark:text-cyan-400">
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
            })
          )}
        </div>
      </div>

      {/* Compromisos */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" /> Seguimiento de Compromisos
          </h2>
          <p className="text-xs text-slate-500">
            Compromisos derivados de sesiones, comisiones y Mesa Directiva.
          </p>
        </div>

        {isLeader && (
          <form onSubmit={handleCreateCommitment} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              value={compTitle}
              onChange={(e) => setCompTitle(e.target.value)}
              placeholder="Nuevo compromiso..."
              className="sm:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <select
              value={compRespUid}
              onChange={(e) => setCompRespUid(e.target.value)}
              className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              {activeCouncilors.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.fullName}
                </option>
              ))}
            </select>
            <select
              value={compCommId}
              onChange={(e) => setCompCommId(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="">Plenaria / Sin comisión</option>
              {commissions.map((cm) => (
                <option key={cm.id} value={cm.id}>
                  {cm.name}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2 flex gap-1.5">
              <input
                type="date"
                value={compDue}
                onChange={(e) => setCompDue(e.target.value)}
                className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                +
              </button>
            </div>
          </form>
        )}

        {commitments.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No hay compromisos creados.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {commitments.map((c) => {
              const canEdit = isLeader || (c.responsibleUid === uid && c.status !== 'cumplido');
              const isEditingComp = editingCompId === c.id;
              return (
                <div key={c.id} className="py-3 space-y-2">
                  {isEditingComp && isLeader ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={editCompTitle}
                        onChange={(e) => setEditCompTitle(e.target.value)}
                        className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      />
                      <select
                        value={editCompRespUid}
                        onChange={(e) => setEditCompRespUid(e.target.value)}
                        className="sm:col-span-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                      >
                        {activeCouncilors.map((u) => (
                          <option key={u.uid} value={u.uid}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editCompCommId}
                        onChange={(e) => setEditCompCommId(e.target.value)}
                        className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                      >
                        <option value="">Plenaria / Sin comisión</option>
                        {commissions.map((cm) => (
                          <option key={cm.id} value={cm.id}>
                            {cm.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editCompDue}
                        onChange={(e) => setEditCompDue(e.target.value)}
                        className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                      />
                      <div className="sm:col-span-1 flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveCompEdit(c)}
                          className="rounded-lg bg-emerald-600 p-1.5 text-white cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCompId(null)}
                          className="rounded-lg bg-slate-200 dark:bg-slate-800 p-1.5 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.title}</p>
                        <p className="text-[11px] text-slate-500">
                          Responsable: {c.responsibleName} {c.dueDate ? `· Límite ${c.dueDate}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          disabled={!canEdit}
                          value={c.status}
                          onChange={(e) => {
                            const st = e.target.value as Commitment['status'];
                            handleUpdateCommitment(
                              c,
                              st,
                              st === 'cumplido' ? 100 : st === 'en_progreso' ? 50 : 0
                            );
                          }}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs"
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="en_progreso">En progreso</option>
                          <option value="cumplido">Cumplido</option>
                        </select>
                        <span className="font-mono-num text-xs font-bold text-blue-600 dark:text-cyan-400 w-10 text-right">
                          {c.progress}%
                        </span>
                        {isLeader && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditComp(c)}
                              title="Editar compromiso"
                              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCommitment(c)}
                              className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Acta de Escrutinio PDF */}
      {printableVote && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 overflow-y-auto flex justify-center print:static print:bg-white print:p-0 print:block">
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl p-8 space-y-5 shadow-2xl my-auto print:shadow-none print:max-w-none print:p-2">
            <div className="flex items-start justify-between border-b border-slate-300 pb-4">
              <div className="flex items-center gap-3">
                <BrandLogo size="md" />
                <div>
                  <p className="text-xs font-bold uppercase text-emerald-700">
                    Acta de Escrutinio Oficial · CMJ Flandes, Tolima
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold">{printableVote.title}</h2>
                  <p className="text-xs text-slate-600">
                    Modalidad: {MODE_LABELS[printableVote.voteMode || 'nominal']} · Regla:{' '}
                    {MAJORITY_LABELS[printableVote.majorityType || 'simple']} · Participantes:{' '}
                    {printableVote.voterUids.length}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Imprimir PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableVote(null)}
                  className="rounded-xl bg-slate-200 p-2 text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {printableVote.resultSummary && (
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-bold">
                Dictamen: {printableVote.resultSummary}
              </div>
            )}

            <table className="w-full text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">Opción</th>
                  <th className="border border-slate-300 p-2 text-right">Votos</th>
                  <th className="border border-slate-300 p-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {printableVote.options.map((opt) => {
                  const cnt = printableVote.tallies?.[opt] || 0;
                  const pct = printableVote.voterUids.length
                    ? Math.round((cnt / printableVote.voterUids.length) * 100)
                    : 0;
                  return (
                    <tr key={opt}>
                      <td className="border border-slate-300 p-2 font-semibold">{opt}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono-num">{cnt}</td>
                      <td className="border border-slate-300 p-2 text-right font-mono-num">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {printableVote.voteMode !== 'secreto' &&
              printableVote.nominalBallots &&
              Object.keys(printableVote.nominalBallots).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase mb-1.5">Voto Nominal Individual</h3>
                  <table className="w-full text-xs border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 p-2 text-left">Consejero(a)</th>
                        <th className="border border-slate-300 p-2 text-left">Cargo</th>
                        <th className="border border-slate-300 p-2 text-left">Decisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(printableVote.nominalBallots).map(([vUid, choice]) => {
                        const c = publicCouncilors.find((u) => u.uid === vUid);
                        return (
                          <tr key={vUid}>
                            <td className="border border-slate-300 p-2">{c?.fullName || 'Consejero'}</td>
                            <td className="border border-slate-300 p-2">{c?.roleLabel || 'Consejero'}</td>
                            <td className="border border-slate-300 p-2 font-semibold">{choice}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
