import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  History,
  Lightbulb,
  List,
  Mail,
  Palette,
  Plus,
  Printer,
  Search,
  Sparkles,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import { FESTIVE_THEMES } from '../../lib/seedData';
import { deleteStorageFile } from '../../lib/storageUtils';
import type {
  AccessTier,
  AuditLog,
  CallOrSurvey,
  Commission,
  ContactMessage,
  CouncilSession,
  FestiveThemeId,
  GalleryItem,
  IdeaItem,
  LetterTemplate,
  NewsEvent,
  PortalSettings,
  RoleLabel,
  WorkPlanItem,
} from '../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Consultas Activas ({callsSurveys.length})
          </h3>
          {callsSurveys.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Sin registros aún.</p>
          ) : (
            callsSurveys.map((cs) => (
              <div
                key={cs.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase text-blue-600 dark:text-cyan-400">
                    {cs.kind} · {cs.status} · Cierra {cs.deadline}
                  </p>
                  <p className="text-sm font-bold truncate">{cs.title}</p>
                  <p className="text-xs text-slate-500 font-mono-num">
                    {cs.responseCount} respuestas
                  </p>
                </div>
                {isLeader && (
                  <div className="flex gap-1.5 shrink-0">
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

export function AgendaCalendarModule({
  sessions,
  newsEvents,
}: {
  sessions: CouncilSession[];
  newsEvents: NewsEvent[];
}) {
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const today = new Date();
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );

  const items = useMemo(() => {
    const combined: { id: string; dateIso: string; title: string; kind: string; sub: string }[] = [];
    sessions.forEach((s) =>
      combined.push({
        id: `s-${s.id}`,
        dateIso: s.dateIso,
        title: s.title,
        kind: `Sesión ${s.sessionType}`,
        sub: `${s.timeRange || ''} · ${s.location}`,
      })
    );
    newsEvents
      .filter((n) => n.type === 'evento' && n.eventDate)
      .forEach((n) =>
        combined.push({
          id: `e-${n.id}`,
          dateIso: n.eventDate || '',
          title: n.title,
          kind: 'Evento Público',
          sub: n.location || 'Flandes',
        })
      );
    return combined.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }, [sessions, newsEvents]);

  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Lunes = 0

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" /> Agenda y Cronograma CMJ
          </h2>
          <p className="text-xs text-slate-500">
            Sesiones programadas y eventos territoriales en Flandes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          />
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                viewMode === 'month' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''
              }`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
        <div className="grid grid-cols-7 gap-1.5 text-xs">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="p-2 text-center font-bold text-slate-500">
              {d}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[76px] rounded-xl bg-slate-50/40 dark:bg-slate-950/30" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = `${yearMonth}-${String(dayNum).padStart(2, '0')}`;
            const dayItems = items.filter((it) => it.dateIso === dateStr);
            return (
              <div
                key={dayNum}
                className="min-h-[82px] rounded-xl border border-slate-200/80 dark:border-slate-800 p-1.5 space-y-1"
              >
                <span className="font-mono-num text-[11px] font-bold text-slate-500">
                  {dayNum}
                </span>
                {dayItems.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-cyan-300 truncate"
                    title={`${it.title} (${it.sub})`}
                  >
                    {it.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">No hay actividades programadas.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((it) => (
            <div key={it.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400">
                  {it.kind} · <span className="font-mono-num">{it.dateIso}</span>
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{it.title}</p>
                <p className="text-xs text-slate-500">{it.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function IdeasBankModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  commissions,
  ideas,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  commissions: Commission[];
  ideas: IdeaItem[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Participación');
  const [commissionId, setCommissionId] = useState(commissions[0]?.id || 'comision-1');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    try {
      await apiRequest('/api/ideas', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          commissionId,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Propuso iniciativa en Buzón de Ideas',
        module: 'Buzón de Ideas',
        targetTitle: title.trim(),
      });
      setTitle('');
      setDescription('');
      showToast('Iniciativa publicada', 'success');
    } catch {
      showToast('No se pudo publicar la idea', 'error');
    }
  };

  const handleToggleVote = async (idea: IdeaItem) => {
    try {
      await apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}/upvote`, {
        method: 'POST',
      });
    } catch {
      showToast('No se pudo registrar apoyo', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" /> Banco Colaborativo de Ideas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de tu iniciativa"
            className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
          />
          <select
            value={commissionId}
            onChange={(e) => setCommissionId(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm"
          >
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoría (ej: Cultura, Empleo)"
            className="sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe brevemente el impacto esperado en Flandes..."
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shrink-0"
          >
            Publicar idea
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ideas.length === 0 ? (
          <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
            Aún no hay ideas propuestas. ¡Publica la primera iniciativa juvenil!
          </div>
        ) : (
          ideas.map((idea) => {
            const upvoted = idea.upvoterUids.includes(uid);
            return (
              <div
                key={idea.id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-blue-600 dark:text-cyan-400">
                      {idea.category} · {idea.status.replace('_', ' ')}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {idea.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleVote(idea)}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      upvoted
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" /> {idea.upvoterUids.length}
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{idea.description}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                  <span>Por {idea.authorName}</span>
                  <div className="flex items-center gap-2">
                    {isLeader && (
                      <select
                        value={idea.status}
                        onChange={(e) =>
                          apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}`, {
                            method: 'PATCH',
                            body: { status: e.target.value },
                          }).catch(() => showToast('No se pudo actualizar el estado', 'error'))
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px]"
                      >
                        <option value="nueva">Nueva</option>
                        <option value="en_revision">En revisión</option>
                        <option value="aprobada">Aprobada</option>
                      </select>
                    )}
                    {(isLeader || idea.authorUid === uid) && (
                      <button
                        type="button"
                        onClick={() =>
                          apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}`, {
                            method: 'DELETE',
                          }).catch(() => showToast('No se pudo eliminar', 'error'))
                        }
                        className="text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function LetterTemplatesModule({
  uid,
  actorName,
  accessTier,
  templates,
}: {
  uid: string;
  actorName: string;
  accessTier: AccessTier;
  templates: LetterTemplate[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const selected = templates.find((t) => t.id === selectedId) || templates[0] || null;

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Oficio');
  const [newBody, setNewBody] = useState(
    'Flandes, Tolima, {{fecha}}\n\nSeñor(a) {{destinatario}}\nAsunto: {{asunto}}\n\nCordial saludo.\n\n{{contenido}}\n\nAtentamente,\n{{firmante}}'
  );

  const [destinatario, setDestinatario] = useState('Secretaría de Gobierno / Alcaldía de Flandes');
  const [asunto, setAsunto] = useState('Gestión juvenil');
  const [contenido, setContenido] = useState('');

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newBody.trim().length < 10) return;
    try {
      const res = await apiRequest<{ id: string; ok: boolean }>('/api/templates', {
        method: 'POST',
        body: {
          title: newTitle.trim(),
          category: newCategory,
          headerText: 'CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES – TOLIMA',
          bodyTemplate: newBody.trim(),
          signatoryRole: 'Presidencia y Secretaría',
        },
      });
      setSelectedId(res.id);
      setNewTitle('');
      showToast('Plantilla guardada', 'success');
    } catch {
      showToast('No se pudo guardar la plantilla', 'error');
    }
  };

  const renderedLetter = useMemo(() => {
    if (!selected) return '';
    return selected.bodyTemplate
      .replace(/\{\{fecha\}\}/g, new Date().toLocaleDateString('es-CO'))
      .replace(/\{\{destinatario\}\}/g, destinatario)
      .replace(/\{\{asunto\}\}/g, asunto)
      .replace(/\{\{contenido\}\}/g, contenido || '...')
      .replace(/\{\{firmante\}\}/g, actorName);
  }, [selected, destinatario, asunto, contenido, actorName]);

  return (
    <div className="space-y-6">
      {isLeader && (
        <form
          onSubmit={handleCreateTemplate}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3 no-print"
        >
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" /> Plantillas de Oficios y Cartas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Categoría"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
          </div>
          <textarea
            rows={4}
            required
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-mono"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Guardar nueva plantilla
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3 no-print">
          <h3 className="text-sm font-bold">Plantillas disponibles ({templates.length})</h3>
          {templates.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-2xl border p-3.5 cursor-pointer flex items-center justify-between gap-2 ${
                selected?.id === t.id
                  ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{t.title}</p>
                <p className="text-[11px] text-slate-500">{t.category}</p>
              </div>
              {isLeader && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    apiRequest(`/api/templates/${encodeURIComponent(t.id)}`, {
                      method: 'DELETE',
                    }).catch(() => showToast('No se pudo eliminar', 'error'));
                  }}
                  className="text-rose-500 p-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-4">
          {selected ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
                <input
                  type="text"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  placeholder="Destinatario"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  placeholder="Asunto"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
                <textarea
                  rows={2}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder="Cuerpo o detalle de la solicitud"
                  className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white text-slate-900 p-8 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <div>
                    <p className="text-xs font-extrabold uppercase text-blue-700">
                      {selected.headerText || 'CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {renderedLetter}
                </pre>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
              Crea una plantilla arriba para redactar e imprimir oficios oficiales.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkPlanAndCertsModule({
  uid,
  actorName,
  accessTier,
  commissions,
  workPlans,
}: {
  uid: string;
  actorName: string;
  accessTier: AccessTier;
  commissions: Commission[];
  workPlans: WorkPlanItem[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [title, setTitle] = useState('');
  const [axis, setAxis] = useState('Eje Estratégico Juvenil');
  const [commissionId, setCommissionId] = useState(commissions[0]?.id || 'comision-1');
  const [quarter, setQuarter] = useState('2026-Q4');

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await apiRequest('/api/work-plans', {
        method: 'POST',
        body: {
          title: title.trim(),
          axis: axis.trim(),
          commissionId,
          quarter,
          status: 'planeado',
          progress: 0,
          evidenceCount: 0,
        },
      });
      setTitle('');
      showToast('Meta agregada al plan de trabajo', 'success');
    } catch {
      showToast('No se pudo agregar la meta', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {isLeader && (
        <form
          onSubmit={handleAddGoal}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3 no-print"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-600" /> Plan de Trabajo y Cumplimiento
            </h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-semibold cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" /> Certificado / Informe PDF
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meta u objetivo del plan"
              className="sm:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={axis}
              onChange={(e) => setAxis(e.target.value)}
              placeholder="Eje temático"
              className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <select
              value={commissionId}
              onChange={(e) => setCommissionId(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            >
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="sm:col-span-2 flex gap-1.5">
              <input
                type="text"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="w-20 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs"
              />
              <button
                type="submit"
                className="flex-1 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-3">
          <h3 className="text-lg font-extrabold">
            Certificado de Cumplimiento Plan de Trabajo · CMJ Flandes
          </h3>
          <p className="text-xs">Emitido por {actorName}</p>
        </div>

        {workPlans.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No hay metas cargadas en el plan de trabajo todavía.
          </p>
        ) : (
          workPlans.map((wp) => (
            <div
              key={wp.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <p className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400">
                  {wp.axis} · {wp.quarter} ·{' '}
                  {commissions.find((c) => c.id === wp.commissionId)?.name || wp.commissionId}
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{wp.title}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={wp.progress}
                  onChange={(e) => {
                    const p = Number(e.target.value);
                    apiRequest(`/api/work-plans/${encodeURIComponent(wp.id)}`, {
                      method: 'PATCH',
                      body: {
                        progress: p,
                        status: p === 100 ? 'completado' : p > 0 ? 'ejecucion' : 'planeado',
                      },
                    }).catch(() => showToast('No se pudo actualizar el avance', 'error'));
                  }}
                  className="w-28 accent-blue-600 cursor-pointer no-print"
                />
                <span className="font-mono-num text-xs font-extrabold w-10 text-right">
                  {wp.progress}%
                </span>
                {isLeader && (
                  <button
                    type="button"
                    onClick={() =>
                      apiRequest(`/api/work-plans/${encodeURIComponent(wp.id)}`, {
                        method: 'DELETE',
                      }).catch(() => showToast('No se pudo eliminar', 'error'))
                    }
                    className="no-print text-rose-500 p-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AuditLogModule({ auditLogs }: { auditLogs: AuditLog[] }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter(
      (a) =>
        !q ||
        a.actorName.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.module.toLowerCase().includes(q) ||
        a.targetTitle.toLowerCase().includes(q)
    );
  }, [auditLogs, search]);

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" /> Historial de Auditoría
          </h2>
          <p className="text-xs text-slate-500">
            Registro inmutable de acciones realizadas por la Mesa Directiva y Consejeros.
          </p>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar auditoría..."
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">Sin eventos registrados aún.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {filtered.map((a) => (
            <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{a.actorName}</span>{' '}
                <span className="text-blue-600 dark:text-cyan-400 font-semibold">
                  ({a.actorRoleLabel})
                </span>{' '}
                — {a.action}: <strong>{a.targetTitle}</strong>
              </div>
              <span className="text-[11px] text-slate-500 shrink-0">{a.module}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortalEditorModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  settings,
  commissions,
  newsEvents,
  galleryItems,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  settings: PortalSettings;
  commissions: Commission[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);

  const [heroTitle, setHeroTitle] = useState(settings.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(settings.heroSubtitle);
  const [aboutText, setAboutText] = useState(settings.aboutText || '');
  const [missionText, setMissionText] = useState(settings.missionText || '');
  const [visionText, setVisionText] = useState(settings.visionText || '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || '');
  const [contactAddress, setContactAddress] = useState(settings.contactAddress || '');
  const [activeTheme, setActiveTheme] = useState<FestiveThemeId>(settings.activeTheme);
  const [savingSettings, setSavingSettings] = useState(false);

  // Nueva noticia / evento
  const [newsTitle, setNewsTitle] = useState('');
  const [newsType, setNewsType] = useState<'noticia' | 'evento'>('noticia');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsComm, setNewsComm] = useState(commissions[0]?.id || 'comision-1');
  const [newsDate, setNewsDate] = useState('');
  const [newsLocation, setNewsLocation] = useState('');
  const [newsCoverUrl, setNewsCoverUrl] = useState('');
  const [newsStoragePath, setNewsStoragePath] = useState('');

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroTitle: heroTitle.trim(),
          heroSubtitle: heroSubtitle.trim(),
          heroImageUrl: settings.heroImageUrl || '',
          heroStoragePath: settings.heroStoragePath || '',
          aboutText: aboutText.trim(),
          missionText: missionText.trim(),
          visionText: visionText.trim(),
          contactEmail: contactEmail.trim(),
          contactAddress: contactAddress.trim(),
          activeTheme,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Actualizó configuración del portal público',
        module: 'Editor del Portal',
        targetTitle: `Tema ${activeTheme}`,
      });
      showToast('Portal público actualizado', 'success');
    } catch {
      showToast('No se pudieron guardar los cambios', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleHeroUpload = async (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (!f) return;
    try {
      if (settings.heroStoragePath) {
        await deleteStorageFile(settings.heroStoragePath, settings.heroImageUrl);
      }
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroImageUrl: f.url,
          heroStoragePath: f.storagePath || '',
        },
      });
      showToast('Portada del portal actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la portada', 'error');
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsTitle.trim() || !newsSummary.trim() || !newsContent.trim()) return;
    try {
      await apiRequest('/api/news', {
        method: 'POST',
        body: {
          title: newsTitle.trim(),
          type: newsType,
          summary: newsSummary.trim(),
          content: newsContent.trim(),
          coverUrl: newsCoverUrl,
          storagePath: newsStoragePath,
          commissionId: newsComm,
          eventDate: newsDate,
          location: newsLocation.trim(),
          status: isLeader ? 'publicado' : 'pendiente',
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Creó ${newsType}`,
        module: 'Noticias y Eventos',
        targetTitle: newsTitle.trim(),
      });
      setNewsTitle('');
      setNewsSummary('');
      setNewsContent('');
      setNewsCoverUrl('');
      setNewsStoragePath('');
      showToast(
        isLeader ? 'Publicado en el portal ciudadano' : 'Enviado a revisión de Mesa Directiva',
        'success'
      );
    } catch {
      showToast('No se pudo crear la noticia/evento', 'error');
    }
  };

  const handleDeleteNews = async (n: NewsEvent) => {
    try {
      await deleteStorageFile(n.storagePath, n.coverUrl);
      await apiRequest(`/api/news/${encodeURIComponent(n.id)}`, {
        method: 'DELETE',
      });
      showToast('Publicación y archivo eliminados', 'info');
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  const handleDeleteGallery = async (g: GalleryItem) => {
    try {
      await deleteStorageFile(g.storagePath, g.url);
      if (g.thumbnailStoragePath) {
        await deleteStorageFile(g.thumbnailStoragePath, g.thumbnailUrl);
      }
      await apiRequest(`/api/gallery/${encodeURIComponent(g.id)}`, {
        method: 'DELETE',
      });
      showToast('Elemento eliminado de galería y archivo', 'info');
    } catch {
      showToast('Error al eliminar', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {isLeader && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Identidad, Temas Festivos y Portada Pública
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {FESTIVE_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTheme(t.id)}
                className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                  activeTheme === t.id
                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className={`h-2.5 w-full rounded-full bg-gradient-to-r ${t.accentGradient} mb-2`} />
                <p className="text-xs font-bold text-slate-900 dark:text-white">{t.name}</p>
                <p className="text-[11px] text-slate-500">{t.subtitle}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder="Título principal del portal"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <input
              type="text"
              required
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Subtítulo"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
            />
            <textarea
              rows={2}
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="¿Qué es el CMJ Flandes?"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <textarea
              rows={2}
              value={missionText}
              onChange={(e) => setMissionText(e.target.value)}
              placeholder="Misión"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <textarea
              rows={2}
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder="Visión"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Correo público de contacto"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <input
              type="text"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="Dirección física / punto de encuentro"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
          </div>

          <MediaUploader
            storageFolder="public/hero"
            imagePreset="cover"
            label="Imagen de portada institucional (opcional)"
            onUploaded={handleHeroUpload}
          />

          <button
            type="submit"
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {savingSettings ? 'Guardando...' : 'Guardar configuración pública'}
          </button>
        </form>
      )}

      {/* Noticias y Eventos */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Publicar Noticia o Evento
        </h3>
        <form onSubmit={handleCreateNews} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newsTitle}
              onChange={(e) => setNewsTitle(e.target.value)}
              placeholder="Titular"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <select
              value={newsType}
              onChange={(e) => setNewsType(e.target.value as 'noticia' | 'evento')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="noticia">Noticia</option>
              <option value="evento">Evento</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={newsComm}
              onChange={(e) => setNewsComm(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newsDate}
              onChange={(e) => setNewsDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={newsLocation}
              onChange={(e) => setNewsLocation(e.target.value)}
              placeholder="Lugar (opcional)"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>
          <input
            type="text"
            required
            value={newsSummary}
            onChange={(e) => setNewsSummary(e.target.value)}
            placeholder="Resumen corto para tarjeta"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <textarea
            rows={3}
            required
            value={newsContent}
            onChange={(e) => setNewsContent(e.target.value)}
            placeholder="Desarrollo completo de la noticia o evento..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <MediaUploader
            storageFolder="public/news"
            imagePreset="cover"
            label="Foto de portada de la noticia (opcional)"
            onUploaded={(files) => {
              if (files[0]) {
                setNewsCoverUrl(files[0].url);
                setNewsStoragePath(files[0].storagePath || '');
              }
            }}
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            {isLeader ? 'Publicar ahora' : 'Enviar para aprobación'}
          </button>
        </form>

        {newsEvents.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-4">
            {newsEvents.map((n) => (
              <div key={n.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold uppercase text-blue-600 dark:text-cyan-400">
                    {n.type} · {n.status}
                  </span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                </div>
                {isLeader && (
                  <div className="flex items-center gap-2 shrink-0">
                    {n.status !== 'publicado' && (
                      <button
                        type="button"
                        onClick={() =>
                          apiRequest(`/api/news/${encodeURIComponent(n.id)}`, {
                            method: 'PATCH',
                            body: { status: 'publicado' },
                          }).catch(() => showToast('No se pudo aprobar', 'error'))
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-white font-semibold cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteNews(n)}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gestión rápida de galería */}
      {isLeader && galleryItems.length > 0 && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Elementos publicados en Galería ({galleryItems.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {galleryItems.map((g) => (
              <div key={g.id} className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-semibold truncate">
                  [{g.mediaType}] {g.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteGallery(g)}
                  className="text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RoleGuideModule({ roleLabel }: { roleLabel: RoleLabel }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <BookOpen className="h-5 w-5 text-blue-600" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Guía Institucional de Cargos · CMJ Flandes
        </h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Tu cargo actual es <strong>{roleLabel}</strong>. En el marco de la Ley Estatutaria 1622 de 2013 y la Ley 1885 de 2018, estas son las funciones dentro del portal:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-blue-600 dark:text-cyan-400">Presidente</h3>
          <p>Convoca y preside sesiones plenarias, aprueba publicaciones del portal público, firma oficios y actas, y supervisa indicadores globales y auditoría.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Vicepresidente</h3>
          <p>Apoya y reemplaza a la Presidencia, supervisa el cumplimiento de metas de las 5 comisiones y valida el avance de compromisos y planillas.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-indigo-600 dark:text-indigo-400">Secretario</h3>
          <p>Gestiona el directorio de consejeros y cuentas, levanta actas y asistencia, gestiona planillas Excel/PDF, documentos, convocatorias y configuración visual del portal.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
          <h3 className="font-bold text-sm text-amber-600 dark:text-amber-400">Consejero</h3>
          <p>Trabaja en su comisión asignada, actualiza sus tareas y compromisos, participa en votaciones, registra asistencia por código y propone iniciativas en el buzón.</p>
        </div>
      </div>
    </div>
  );
}
