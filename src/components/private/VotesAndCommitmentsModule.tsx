import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Lock,
  Plus,
  Printer,
  Trash2,
  Unlock,
  Vote,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type {
  AccessTier,
  Commission,
  Commitment,
  CouncilVote,
  PublicCouncilor,
  RoleLabel,
  VoteMode,
} from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

export function VotesAndCommitmentsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  commissions,
  publicCouncilors,
  votes,
  commitments,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  votes: CouncilVote[];
  commitments: Commitment[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const activeCouncilors = publicCouncilors.filter((c) => c.active);

  // Nueva votación
  const [voteTitle, setVoteTitle] = useState('');
  const [voteDesc, setVoteDesc] = useState('');
  const [voteMode, setVoteMode] = useState<VoteMode>('nominal');
  const [optionsText, setOptionsText] = useState('Sí\nNo\nAbstención');
  const [quorumReq, setQuorumReq] = useState(() =>
    Math.max(1, Math.floor(activeCouncilors.length / 2) + 1)
  );
  const [closesAt, setClosesAt] = useState('');
  const [printableVote, setPrintableVote] = useState<CouncilVote | null>(null);

  // Editar votación
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);
  const [editVoteTitle, setEditVoteTitle] = useState('');
  const [editVoteDesc, setEditVoteDesc] = useState('');
  const [editVoteMode, setEditVoteMode] = useState<VoteMode>('nominal');
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

    const tallies: Record<string, number> = {};
    opts.forEach((o) => {
      tallies[o] = 0;
    });

    try {
      await apiRequest('/api/votes', {
        method: 'POST',
        body: {
          title: voteTitle.trim(),
          description: voteDesc.trim() || 'Votación oficial de plenaria CMJ Flandes',
          voteMode,
          options: opts,
          quorumRequired: Math.max(1, Number(quorumReq) || 1),
          deadline: closesAt,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Abrió votación oficial',
        module: 'Votaciones',
        targetTitle: voteTitle.trim(),
      });
      setVoteTitle('');
      setVoteDesc('');
      showToast('Votación abierta', 'success');
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
      showToast('Voto registrado correctamente', 'success');
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
      showToast(next === 'cerrada' ? 'Votación cerrada' : 'Votación reabierta', 'info');
    } catch {
      showToast('Error al actualizar votación', 'error');
    }
  };

  const startEditVote = (v: CouncilVote) => {
    setEditingVoteId(v.id);
    setEditVoteTitle(v.title);
    setEditVoteDesc(v.description || '');
    setEditVoteMode(v.voteMode || 'nominal');
    setEditVoteQuorum(v.quorumRequired || 1);
    setEditVoteDeadline(v.deadline || '');
    setEditVoteOptions(v.options.join('\n'));
  };

  const handleSaveVoteEdit = async (v: CouncilVote) => {
    if (!editVoteTitle.trim()) return;
    try {
      const payload: Record<string, unknown> = {
        title: editVoteTitle.trim(),
        description: editVoteDesc.trim(),
        quorumRequired: Math.max(1, Number(editVoteQuorum) || 1),
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

  return (
    <div className="space-y-8">
      {/* Votaciones */}
      <div className="space-y-5 no-print">
        {isLeader && (
          <form
            onSubmit={handleCreateVote}
            className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Vote className="h-5 w-5 text-blue-600" /> Votaciones de Plenaria
              </h2>
              <p className="text-xs text-slate-500">
                Configura votación nominal (voto visible) o secreta, quórum mínimo y opciones personalizadas.
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
                <option value="secreto">Votación Secreta</option>
              </select>
              <input
                type="date"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <textarea
                rows={3}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Una opción por línea (ej: Sí / No / Abstención)"
                className="sm:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
              <div className="sm:col-span-5 space-y-2">
                <input
                  type="text"
                  value={voteDesc}
                  onChange={(e) => setVoteDesc(e.target.value)}
                  placeholder="Contexto breve de la votación"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
                />
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Quórum mínimo requerido:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={quorumReq}
                    onChange={(e) => setQuorumReq(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs font-mono-num"
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
              return (
                <div
                  key={v.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        <span
                          className={`rounded-md px-2 py-0.5 ${
                            v.status === 'abierta'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                          }`}
                        >
                          {v.status === 'abierta' ? 'Abierta' : 'Cerrada'}
                        </span>
                        <span className="text-blue-600 dark:text-cyan-400 uppercase">
                          {v.voteMode === 'secreto' ? 'Voto Secreto' : 'Voto Nominal'}
                        </span>
                        <span className="text-slate-500 font-mono-num">
                          Quórum: {totalVotes}/{v.quorumRequired || 1}{' '}
                          {quorumMet ? '✓' : '(pendiente)'}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
                        {v.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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
                        <input
                          type="date"
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

                  <div className="space-y-2.5">
                    {v.options.map((opt) => {
                      const count = v.tallies?.[opt] || 0;
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                      return (
                        <div key={opt} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <button
                              type="button"
                              disabled={v.status !== 'abierta' || alreadyVoted}
                              onClick={() => handleCastVote(v, opt)}
                              className="font-semibold text-left text-slate-800 dark:text-slate-100 hover:text-blue-600 disabled:cursor-default cursor-pointer"
                            >
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
                            <div
                              className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </button>
                        </div>
                      );
                    })}
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

                  {v.voteMode !== 'secreto' &&
                    v.nominalBallots &&
                    Object.keys(v.nominalBallots).length > 0 && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                          Detalle nominal:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(v.nominalBallots).map(([voterId, choice]) => {
                            const name =
                              publicCouncilors.find((c) => c.uid === voterId)?.fullName || 'Consejero';
                            return (
                              <span
                                key={voterId}
                                className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px]"
                              >
                                <strong>{name}:</strong> {choice}
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

      {/* Modal Acta de Votación PDF */}
      {printableVote && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 overflow-y-auto flex justify-center print:static print:bg-white print:p-0 print:block">
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl p-8 space-y-5 shadow-2xl my-auto print:shadow-none print:max-w-none print:p-2">
            <div className="flex items-start justify-between border-b border-slate-300 pb-4">
              <div>
                <p className="text-xs font-bold uppercase text-blue-700">
                  Acta de Escrutinio · CMJ Flandes, Tolima
                </p>
                <h2 className="mt-1 text-xl font-extrabold">{printableVote.title}</h2>
                <p className="text-xs text-slate-600">
                  Modalidad: {printableVote.voteMode === 'secreto' ? 'Secreta' : 'Nominal'} · Participantes:{' '}
                  {printableVote.voterUids.length}
                </p>
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

            <table className="w-full text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-2 text-left">Opción</th>
                  <th className="border border-slate-300 p-2 text-right">Votos</th>
                </tr>
              </thead>
              <tbody>
                {printableVote.options.map((opt) => (
                  <tr key={opt}>
                    <td className="border border-slate-300 p-2 font-semibold">{opt}</td>
                    <td className="border border-slate-300 p-2 text-right font-mono-num">
                      {printableVote.tallies?.[opt] || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
