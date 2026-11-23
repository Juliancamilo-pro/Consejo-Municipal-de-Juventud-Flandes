import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  Plus,
  Printer,
  QrCode,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type {
  AccessTier,
  AttendanceStatus,
  CouncilSession,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

function generateSessionCode(): string {
  return `CMJ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function DeterministicQrSvg({ code }: { code: string }) {
  const cells = useMemo(() => {
    const size = 9;
    const grid: boolean[] = [];
    let seed = 0;
    for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i) * (i + 7);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const corner =
          (r < 2 && c < 2) || (r < 2 && c >= size - 2) || (r >= size - 2 && c < 2);
        const val = corner || ((seed + r * 13 + c * 29 + r * c) % 3 !== 0);
        grid.push(val);
      }
    }
    return grid;
  }, [code]);

  return (
    <svg
      viewBox="0 0 90 90"
      className="h-24 w-24 rounded-xl bg-white p-2 border border-slate-200"
      aria-label={`Código QR visual ${code}`}
    >
      {cells.map((filled, idx) => {
        if (!filled) return null;
        const r = Math.floor(idx / 9);
        const c = idx % 9;
        return <rect key={idx} x={c * 10 + 1} y={r * 10 + 1} width="8" height="8" rx="1.5" fill="#0f172a" />;
      })}
    </svg>
  );
}

const ATT_LABELS: Record<AttendanceStatus, { label: string; cls: string }> = {
  presente: {
    label: 'Presente',
    cls: 'bg-emerald-600 text-white border-emerald-600',
  },
  tarde: {
    label: 'Tarde',
    cls: 'bg-amber-500 text-white border-amber-500',
  },
  excusa: {
    label: 'Excusa',
    cls: 'bg-blue-600 text-white border-blue-600',
  },
  ausente: {
    label: 'Ausente',
    cls: 'bg-rose-600 text-white border-rose-600',
  },
};

export function SessionsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  sessions,
  publicCouncilors,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  sessions: CouncilSession[];
  publicCouncilors: PublicCouncilor[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const activeCouncilors = useMemo(
    () => publicCouncilors.filter((c) => c.active),
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

  // Edición de sesión seleccionada
  const [editingSession, setEditingSession] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('Ordinaria');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editQuorum, setEditQuorum] = useState(1);
  const [editAgenda, setEditAgenda] = useState('');

  const defaultQuorum = Math.max(1, Math.floor(activeCouncilors.length / 2) + 1);

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
      showToast('Sesión convocada', 'success', `Código de asistencia: ${code}`);
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

  const councilorStats = useMemo(() => {
    return activeCouncilors.map((c) => {
      const recorded = sessions.filter((s) => s.attendance && c.uid in s.attendance);
      const attended = recorded.filter(
        (s) => s.attendance?.[c.uid] === 'presente' || s.attendance?.[c.uid] === 'tarde'
      ).length;
      const pct = recorded.length ? Math.round((attended / recorded.length) * 100) : 0;
      return { councilor: c, recordedCount: recorded.length, attended, pct };
    });
  }, [activeCouncilors, sessions]);

  const currentPresentCount = selectedSession
    ? Object.values(selectedSession.attendance || {}).filter(
        (v) => v === 'presente' || v === 'tarde'
      ).length
    : 0;
  const requiredQuorum = selectedSession?.quorumRequired || defaultQuorum;
  const hasQuorum = currentPresentCount >= requiredQuorum;

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
                Convocar Sesión y Control de Quórum
              </h2>
              <p className="text-xs text-slate-500">
                Crea sesiones ordinarias o extraordinarias, registra asistencia en 1 clic e imprime el acta oficial.
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
            sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                  selectedSession?.id === s.id
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                  <span className="text-blue-600 dark:text-cyan-400">{s.sessionType}</span>
                  <span className="font-mono-num text-slate-500">{s.dateIso}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                  {s.title}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 truncate">{s.location}</p>
              </button>
            ))
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
                  <button
                    type="button"
                    onClick={() => setShowPrintableActa(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Acta PDF
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

              {/* Quórum y Código QR */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
                <div className="md:col-span-7 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <ShieldCheck
                      className={`h-4 w-4 ${hasQuorum ? 'text-emerald-600' : 'text-amber-500'}`}
                    />
                    <span className={hasQuorum ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                      {hasQuorum ? 'Quórum deliberatorio alcanzado' : 'Quórum pendiente'} ({currentPresentCount}/{requiredQuorum})
                    </span>
                  </div>
                  {selectedSession.agenda && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedSession.agenda}
                    </p>
                  )}

                  {selectedSession.status !== 'finalizada' && selectedSession.checkInCode && (
                    <form onSubmit={handleSelfCheckIn} className="pt-2 flex gap-2">
                      <input
                        type="text"
                        value={selfCodeInput}
                        onChange={(e) => setSelfCodeInput(e.target.value)}
                        placeholder={`Código rápido (${selectedSession.checkInCode})`}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs uppercase font-mono-num"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Registrar mi asistencia
                      </button>
                    </form>
                  )}
                </div>

                {selectedSession.checkInCode && (
                  <div className="md:col-span-5 flex items-center gap-3 justify-start md:justify-end">
                    <DeterministicQrSvg code={selectedSession.checkInCode} />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        <QrCode className="h-3.5 w-3.5 text-blue-600" /> Código sesión
                      </p>
                      <p className="mt-1 font-mono-num text-base font-extrabold text-blue-600 dark:text-cyan-400">
                        {selectedSession.checkInCode}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista 1-clic de asistencia */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Llamado a Lista ({activeCouncilors.length} consejeros activos)
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeCouncilors.map((c) => {
                    const current = selectedSession.attendance?.[c.uid];
                    return (
                      <div
                        key={c.uid}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {c.fullName}
                          </p>
                          <p className="text-[11px] text-slate-500">{c.roleLabel}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(['presente', 'tarde', 'excusa', 'ausente'] as AttendanceStatus[]).map(
                            (st) => {
                              const active = current === st;
                              const disabled = !isLeader;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  disabled={disabled || selectedSession.status === 'finalizada'}
                                  onClick={() => handleSetAttendance(selectedSession, c.uid, st)}
                                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-45 ${
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Consolidado de % asistencia por consejero */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3 no-print">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-blue-600" />
          Porcentaje de Asistencia por Consejero
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {councilorStats.map(({ councilor, recordedCount, attended, pct }) => (
            <div
              key={councilor.uid}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {councilor.fullName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {attended}/{recordedCount} sesiones registradas
                </p>
              </div>
              <span
                className={`font-mono-num text-sm font-extrabold ${
                  pct >= 80
                    ? 'text-emerald-600'
                    : pct >= 50
                    ? 'text-amber-600'
                    : 'text-slate-500'
                }`}
              >
                {pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Vista imprimible Acta PDF */}
      {showPrintableActa && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 p-4 overflow-y-auto flex justify-center print:static print:bg-white print:p-0 print:block">
          <div className="w-full max-w-3xl bg-white text-slate-900 rounded-2xl p-8 space-y-5 shadow-2xl my-auto print:shadow-none print:max-w-none print:p-2">
            <div className="flex items-start justify-between border-b border-slate-300 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Consejo Municipal de Juventudes de Flandes · Tolima
                </p>
                <h2 className="mt-1 text-xl font-extrabold">{selectedSession.title}</h2>
                <p className="text-xs text-slate-600">
                  Tipo: {selectedSession.sessionType} · Fecha: {selectedSession.dateIso} ·{' '}
                  {selectedSession.timeRange} · Lugar: {selectedSession.location}
                </p>
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
                  </tr>
                </thead>
                <tbody>
                  {activeCouncilors.map((c) => {
                    const st = selectedSession.attendance?.[c.uid] || 'ausente';
                    return (
                      <tr key={c.uid}>
                        <td className="border border-slate-300 p-2">{c.fullName}</td>
                        <td className="border border-slate-300 p-2">{c.roleLabel}</td>
                        <td className="border border-slate-300 p-2 font-semibold capitalize">{st}</td>
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
