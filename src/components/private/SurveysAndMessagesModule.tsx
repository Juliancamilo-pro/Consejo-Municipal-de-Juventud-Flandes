import React, { useState } from 'react';
import { Edit3, Eye, Mail, Save, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type {
  AccessTier,
  CallOrSurvey,
  ContactMessage,
  RoleLabel,
  SurveyResponse,
} from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

export function SurveysAndMessagesModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  callsSurveys,
  contactMessages,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  callsSurveys: CallOrSurvey[];
  contactMessages: ContactMessage[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'convocatoria' | 'encuesta'>('encuesta');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState('');
  const [optionsText, setOptionsText] = useState('Opción A\nOpción B');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editKind, setEditKind] = useState<'convocatoria' | 'encuesta'>('encuesta');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editOptionsText, setEditOptionsText] = useState('');
  const [editStatus, setEditStatus] = useState<'abierta' | 'cerrada'>('abierta');
  const [savingEdit, setSavingEdit] = useState(false);

  const [viewingSurvey, setViewingSurvey] = useState<CallOrSurvey | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) return;
    const opts = optionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await apiRequest('/api/calls-surveys', {
        method: 'POST',
        body: {
          title: title.trim(),
          kind,
          description: desc.trim(),
          deadline: deadline || new Date().toISOString().slice(0, 10),
          options: opts,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Publicó ${kind}`,
        module: 'Convocatorias y Encuestas',
        targetTitle: title.trim(),
      });
      setTitle('');
      setDesc('');
      showToast('Publicación creada', 'success');
    } catch {
      showToast('No se pudo crear', 'error');
    }
  };

  const startEditSurvey = (cs: CallOrSurvey) => {
    setEditingId(cs.id);
    setEditTitle(cs.title);
    setEditKind(cs.kind);
    setEditDesc(cs.description);
    setEditDeadline(cs.deadline || '');
    setEditOptionsText((cs.options || []).join('\n'));
    setEditStatus(cs.status);
  };

  const handleSaveEditSurvey = async (cs: CallOrSurvey) => {
    if (!editTitle.trim() || !editDesc.trim()) return;
    setSavingEdit(true);
    try {
      const opts = editOptionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiRequest(`/api/calls-surveys/${encodeURIComponent(cs.id)}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          kind: editKind,
          description: editDesc.trim(),
          deadline: editDeadline,
          options: opts,
          status: editStatus,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Editó ${editKind}`,
        module: 'Convocatorias y Encuestas',
        targetTitle: editTitle.trim(),
      });
      setEditingId(null);
      showToast('Convocatoria/encuesta actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la publicación', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenResponses = async (cs: CallOrSurvey) => {
    setViewingSurvey(cs);
    setLoadingResponses(true);
    try {
      const res = await apiRequest<{ responses: SurveyResponse[] }>('/api/survey-responses');
      setSurveyResponses((res.responses || []).filter((r) => r.surveyId === cs.id));
    } catch {
      setSurveyResponses([]);
      showToast('No se pudieron cargar las respuestas', 'error');
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleDeleteContactMessage = async (m: ContactMessage) => {
    try {
      await apiRequest(`/api/contact-messages/${encodeURIComponent(m.id)}`, {
        method: 'DELETE',
      });
      showToast('Mensaje eliminado', 'info');
    } catch {
      showToast('No se pudo eliminar el mensaje', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {isLeader && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Convocatorias y Encuestas Públicas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la consulta o convocatoria"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'convocatoria' | 'encuesta')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
            >
              <option value="encuesta">Encuesta juvenil</option>
              <option value="convocatoria">Convocatoria abierta</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <textarea
              rows={2}
              required
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descripción y objetivos..."
              className="sm:col-span-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <textarea
              rows={2}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Opciones (una por línea)"
              className="sm:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <div className="sm:col-span-2 flex flex-col gap-2">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Publicar
              </button>
            </div>
          </div>
        </form>
      )}

      {viewingSurvey && (
        <div className="rounded-3xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase text-blue-600 dark:text-cyan-400">
                Respuestas ciudadanas · {viewingSurvey.kind}
              </p>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {viewingSurvey.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setViewingSurvey(null)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Cerrar visor
            </button>
          </div>
          {loadingResponses ? (
            <p className="text-xs text-slate-500">Cargando respuestas...</p>
          ) : surveyResponses.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Aún no se han recibido respuestas ciudadanas en esta consulta.
            </p>
          ) : (
            <div className="space-y-3">
              {(viewingSurvey.options || []).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(viewingSurvey.options || []).map((opt) => {
                    const count = surveyResponses.filter((r) => r.selectedOption === opt).length;
                    return (
                      <div
                        key={opt}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold truncate">{opt}</span>
                        <span className="font-mono-num font-bold text-blue-600 dark:text-cyan-400">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4">
                {surveyResponses.map((r) => (
                  <div key={r.id} className="py-2.5 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {r.respondentName}{' '}
                        {r.respondentEmail && (
                          <span className="font-normal text-slate-500">({r.respondentEmail})</span>
                        )}
                      </span>
                      <span className="rounded-lg bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
                        {r.selectedOption}
                      </span>
                    </div>
                    {r.comment && <p className="text-slate-600 dark:text-slate-300">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Consultas y Convocatorias ({callsSurveys.length})
          </h3>
          {callsSurveys.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Sin registros aún.</p>
          ) : (
            callsSurveys.map((cs) => (
              <div
                key={cs.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
              >
                {editingId === cs.id ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título"
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                      <div className="flex gap-2">
                        <select
                          value={editKind}
                          onChange={(e) => setEditKind(e.target.value as 'convocatoria' | 'encuesta')}
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        >
                          <option value="encuesta">Encuesta</option>
                          <option value="convocatoria">Convocatoria</option>
                        </select>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as 'abierta' | 'cerrada')}
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        >
                          <option value="abierta">Abierta</option>
                          <option value="cerrada">Cerrada</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Descripción"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <textarea
                        rows={2}
                        value={editOptionsText}
                        onChange={(e) => setEditOptionsText(e.target.value)}
                        placeholder="Opciones (una por línea)"
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                      <div className="flex flex-col justify-between gap-2">
                        <input
                          type="date"
                          value={editDeadline}
                          onChange={(e) => setEditDeadline(e.target.value)}
                          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => handleSaveEditSurvey(cs)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                          >
                            <Save className="h-3.5 w-3.5" /> Guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase text-blue-600 dark:text-cyan-400">
                        {cs.kind} · {cs.status} · Cierra {cs.deadline}
                      </p>
                      <p className="text-sm font-bold truncate">{cs.title}</p>
                      <p className="text-xs text-slate-500 font-mono-num">
                        {cs.responseCount} respuestas
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenResponses(cs)}
                        title="Ver respuestas ciudadanas"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-semibold cursor-pointer hover:border-blue-500"
                      >
                        <Eye className="h-3.5 w-3.5" /> Respuestas
                      </button>
                      {isLeader && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditSurvey(cs)}
                            title="Editar"
                            className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:border-blue-500 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              apiRequest(`/api/calls-surveys/${encodeURIComponent(cs.id)}`, {
                                method: 'PATCH',
                                body: {
                                  status: cs.status === 'abierta' ? 'cerrada' : 'abierta',
                                },
                              }).catch(() => showToast('No se pudo actualizar', 'error'))
                            }
                            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                          >
                            {cs.status === 'abierta' ? 'Cerrar' : 'Reabrir'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              apiRequest(`/api/calls-surveys/${encodeURIComponent(cs.id)}`, {
                                method: 'DELETE',
                              }).catch(() => showToast('No se pudo eliminar', 'error'))
                            }
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {isLeader && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" /> Mensajes Ciudadanos ({contactMessages.length})
            </h3>
            {contactMessages.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                Aún no hay mensajes ciudadanos recibidos.
              </p>
            ) : (
              contactMessages.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {m.subject}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {m.senderName} ({m.senderEmail}) · {m.category || 'General'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={m.status}
                        onChange={(e) =>
                          apiRequest(`/api/contact-messages/${encodeURIComponent(m.id)}`, {
                            method: 'PATCH',
                            body: { status: e.target.value },
                          }).catch(() => showToast('No se pudo actualizar el mensaje', 'error'))
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px]"
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="respondido">Respondido</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteContactMessage(m)}
                        title="Eliminar mensaje"
                        className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{m.message}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default SurveysAndMessagesModule;
