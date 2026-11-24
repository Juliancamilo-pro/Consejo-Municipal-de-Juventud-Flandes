import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileDown,
  FileSignature,
  FileText,
  History,
  MessageSquare,
  Plus,
  Printer,
  QrCode,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Vote,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type {
  AccessTier,
  ActaStatus,
  Commission,
  CouncilSession,
  CouncilVote,
  PortalActa,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { ConfettiBurst } from '../ui/AnimatedPrimitives';
import { recordAudit } from './auditHelper';

const STATUS_STEPS: { id: ActaStatus; label: string; badgeCls: string }[] = [
  { id: 'borrador', label: 'Borrador', badgeCls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { id: 'revision', label: 'En revisión', badgeCls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: 'aprobada', label: 'Aprobada', badgeCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { id: 'firmada', label: 'Firmada', badgeCls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-cyan-300' },
  { id: 'archivada', label: 'Archivada', badgeCls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
];

const ACTA_TEMPLATES: {
  id: string;
  label: string;
  titlePrefix: string;
  agenda: string;
  developmentIntro: string;
}[] = [
  {
    id: 'plenaria_ordinaria',
    label: 'Plenaria Ordinaria',
    titlePrefix: 'Sesión Plenaria Ordinaria CMJ Flandes',
    agenda:
      '1. Llamado a lista y verificación de quórum.\n2. Lectura y aprobación del orden del día.\n3. Lectura y aprobación del acta anterior.\n4. Informes de comisiones permanentes.\n5. Proposiciones, votaciones y varios.\n6. Cierre de la sesión.',
    developmentIntro:
      'En el municipio de Flandes, Tolima, siendo la hora señalada, se reunieron los consejeros y consejeras municipales de juventud en sesión plenaria ordinaria conforme a la Ley Estatutaria 1622 de 2013 y la Ley 1885 de 2018.',
  },
  {
    id: 'extraordinaria',
    label: 'Sesión Extraordinaria',
    titlePrefix: 'Sesión Plenaria Extraordinaria CMJ Flandes',
    agenda:
      '1. Verificación de quórum.\n2. Lectura del decreto o convocatoria extraordinaria.\n3. Punto único de deliberación y votación.\n4. Asignación de compromisos y cierre.',
    developmentIntro:
      'Previa convocatoria formal de la Mesa Directiva del Consejo Municipal de Juventudes de Flandes, Tolima, se instaló sesión extraordinaria para atender los asuntos urgentes del orden del día.',
  },
  {
    id: 'comision',
    label: 'Sesión de Comisión',
    titlePrefix: 'Mesa de Trabajo de Comisión CMJ',
    agenda:
      '1. Verificación de integrantes de la comisión.\n2. Seguimiento al plan de trabajo y tareas asignadas.\n3. Formulación de propuestas e iniciativas territoriales.\n4. Compromisos y fecha de próxima mesa.',
    developmentIntro:
      'Los integrantes de la comisión permanente del CMJ Flandes se reunieron con el propósito de avanzar en las metas estratégicas de su eje temático juvenil.',
  },
];

function ActaQrSvg({ code }: { code: string }) {
  const cells = useMemo(() => {
    const size = 11;
    const grid: boolean[] = [];
    let seed = 13;
    for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i) * (i + 5);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const corner =
          (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
        const val = corner || ((seed + r * 19 + c * 29 + r * c) % 3 !== 0);
        grid.push(val);
      }
    }
    return grid;
  }, [code]);

  return (
    <svg
      viewBox="0 0 110 110"
      className="h-20 w-20 rounded-xl bg-white p-1.5 border border-slate-300 shrink-0"
      aria-label={`Sello QR de verificación ${code}`}
    >
      {cells.map((filled, idx) => {
        if (!filled) return null;
        const r = Math.floor(idx / 11);
        const c = idx % 11;
        return <rect key={idx} x={c * 10 + 1} y={r * 10 + 1} width="8" height="8" rx="1.2" fill="#0f172a" />;
      })}
    </svg>
  );
}

export function ActasModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  actas,
  sessions,
  votes,
  commissions,
  publicCouncilors,
  preselectedSessionId,
  onClearPreselectedSession,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  actas: PortalActa[];
  sessions: CouncilSession[];
  votes: CouncilVote[];
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  preselectedSessionId?: string | null;
  onClearPreselectedSession?: () => void;
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);

  const [selectedActaId, setSelectedActaId] = useState<string>(actas[0]?.id || '');
  const [searchText, setSearchText] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [commissionFilter, setCommissionFilter] = useState<string>('todas');
  const [confettiKey, setConfettiKey] = useState(0);

  // Creación rápida de nueva acta
  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState('plenaria_ordinaria');
  const [newTitle, setNewTitle] = useState('');
  const [newSessionId, setNewSessionId] = useState('');
  const [newCommissionId, setNewCommissionId] = useState('');
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newLocation, setNewLocation] = useState('Recinto CMJ Flandes, Tolima');
  const [creating, setCreating] = useState(false);

  // Editor de acta seleccionada
  const selectedActa = useMemo(
    () => actas.find((a) => a.id === selectedActaId) || actas[0] || null,
    [actas, selectedActaId]
  );

  const [editTitle, setEditTitle] = useState('');
  const [editConsecutive, setEditConsecutive] = useState('');
  const [editSessionId, setEditSessionId] = useState('');
  const [editCommissionId, setEditCommissionId] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMeetingDate, setEditMeetingDate] = useState('');
  const [editTimeRange, setEditTimeRange] = useState('');
  const [editQuorumCount, setEditQuorumCount] = useState(0);
  const [editQuorumRequired, setEditQuorumRequired] = useState(1);
  const [editAgenda, setEditAgenda] = useState('');
  const [editDevelopment, setEditDevelopment] = useState('');
  const [editPropositions, setEditPropositions] = useState('');
  const [editCommitmentsSummary, setEditCommitmentsSummary] = useState('');
  const [editLinkedVoteIds, setEditLinkedVoteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // IA Asistente
  const [aiNotes, setAiNotes] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  // Observaciones / Comentarios
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (preselectedSessionId) {
      const sess = sessions.find((s) => s.id === preselectedSessionId);
      const existingActa = actas.find((a) => a.sessionId === preselectedSessionId);
      if (existingActa) {
        setSelectedActaId(existingActa.id);
      } else if (sess) {
        setCreatingOpen(true);
        setNewSessionId(sess.id);
        setNewTitle(`Acta de ${sess.title}`);
        setNewDate(sess.dateIso);
        setNewLocation(sess.location);
      }
      onClearPreselectedSession?.();
    }
  }, [preselectedSessionId, sessions, actas, onClearPreselectedSession]);

  useEffect(() => {
    if (!selectedActa) return;
    setEditTitle(selectedActa.title);
    setEditConsecutive(selectedActa.consecutive);
    setEditSessionId(selectedActa.sessionId || '');
    setEditCommissionId(selectedActa.commissionId || '');
    setEditLocation(selectedActa.location || '');
    setEditMeetingDate(selectedActa.meetingDate || '');
    setEditTimeRange(selectedActa.timeRange || '');
    setEditQuorumCount(selectedActa.quorumCount || 0);
    setEditQuorumRequired(selectedActa.quorumRequired || 1);
    setEditAgenda(selectedActa.agenda || '');
    setEditDevelopment(selectedActa.development || '');
    setEditPropositions(selectedActa.propositions || '');
    setEditCommitmentsSummary(selectedActa.commitmentsSummary || '');
    setEditLinkedVoteIds(selectedActa.linkedVoteIds || []);
  }, [selectedActa?.id, selectedActa?.updatedAt]);

  const yearsAvailable = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    actas.forEach((a) => {
      if (a.year) set.add(a.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [actas]);

  const filteredActas = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return actas.filter((a) => {
      if (yearFilter !== 'todos' && String(a.year) !== yearFilter) return false;
      if (statusFilter !== 'todos' && a.status !== statusFilter) return false;
      if (commissionFilter !== 'todas' && (a.commissionId || '') !== commissionFilter) return false;
      if (!q) return true;
      return (
        a.consecutive.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.agenda.toLowerCase().includes(q) ||
        a.development.toLowerCase().includes(q) ||
        a.propositions.toLowerCase().includes(q) ||
        a.commitmentsSummary.toLowerCase().includes(q)
      );
    });
  }, [actas, searchText, yearFilter, statusFilter, commissionFilter]);

  const linkedSession = useMemo(
    () => sessions.find((s) => s.id === (editSessionId || selectedActa?.sessionId)) || null,
    [sessions, editSessionId, selectedActa?.sessionId]
  );

  const attendanceList = useMemo(() => {
    if (!linkedSession) return [];
    return publicCouncilors
      .slice()
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99))
      .map((c) => ({
        councilor: c,
        status: linkedSession.attendance?.[c.uid] || 'sin_marcar',
      }));
  }, [linkedSession, publicCouncilors]);

  const handleApplySessionData = (sid: string) => {
    setEditSessionId(sid);
    const sess = sessions.find((s) => s.id === sid);
    if (!sess) return;
    const present = Object.values(sess.attendance || {}).filter(
      (st) => st === 'presente' || st === 'tarde'
    ).length;
    setEditLocation(sess.location || editLocation);
    setEditMeetingDate(sess.dateIso || editMeetingDate);
    setEditTimeRange(sess.timeRange || editTimeRange);
    setEditQuorumCount(present);
    setEditQuorumRequired(sess.quorumRequired || 1);
    if (sess.agenda && !editAgenda.trim()) {
      setEditAgenda(sess.agenda);
    }
    const matchingVotes = votes.filter((v) => v.sessionId === sid).map((v) => v.id);
    if (matchingVotes.length > 0) {
      setEditLinkedVoteIds((prev) => Array.from(new Set([...prev, ...matchingVotes])));
    }
    showToast('Datos de sesión sincronizados en el acta', 'info');
  };

  const handleCreateActa = async (e: React.FormEvent) => {
    e.preventDefault();
    const tpl = ACTA_TEMPLATES.find((t) => t.id === newTemplateId) || ACTA_TEMPLATES[0];
    const resolvedTitle = newTitle.trim() || `${tpl.titlePrefix} · ${newDate}`;
    setCreating(true);
    try {
      const sess = sessions.find((s) => s.id === newSessionId);
      const res = await apiRequest<{ id: string; consecutive: string }>('/api/actas', {
        method: 'POST',
        body: {
          title: resolvedTitle,
          year: Number(newYear) || new Date().getFullYear(),
          sessionId: newSessionId,
          commissionId: newCommissionId,
          location: sess?.location || newLocation.trim() || 'Recinto CMJ Flandes',
          meetingDate: sess?.dateIso || newDate,
          timeRange: sess?.timeRange || '',
          agenda: sess?.agenda || tpl.agenda,
          development: tpl.developmentIntro,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Creó ${res.consecutive}`,
        module: 'Actas Oficiales',
        targetTitle: resolvedTitle,
      });
      setSelectedActaId(res.id);
      setCreatingOpen(false);
      setNewTitle('');
      showToast(`${res.consecutive} creada como borrador`, 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo crear el acta';
      showToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveActa = async (nextStatus?: ActaStatus) => {
    if (!selectedActa) return;
    setSaving(true);
    try {
      await apiRequest(`/api/actas/${encodeURIComponent(selectedActa.id)}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim() || selectedActa.title,
          consecutive: editConsecutive.trim() || selectedActa.consecutive,
          sessionId: editSessionId,
          commissionId: editCommissionId,
          location: editLocation.trim(),
          meetingDate: editMeetingDate.trim(),
          timeRange: editTimeRange.trim(),
          quorumCount: Number(editQuorumCount) || 0,
          quorumRequired: Math.max(1, Number(editQuorumRequired) || 1),
          agenda: editAgenda,
          development: editDevelopment,
          propositions: editPropositions,
          commitmentsSummary: editCommitmentsSummary,
          linkedVoteIds: editLinkedVoteIds,
          ...(nextStatus ? { status: nextStatus } : {}),
        },
      });
      if (nextStatus === 'aprobada' || nextStatus === 'firmada') {
        setConfettiKey((k) => k + 1);
      }
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: nextStatus ? `Pasó acta a estado ${nextStatus}` : 'Guardó edición de acta',
        module: 'Actas Oficiales',
        targetTitle: `${editConsecutive} — ${editTitle}`,
      });
      showToast(
        nextStatus ? `Acta actualizada a ${nextStatus}` : 'Cambios guardados en el acta',
        'success'
      );
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo guardar el acta';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAiDraft = async () => {
    if (!selectedActa) return;
    setGeneratingAi(true);
    try {
      const res = await apiRequest<{
        ok: boolean;
        development: string;
        propositions: string;
        commitmentsSummary: string;
      }>(`/api/actas/${encodeURIComponent(selectedActa.id)}/ai-draft`, {
        method: 'POST',
        body: {
          sessionId: editSessionId,
          linkedVoteIds: editLinkedVoteIds,
          notes: aiNotes,
        },
      });
      if (res.development) setEditDevelopment(res.development);
      if (res.propositions) setEditPropositions(res.propositions);
      if (res.commitmentsSummary) setEditCommitmentsSummary(res.commitmentsSummary);
      showToast('Borrador generado con IA', 'success', 'Revisa y ajusta los detalles antes de aprobar.');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudo generar el borrador con IA';
      showToast(msg, 'error');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSignActa = async () => {
    if (!selectedActa) return;
    setSigning(true);
    try {
      await apiRequest(`/api/actas/${encodeURIComponent(selectedActa.id)}/sign`, {
        method: 'POST',
      });
      setConfettiKey((k) => k + 1);
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Firmó digitalmente acta oficial',
        module: 'Actas Oficiales',
        targetTitle: selectedActa.consecutive,
      });
      showToast('Firma digital estampada correctamente', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo firmar el acta';
      showToast(msg, 'error');
    } finally {
      setSigning(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActa || !commentText.trim()) return;
    setSendingComment(true);
    try {
      await apiRequest(`/api/actas/${encodeURIComponent(selectedActa.id)}/comment`, {
        method: 'POST',
        body: { body: commentText.trim() },
      });
      setCommentText('');
      showToast('Observación agregada al acta', 'success');
    } catch {
      showToast('No se pudo publicar la observación', 'error');
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteActa = async (acta: PortalActa) => {
    try {
      await apiRequest(`/api/actas/${encodeURIComponent(acta.id)}`, { method: 'DELETE' });
      if (selectedActa?.id === acta.id) setSelectedActaId('');
      showToast('Acta eliminada', 'info');
    } catch {
      showToast('Sin permisos para eliminar el acta', 'error');
    }
  };

  const handleExportWord = () => {
    if (!selectedActa) return;
    const esc = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');

    const attHtml =
      attendanceList.length > 0
        ? `<h3>Registro de Asistencia</h3><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px;"><tr><th>Consejero</th><th>Cargo</th><th>Estado</th></tr>${attendanceList
            .map(
              (row) =>
                `<tr><td>${esc(row.councilor.fullName)}</td><td>${esc(row.councilor.roleLabel)}</td><td>${esc(row.status)}</td></tr>`
            )
            .join('')}</table>`
        : '';

    const sigsHtml =
      selectedActa.signatures.length > 0
        ? `<h3>Firmas Digitales</h3><ul>${selectedActa.signatures
            .map(
              (s) =>
                `<li><strong>${esc(s.name)}</strong> (${esc(s.roleLabel)}) — Sello ${esc(s.hash)} · ${new Date(s.signedAt).toLocaleString('es-CO')}</li>`
            )
            .join('')}</ul>`
        : '';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(editConsecutive)}</title><style>body{font-family:Calibri,Arial,sans-serif;margin:2.5cm;color:#0f172a;line-height:1.5;}h1,h2,h3{color:#065f46;} .meta{border:1px solid #cbd5e1;padding:10px;background:#f8fafc;margin-bottom:16px;font-size:12px;}</style></head><body><h1>CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES, TOLIMA</h1><p><em>Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018</em></p><hr/><h2>${esc(editConsecutive)} — ${esc(editTitle)}</h2><div class="meta"><strong>Fecha:</strong> ${esc(editMeetingDate)} ${esc(editTimeRange)}<br/><strong>Lugar:</strong> ${esc(editLocation)}<br/><strong>Quórum:</strong> ${editQuorumCount} asistentes (requerido: ${editQuorumRequired})<br/><strong>Estado:</strong> ${esc(selectedActa.status.toUpperCase())}${selectedActa.verificationHash ? `<br/><strong>Código de verificación:</strong> ${esc(selectedActa.verificationHash)}` : ''}</div><h3>1. Orden del Día</h3><p>${esc(editAgenda)}</p><h3>2. Desarrollo de la Sesión</h3><p>${esc(editDevelopment)}</p><h3>3. Proposiciones y Decisiones</h3><p>${esc(editPropositions)}</p><h3>4. Compromisos y Responsables</h3><p>${esc(editCommitmentsSummary)}</p>${attHtml}${sigsHtml}</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${editConsecutive.replace(/[^a-zA-Z0-9_-]/g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const canEditSelected = Boolean(selectedActa && (isLeader || selectedActa.authorUid === uid));
  const alreadySignedByMe = Boolean(selectedActa?.signatures.some((s) => s.uid === uid));

  return (
    <div className="space-y-6">
      <ConfettiBurst key={confettiKey} active={confettiKey > 0} />

      {/* Encabezado y Creación Rápida */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              Actas Oficiales, Aprobación y Firma Digital
            </h2>
            <p className="text-xs text-slate-500">
              Redacción estructurada con consecutivo automático, asistente IA institucional, firma digital y archivo histórico.
            </p>
          </div>
          {isLeader && (
            <button
              type="button"
              onClick={() => setCreatingOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {creatingOpen ? 'Cerrar formulario' : 'Nueva acta oficial'}
            </button>
          )}
        </div>

        {creatingOpen && isLeader && (
          <form
            onSubmit={handleCreateActa}
            className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-slate-950 p-5 space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Crear acta con consecutivo automático ({newYear})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                value={newTemplateId}
                onChange={(e) => setNewTemplateId(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              >
                {ACTA_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    Plantilla: {t.label}
                  </option>
                ))}
              </select>
              <select
                value={newSessionId}
                onChange={(e) => {
                  const sid = e.target.value;
                  setNewSessionId(sid);
                  const sess = sessions.find((s) => s.id === sid);
                  if (sess) {
                    setNewTitle(`Acta — ${sess.title}`);
                    setNewDate(sess.dateIso);
                    setNewLocation(sess.location);
                  }
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="">Vincular sesión (opcional)</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.dateIso} · {s.title}
                  </option>
                ))}
              </select>
              <select
                value={newCommissionId}
                onChange={(e) => setNewCommissionId(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="">Plenaria General CMJ</option>
                {commissions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
                min={2020}
                max={2040}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Título del acta (ej: Plenaria Ordinaria de Mayo)"
                className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs"
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="Lugar de reunión"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
            >
              {creating ? 'Creando...' : 'Crear borrador de acta'}
            </button>
          </form>
        )}

        {/* Filtros de archivo histórico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar texto o consecutivo..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 text-xs"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="todos">Todos los años</option>
            {yearsAvailable.map((y) => (
              <option key={y} value={String(y)}>
                Vigencia {y}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="todos">Todos los estados</option>
            {STATUS_STEPS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
          <select
            value={commissionFilter}
            onChange={(e) => setCommissionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="todas">Todas las comisiones</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Actas */}
        <div className="lg:col-span-4 space-y-2.5 no-print">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Archivo de Actas ({filteredActas.length})
          </p>
          {filteredActas.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
              No hay actas registradas que coincidan con el filtro.
            </div>
          ) : (
            filteredActas.map((a) => {
              const stMeta = STATUS_STEPS.find((s) => s.id === a.status) || STATUS_STEPS[0];
              const isSelected = selectedActa?.id === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedActaId(a.id)}
                  className={`rounded-2xl border p-4 cursor-pointer transition-colors space-y-2 ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/25'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      {a.consecutive}
                    </span>
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${stMeta.badgeCls}`}>
                      {stMeta.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {a.title}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{a.meetingDate || 'Sin fecha'}</span>
                    <span>
                      {a.signatures.length} firma{a.signatures.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Editor y Vista Oficial Imprimible */}
        <div className="lg:col-span-8 space-y-5">
          {!selectedActa ? (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center space-y-2 no-print">
              <FileText className="h-8 w-8 mx-auto text-slate-400" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Selecciona o crea un acta para comenzar
              </p>
              <p className="text-xs text-slate-500">
                Podrás vincular la asistencia de una sesión, generar borrador asistido por IA y firmar digitalmente.
              </p>
            </div>
          ) : (
            <>
              {/* Barra de Flujo de Estados y Acciones */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 no-print">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUS_STEPS.map((st, idx) => {
                      const activeIdx = STATUS_STEPS.findIndex((s) => s.id === selectedActa.status);
                      const passed = idx <= activeIdx;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          disabled={!isLeader || saving}
                          onClick={() => handleSaveActa(st.id)}
                          title={isLeader ? `Cambiar estado a ${st.label}` : st.label}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                            selectedActa.status === st.id
                              ? 'bg-emerald-700 text-white'
                              : passed
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                          } ${isLeader ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                        >
                          {idx + 1}. {st.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleExportWord}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <FileDown className="h-3.5 w-3.5" /> Word (.doc)
                    </button>
                    {isLeader && (
                      <button
                        type="button"
                        disabled={signing || alreadySignedByMe}
                        onClick={handleSignActa}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        <FileSignature className="h-3.5 w-3.5" />
                        {alreadySignedByMe ? 'Ya firmada por ti' : signing ? 'Firmando...' : 'Firmar acta'}
                      </button>
                    )}
                    {isLeader && (
                      <button
                        type="button"
                        onClick={() => handleDeleteActa(selectedActa)}
                        title="Eliminar acta"
                        className="rounded-xl p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Asistente IA Institucional */}
                {canEditSelected && (
                  <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" /> Asistente de Redacción Institucional
                      </p>
                      <button
                        type="button"
                        disabled={generatingAi}
                        onClick={handleAiDraft}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {generatingAi ? 'Redactando borrador...' : 'Redactar borrador con IA'}
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                      placeholder="Notas breves de secretaría (puntos debatidos, acuerdos clave o intervenciones que quieras incluir en el borrador)..."
                      className="w-full rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                  </div>
                )}

                {/* Formulario guiado */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Consecutivo oficial
                      </label>
                      <input
                        type="text"
                        disabled={!canEditSelected}
                        value={editConsecutive}
                        onChange={(e) => setEditConsecutive(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono-num"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Título del acta
                      </label>
                      <input
                        type="text"
                        disabled={!canEditSelected}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <select
                      disabled={!canEditSelected}
                      value={editSessionId}
                      onChange={(e) => handleApplySessionData(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    >
                      <option value="">Sin sesión vinculada</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.dateIso} · {s.title}
                        </option>
                      ))}
                    </select>
                    <select
                      disabled={!canEditSelected}
                      value={editCommissionId}
                      onChange={(e) => setEditCommissionId(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    >
                      <option value="">Plenaria General</option>
                      {commissions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      disabled={!canEditSelected}
                      value={editMeetingDate}
                      onChange={(e) => setEditMeetingDate(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      disabled={!canEditSelected}
                      value={editTimeRange}
                      onChange={(e) => setEditTimeRange(e.target.value)}
                      placeholder="Horario (ej: 14:00 - 16:30)"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      disabled={!canEditSelected}
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Lugar de realización"
                      className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>Asistentes:</span>
                      <input
                        type="number"
                        min={0}
                        disabled={!canEditSelected}
                        value={editQuorumCount}
                        onChange={(e) => setEditQuorumCount(Number(e.target.value))}
                        className="w-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span>Quórum req:</span>
                      <input
                        type="number"
                        min={1}
                        disabled={!canEditSelected}
                        value={editQuorumRequired}
                        onChange={(e) => setEditQuorumRequired(Number(e.target.value))}
                        className="w-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      1. Orden del Día
                    </label>
                    <textarea
                      rows={4}
                      disabled={!canEditSelected}
                      value={editAgenda}
                      onChange={(e) => setEditAgenda(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      2. Desarrollo de la Sesión
                    </label>
                    <textarea
                      rows={6}
                      disabled={!canEditSelected}
                      value={editDevelopment}
                      onChange={(e) => setEditDevelopment(e.target.value)}
                      placeholder="Relato formal de intervenciones, verificación de quórum e informes..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      3. Proposiciones y Decisiones
                    </label>
                    <textarea
                      rows={4}
                      disabled={!canEditSelected}
                      value={editPropositions}
                      onChange={(e) => setEditPropositions(e.target.value)}
                      placeholder="Acuerdos aprobados, mociones y decisiones adoptadas..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      4. Resumen de Compromisos Acordados
                    </label>
                    <textarea
                      rows={3}
                      disabled={!canEditSelected}
                      value={editCommitmentsSummary}
                      onChange={(e) => setEditCommitmentsSummary(e.target.value)}
                      placeholder="Listado de compromisos, responsables y plazos..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs leading-relaxed"
                    />
                  </div>

                  {/* Votaciones vinculadas */}
                  {votes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                        <Vote className="h-3.5 w-3.5" /> Vincular resultados de votaciones al acta
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {votes.map((v) => {
                          const checked = editLinkedVoteIds.includes(v.id);
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={!canEditSelected}
                              onClick={() =>
                                setEditLinkedVoteIds((prev) =>
                                  prev.includes(v.id)
                                    ? prev.filter((x) => x !== v.id)
                                    : [...prev, v.id]
                                )
                              }
                              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                                checked
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {v.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {canEditSelected && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      {selectedActa.status === 'borrador' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveActa('revision')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 cursor-pointer"
                        >
                          <Clock className="h-3.5 w-3.5" /> Enviar a revisión
                        </button>
                      )}
                      {isLeader && (selectedActa.status === 'borrador' || selectedActa.status === 'revision') && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveActa('aprobada')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar acta
                        </button>
                      )}
                      {isLeader && selectedActa.status === 'firmada' && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveActa('archivada')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          <Archive className="h-3.5 w-3.5" /> Archivar definitivamente
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveActa()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-60"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {saving ? 'Guardando...' : 'Guardar borrador'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Documento Oficial Previsualizable / Imprimible */}
              <div className="rounded-3xl border border-slate-200 bg-white text-slate-900 p-6 sm:p-10 space-y-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-emerald-700 pb-4">
                  <div className="flex items-center gap-3">
                    <BrandLogo size="md" />
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                        Consejo Municipal de Juventudes de Flandes, Tolima
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018 · Documento Institucional
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-num text-sm font-extrabold text-slate-900">
                      {editConsecutive}
                    </p>
                    <p className="text-[11px] uppercase font-bold text-emerald-700">
                      Estado: {selectedActa.status}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900">{editTitle}</h3>
                  <p className="text-xs text-slate-600">
                    Fecha: <strong>{editMeetingDate || 'Por definir'}</strong>{' '}
                    {editTimeRange ? `(${editTimeRange})` : ''} · Lugar: <strong>{editLocation}</strong> ·
                    Quórum: <strong>{editQuorumCount}/{editQuorumRequired}</strong>
                  </p>
                </div>

                {attendanceList.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                      Verificación de Asistencia
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {attendanceList.map(({ councilor, status }) => (
                        <div
                          key={councilor.uid}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarBadge
                              name={councilor.fullName}
                              photoUrl={councilor.photoUrl}
                              thumbUrl={councilor.photoThumbUrl}
                              size="xs"
                            />
                            <div className="min-w-0">
                              <p className="font-bold truncate">{councilor.fullName}</p>
                              <p className="text-[10px] text-slate-500">{councilor.roleLabel}</p>
                            </div>
                          </div>
                          <span className="font-semibold uppercase text-[10px] text-slate-700">
                            {status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4 text-xs leading-relaxed">
                  <div>
                    <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
                      1. Orden del Día
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-800">{editAgenda || 'Sin registrar.'}</p>
                  </div>
                  <div>
                    <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
                      2. Desarrollo
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-800">{editDevelopment || 'Sin registrar.'}</p>
                  </div>
                  <div>
                    <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
                      3. Proposiciones y Decisiones
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-800">{editPropositions || 'Sin registrar.'}</p>
                  </div>
                  <div>
                    <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
                      4. Compromisos
                    </h4>
                    <p className="whitespace-pre-wrap text-slate-800">
                      {editCommitmentsSummary || 'Sin registrar.'}
                    </p>
                  </div>
                </div>

                {editLinkedVoteIds.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                      Resultados de Votaciones Vinculadas
                    </h4>
                    <div className="space-y-1.5">
                      {votes
                        .filter((v) => editLinkedVoteIds.includes(v.id))
                        .map((v) => (
                          <div
                            key={v.id}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs flex items-center justify-between gap-2"
                          >
                            <span className="font-bold">{v.title}</span>
                            <span className="text-slate-600">{v.resultSummary || 'En curso'}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Firmas y Código de Verificación */}
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Firmas Digitales y Verificación
                    </p>
                    {selectedActa.signatures.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Pendiente de firma digital por Presidencia / Secretaría.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedActa.signatures.map((sig) => (
                          <div
                            key={sig.uid}
                            className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-[11px]"
                          >
                            <p className="font-bold text-slate-900">{sig.name}</p>
                            <p className="text-emerald-800 font-semibold">{sig.roleLabel}</p>
                            <p className="font-mono-num text-[10px] text-slate-600 mt-0.5">
                              Sello: {sig.hash} · {new Date(sig.signedAt).toLocaleDateString('es-CO')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedActa.verificationHash && (
                      <p className="font-mono-num text-[10px] text-slate-600">
                        Hash de integridad documental: <strong>{selectedActa.verificationHash}</strong>
                      </p>
                    )}
                  </div>

                  {selectedActa.verificationHash && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <ActaQrSvg code={`${selectedActa.consecutive}:${selectedActa.verificationHash}`} />
                      <span className="text-[9px] font-mono-num text-slate-500 flex items-center gap-1">
                        <QrCode className="h-3 w-3" /> {selectedActa.verificationHash.slice(0, 10)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Observaciones e Historial (solo vista privada) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 no-print">
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-blue-600" /> Observaciones de Consejeros (
                    {selectedActa.comments.length})
                  </h4>
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Sugerir ajuste o dejar constancia..."
                      className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={sendingComment}
                      aria-label="Enviar observación"
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {selectedActa.comments.length === 0 ? (
                      <p className="text-xs text-slate-500">Sin observaciones registradas.</p>
                    ) : (
                      selectedActa.comments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 text-xs"
                        >
                          <p className="font-bold text-slate-900 dark:text-white">
                            {c.authorName}{' '}
                            <span className="font-normal text-blue-600 dark:text-cyan-400">
                              ({c.authorRoleLabel})
                            </span>
                          </p>
                          <p className="text-slate-600 dark:text-slate-300 mt-0.5">{c.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                  <h4 className="text-sm font-bold flex items-center gap-1.5">
                    <History className="h-4 w-4 text-emerald-600" /> Trazabilidad de Cambios (
                    {selectedActa.history.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedActa.history.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{h.action}</p>
                          <p className="text-[11px] text-slate-500">Por {h.actorName}</p>
                        </div>
                        <span className="font-mono-num text-[10px] text-slate-400 shrink-0">
                          {new Date(h.at).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default ActasModule;
