import React, { useMemo, useState } from 'react';
import { Edit3, Eye, FileSpreadsheet, Mail, Save, Trash2 } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { exportStyledWorkbook } from '../../lib/excelExport';
import type {
  AccessTier,
  CallOrSurvey,
  ContactMessage,
  RoleLabel,
  SurveyResponse,
} from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { ConfirmDialog, DataToolbar, PaginationBar, ResponsiveModal } from '../ui/DataTableUI';
import { recordAudit } from './auditHelper';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

export function SurveysAndMessagesModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier: _accessTier,
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
  const { can } = usePermissions();
  const canManageSurveys = can('encuestas.crear');
  const canViewResponses = can('encuestas.ver_respuestas');
  const canExportSurveys = can('encuestas.exportar');
  const canViewInbox = can('buzon.ver');
  const canManageInbox = can('buzon.responder');
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

  // Filtros y paginación
  const [surveySearch, setSurveySearch] = useState('');
  const [surveyStatusFilter, setSurveyStatusFilter] = useState<'all' | 'abierta' | 'cerrada'>('all');
  const [surveyPage, setSurveyPage] = useState(1);

  const [msgSearch, setMsgSearch] = useState('');
  const [msgStatusFilter, setMsgStatusFilter] = useState<'all' | 'nuevo' | 'en_proceso' | 'respondido'>('all');
  const [msgPage, setMsgPage] = useState(1);

  // Modal de respuestas
  const [viewingSurvey, setViewingSurvey] = useState<CallOrSurvey | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Confirmaciones de eliminación
  const [deleteSurveyTarget, setDeleteSurveyTarget] = useState<CallOrSurvey | null>(null);
  const [deleteMsgTarget, setDeleteMsgTarget] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageSize = 6;

  const filteredSurveys = useMemo(() => {
    const q = surveySearch.trim().toLowerCase();
    return callsSurveys
      .filter((cs) => surveyStatusFilter === 'all' || cs.status === surveyStatusFilter)
      .filter(
        (cs) =>
          !q ||
          cs.title.toLowerCase().includes(q) ||
          cs.description.toLowerCase().includes(q) ||
          cs.kind.toLowerCase().includes(q)
      );
  }, [callsSurveys, surveySearch, surveyStatusFilter]);

  const safeSurveyPage = Math.min(surveyPage, Math.max(1, Math.ceil(filteredSurveys.length / pageSize)));
  const pagedSurveys = filteredSurveys.slice(
    (safeSurveyPage - 1) * pageSize,
    safeSurveyPage * pageSize
  );

  const filteredMessages = useMemo(() => {
    const q = msgSearch.trim().toLowerCase();
    return contactMessages
      .filter((m) => msgStatusFilter === 'all' || m.status === msgStatusFilter)
      .filter(
        (m) =>
          !q ||
          m.subject.toLowerCase().includes(q) ||
          m.senderName.toLowerCase().includes(q) ||
          m.senderEmail.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q)
      );
  }, [contactMessages, msgSearch, msgStatusFilter]);

  const safeMsgPage = Math.min(msgPage, Math.max(1, Math.ceil(filteredMessages.length / pageSize)));
  const pagedMessages = filteredMessages.slice(
    (safeMsgPage - 1) * pageSize,
    safeMsgPage * pageSize
  );

  const handleExportAll = async () => {
    setExporting(true);
    try {
      await exportStyledWorkbook({
        fileName: `Participacion_y_Mensajes_CMJ_${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle: 'Participación Juvenil, Encuestas y Mensajes Ciudadanos',
        moduleName: 'Convocatorias y Mensajes',
        generatedBy: actorName,
        includeSummarySheet: true,
        sheets: [
          {
            name: 'Consultas y Convocatorias',
            title: 'Listado de Encuestas y Convocatorias',
            columns: [
              { key: 'titulo', header: 'Título', type: 'text', minWidth: 26, maxWidth: 42, wrap: true },
              { key: 'tipo', header: 'Tipo', type: 'text', minWidth: 14, maxWidth: 18, align: 'center' },
              { key: 'estado', header: 'Estado', type: 'text', minWidth: 12, maxWidth: 16, align: 'center' },
              { key: 'cierre', header: 'Fecha Cierre', type: 'date', minWidth: 14, maxWidth: 16 },
              { key: 'respuestas', header: 'Respuestas', type: 'integer', minWidth: 12, maxWidth: 14 },
            ],
            rows: filteredSurveys.map((cs) => ({
              titulo: cs.title,
              tipo: cs.kind === 'encuesta' ? 'Encuesta' : 'Convocatoria',
              estado: cs.status === 'abierta' ? 'Abierta' : 'Cerrada',
              cierre: cs.deadline || '',
              respuestas: cs.responseCount,
            })),
          },
          {
            name: 'Mensajes Ciudadanos',
            title: 'Buzón de Mensajes y Solicitudes Juveniles',
            columns: [
              { key: 'asunto', header: 'Asunto', type: 'text', minWidth: 22, maxWidth: 34, wrap: true },
              { key: 'remitente', header: 'Remitente', type: 'text', minWidth: 18, maxWidth: 26 },
              { key: 'correo', header: 'Correo', type: 'text', minWidth: 22, maxWidth: 32 },
              { key: 'categoria', header: 'Categoría', type: 'text', minWidth: 14, maxWidth: 20 },
              { key: 'estado', header: 'Estado', type: 'text', minWidth: 14, maxWidth: 16, align: 'center' },
              { key: 'mensaje', header: 'Mensaje', type: 'text', minWidth: 32, maxWidth: 52, wrap: true },
            ],
            rows: filteredMessages.map((m) => ({
              asunto: m.subject,
              remitente: m.senderName,
              correo: m.senderEmail,
              categoria: m.category || 'General',
              estado:
                m.status === 'respondido'
                  ? 'Respondido'
                  : m.status === 'en_proceso'
                  ? 'En proceso'
                  : 'Nuevo',
              mensaje: m.message,
            })),
          },
        ],
      });
      showToast('Reporte de participación exportado a Excel', 'success');
    } catch {
      showToast('No se pudo generar el archivo Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSurveyResponses = async () => {
    if (!viewingSurvey) return;
    try {
      await exportStyledWorkbook({
        fileName: `Respuestas_${viewingSurvey.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 28)}.xlsx`,
        reportTitle: `Respuestas Ciudadanas — ${viewingSurvey.title}`,
        moduleName: 'Encuestas Juveniles',
        generatedBy: actorName,
        sheets: [
          {
            name: 'Respuestas',
            title: viewingSurvey.title,
            kpis: [{ label: 'Total respuestas', value: surveyResponses.length }],
            columns: [
              { key: 'participante', header: 'Participante', type: 'text', minWidth: 22, maxWidth: 32 },
              { key: 'correo', header: 'Correo', type: 'text', minWidth: 22, maxWidth: 32 },
              { key: 'opcion', header: 'Opción Elegida', type: 'text', minWidth: 20, maxWidth: 32 },
              { key: 'comentario', header: 'Comentario', type: 'text', minWidth: 30, maxWidth: 48, wrap: true },
              { key: 'fecha', header: 'Fecha', type: 'date', minWidth: 14, maxWidth: 16 },
            ],
            rows: surveyResponses.map((r) => ({
              participante: r.respondentName,
              correo: r.respondentEmail || '—',
              opcion: r.selectedOption,
              comentario: r.comment || '—',
              fecha: r.createdAt || '',
            })),
          },
        ],
      });
      showToast('Respuestas exportadas a Excel', 'success');
    } catch {
      showToast('No se pudo exportar el Excel', 'error');
    }
  };

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
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo crear';
      showToast(msg, 'error');
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
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la publicación';
      showToast(msg, 'error');
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
    } catch (err) {
      setSurveyResponses([]);
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudieron cargar las respuestas';
      showToast(msg, 'error');
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleConfirmDeleteSurvey = async () => {
    if (!deleteSurveyTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/calls-surveys/${encodeURIComponent(deleteSurveyTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteSurveyTarget(null);
      showToast('Publicación eliminada', 'info');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmDeleteMsg = async () => {
    if (!deleteMsgTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/contact-messages/${encodeURIComponent(deleteMsgTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteMsgTarget(null);
      showToast('Mensaje eliminado', 'info');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar el mensaje';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="cmj-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Convocatorias y Encuestas Públicas
          </h2>
          {canExportSurveys && (
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportAll}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exporting ? 'Exportando...' : 'Exportar Excel (.xlsx)'}
            </button>
          )}
        </div>

        {canManageSurveys ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la consulta o convocatoria"
                aria-label="Título"
                className="sm:col-span-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'convocatoria' | 'encuesta')}
                aria-label="Tipo"
                className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
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
                  aria-label="Fecha de cierre"
                  className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="min-h-[38px] rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
                >
                  Publicar
                </button>
              </div>
            </div>
          </form>
        ) : (
          <PermissionDeniedBanner permission="encuestas.crear" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consultas y convocatorias */}
        <div className="cmj-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Consultas y Convocatorias ({filteredSurveys.length})
            </h3>
            {!canViewResponses && (
              <PermissionDeniedBanner
                permission="encuestas.ver_respuestas"
                compact
                customText="Respuestas detalladas restringidas"
              />
            )}
          </div>

          <DataToolbar
            search={surveySearch}
            onSearchChange={(val) => {
              setSurveySearch(val);
              setSurveyPage(1);
            }}
            searchPlaceholder="Buscar consulta..."
          >
            <select
              aria-label="Filtrar estado de consulta"
              value={surveyStatusFilter}
              onChange={(e) => {
                setSurveyStatusFilter(e.target.value as 'all' | 'abierta' | 'cerrada');
                setSurveyPage(1);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="all">Todas</option>
              <option value="abierta">Abiertas</option>
              <option value="cerrada">Cerradas</option>
            </select>
          </DataToolbar>

          {pagedSurveys.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Sin registros que coincidan.</p>
          ) : (
            <div className="space-y-3">
              {pagedSurveys.map((cs) => (
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
                          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                        />
                        <div className="flex gap-2">
                          <select
                            value={editKind}
                            onChange={(e) => setEditKind(e.target.value as 'convocatoria' | 'encuesta')}
                            className="flex-1 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                          >
                            <option value="encuesta">Encuesta</option>
                            <option value="convocatoria">Convocatoria</option>
                          </select>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as 'abierta' | 'cerrada')}
                            className="flex-1 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
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
                            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => handleSaveEditSurvey(cs)}
                              className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                            >
                              <Save className="h-3.5 w-3.5" /> Guardar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                          {cs.kind} · {cs.status} · Cierra {cs.deadline}
                        </p>
                        <p className="text-sm font-bold truncate">{cs.title}</p>
                        <p className="text-xs text-slate-500 font-mono-num">
                          {cs.responseCount} respuestas
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {canViewResponses && (
                          <button
                            type="button"
                            onClick={() => handleOpenResponses(cs)}
                            title="Ver respuestas ciudadanas"
                            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer hover:border-emerald-500 whitespace-nowrap"
                          >
                            <Eye className="h-3.5 w-3.5" /> Respuestas
                          </button>
                        )}
                        {canManageSurveys && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditSurvey(cs)}
                              title="Editar"
                              aria-label={`Editar ${cs.title}`}
                              className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:border-blue-500 cursor-pointer"
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
                                }).catch((err) =>
                                  showToast(
                                    err instanceof ApiRequestError
                                      ? err.message
                                      : 'No se pudo actualizar',
                                    'error'
                                  )
                                )
                              }
                              className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              {cs.status === 'abierta' ? 'Cerrar' : 'Reabrir'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteSurveyTarget(cs)}
                              aria-label={`Eliminar ${cs.title}`}
                              className="min-h-[36px] rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <PaginationBar
            totalItems={filteredSurveys.length}
            page={safeSurveyPage}
            pageSize={pageSize}
            onPageChange={setSurveyPage}
          />
        </div>

        {/* Mensajes ciudadanos */}
        {canViewInbox ? (
          <div className="cmj-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-700" /> Mensajes Ciudadanos ({filteredMessages.length})
              </h3>
              {!canManageInbox && (
                <PermissionDeniedBanner
                  permission="buzon.responder"
                  compact
                  customText="Solo lectura del buzón"
                />
              )}
            </div>

            <DataToolbar
              search={msgSearch}
              onSearchChange={(val) => {
                setMsgSearch(val);
                setMsgPage(1);
              }}
              searchPlaceholder="Buscar por asunto, remitente o texto..."
            >
              <select
                aria-label="Filtrar estado del mensaje"
                value={msgStatusFilter}
                onChange={(e) => {
                  setMsgStatusFilter(
                    e.target.value as 'all' | 'nuevo' | 'en_proceso' | 'respondido'
                  );
                  setMsgPage(1);
                }}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="all">Todos</option>
                <option value="nuevo">Nuevos</option>
                <option value="en_proceso">En proceso</option>
                <option value="respondido">Respondidos</option>
              </select>
            </DataToolbar>

            {pagedMessages.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No hay mensajes ciudadanos con ese filtro.
              </p>
            ) : (
              <div className="space-y-3">
                {pagedMessages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          {m.subject}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {m.senderName} ({m.senderEmail}) · {m.category || 'General'}
                        </p>
                      </div>
                      {canManageInbox ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            aria-label={`Estado de ${m.subject}`}
                            value={m.status}
                            onChange={(e) =>
                              apiRequest(`/api/contact-messages/${encodeURIComponent(m.id)}`, {
                                method: 'PATCH',
                                body: { status: e.target.value },
                              }).catch((err) =>
                                showToast(
                                  err instanceof ApiRequestError
                                    ? err.message
                                    : 'No se pudo actualizar el mensaje',
                                  'error'
                                )
                              )
                            }
                            className="min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px]"
                          >
                            <option value="nuevo">Nuevo</option>
                            <option value="en_proceso">En proceso</option>
                            <option value="respondido">Respondido</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setDeleteMsgTarget(m)}
                            title="Eliminar mensaje"
                            aria-label={`Eliminar mensaje ${m.subject}`}
                            className="min-h-[34px] rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold capitalize shrink-0">
                          {m.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{m.message}</p>
                  </div>
                ))}
              </div>
            )}

            <PaginationBar
              totalItems={filteredMessages.length}
              page={safeMsgPage}
              pageSize={pageSize}
              onPageChange={setMsgPage}
            />
          </div>
        ) : (
          <div className="cmj-card p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-700" /> Mensajes Ciudadanos
            </h3>
            <PermissionDeniedBanner permission="buzon.ver" />
          </div>
        )}
      </div>

      {/* Modal de respuestas ciudadanas */}
      <ResponsiveModal
        open={Boolean(viewingSurvey)}
        title={viewingSurvey?.title || 'Respuestas ciudadanas'}
        subtitle={viewingSurvey ? `Respuestas ciudadanas · ${viewingSurvey.kind}` : undefined}
        maxWidthClass="sm:max-w-2xl"
        onClose={() => setViewingSurvey(null)}
      >
        {viewingSurvey && (
          <div className="space-y-4">
            {surveyResponses.length > 0 && canExportSurveys && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExportSurveyResponses}
                  className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar respuestas (.xlsx)
                </button>
              </div>
            )}

            {loadingResponses ? (
              <p className="text-xs text-slate-500 py-4 text-center">Cargando respuestas...</p>
            ) : surveyResponses.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
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
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold truncate">{opt}</span>
                          <span className="font-mono-num font-bold text-emerald-700 dark:text-emerald-400">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4">
                  {surveyResponses.map((r) => (
                    <div key={r.id} className="py-2.5 text-xs space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {r.respondentName}{' '}
                          {r.respondentEmail && (
                            <span className="font-normal text-slate-500">({r.respondentEmail})</span>
                          )}
                        </span>
                        <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
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
      </ResponsiveModal>

      <ConfirmDialog
        open={Boolean(deleteSurveyTarget)}
        title="Eliminar consulta o convocatoria"
        description={
          deleteSurveyTarget
            ? `¿Seguro deseas eliminar "${deleteSurveyTarget.title}" y todas sus estadísticas visibles?`
            : ''
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDeleteSurvey}
        onCancel={() => setDeleteSurveyTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteMsgTarget)}
        title="Eliminar mensaje ciudadano"
        description={
          deleteMsgTarget
            ? `¿Deseas eliminar el mensaje "${deleteMsgTarget.subject}" de ${deleteMsgTarget.senderName}?`
            : ''
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDeleteMsg}
        onCancel={() => setDeleteMsgTarget(null)}
      />
    </div>
  );
}
export default SurveysAndMessagesModule;
