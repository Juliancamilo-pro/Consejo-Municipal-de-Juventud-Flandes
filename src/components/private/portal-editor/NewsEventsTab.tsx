import React, { useMemo, useState } from 'react';
import { CheckCircle2, Edit3, Newspaper, Plus, Save, Trash2 } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../../lib/apiClient';
import { deleteStorageFile } from '../../../lib/storageUtils';
import { useUnsavedChangesGuard } from '../../../lib/unsavedChanges';
import type { Commission, NewsEvent, RoleLabel } from '../../../types/cmj';
import { MediaUploader } from '../../MediaUploader';
import { useToast } from '../../ToastProvider';
import { EmptyState } from '../../ui/AnimatedPrimitives';
import { ConfirmDialog, DataToolbar, PaginationBar } from '../../ui/DataTableUI';
import { recordAudit } from '../auditHelper';
import { PermissionDeniedBanner, usePermissions } from '../PermissionGate';

export function NewsEventsTab({
  uid,
  actorName,
  actorRoleLabel,
  commissions,
  newsEvents,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  commissions: Commission[];
  newsEvents: NewsEvent[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canCreateNews = can('noticias.crear');
  const canProposeNews = can('noticias.proponer');
  const canPublishNews = can('noticias.publicar');
  const canDeleteNews = can('noticias.eliminar');

  // Crear
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsType, setNewsType] = useState<'noticia' | 'evento'>('noticia');
  const [newsSummary, setNewsSummary] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsComm, setNewsComm] = useState('');
  const [newsDate, setNewsDate] = useState('');
  const [newsLocation, setNewsLocation] = useState('');
  const [newsCoverUrl, setNewsCoverUrl] = useState('');
  const [newsStoragePath, setNewsStoragePath] = useState('');

  // Filtros y paginación
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'noticia' | 'evento'>('todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Editar
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [editNewsTitle, setEditNewsTitle] = useState('');
  const [editNewsType, setEditNewsType] = useState<'noticia' | 'evento'>('noticia');
  const [editNewsSummary, setEditNewsSummary] = useState('');
  const [editNewsContent, setEditNewsContent] = useState('');
  const [editNewsComm, setEditNewsComm] = useState('');
  const [editNewsDate, setEditNewsDate] = useState('');
  const [editNewsLocation, setEditNewsLocation] = useState('');
  const [editNewsStatus, setEditNewsStatus] = useState<'borrador' | 'pendiente' | 'publicado'>(
    'publicado'
  );
  const [editNewsCoverUrl, setEditNewsCoverUrl] = useState('');
  const [editNewsStoragePath, setEditNewsStoragePath] = useState('');

  // Eliminar
  const [deleteTarget, setDeleteTarget] = useState<NewsEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  useUnsavedChangesGuard(
    'news-events-tab',
    (showCreateForm &&
      Boolean(newsTitle.trim() || newsSummary.trim() || newsContent.trim())) ||
      Boolean(editingNewsId)
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return newsEvents.filter((n) => {
      if (typeFilter !== 'todos' && n.type !== typeFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        (n.location || '').toLowerCase().includes(q)
      );
    });
  }, [newsEvents, search, typeFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

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
          status: canPublishNews ? 'publicado' : 'pendiente',
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
      setNewsDate('');
      setNewsLocation('');
      setNewsCoverUrl('');
      setNewsStoragePath('');
      setShowCreateForm(false);
      showToast(
        canPublishNews
          ? 'Publicado en el portal ciudadano'
          : 'Enviado a revisión de Presidencia/Secretaría',
        'success'
      );
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo crear la noticia/evento';
      showToast(msg, 'error');
    }
  };

  const startEditNews = (n: NewsEvent) => {
    setEditingNewsId(n.id);
    setEditNewsTitle(n.title);
    setEditNewsType(n.type);
    setEditNewsSummary(n.summary);
    setEditNewsContent(n.content);
    setEditNewsComm(n.commissionId || '');
    setEditNewsDate(n.eventDate || '');
    setEditNewsLocation(n.location || '');
    setEditNewsStatus(n.status);
    setEditNewsCoverUrl(n.coverUrl || '');
    setEditNewsStoragePath(n.storagePath || '');
  };

  const handleSaveEditNews = async (n: NewsEvent) => {
    if (!editNewsTitle.trim() || !editNewsSummary.trim() || !editNewsContent.trim()) return;
    try {
      await apiRequest(`/api/news/${encodeURIComponent(n.id)}`, {
        method: 'PATCH',
        body: {
          title: editNewsTitle.trim(),
          type: editNewsType,
          summary: editNewsSummary.trim(),
          content: editNewsContent.trim(),
          commissionId: editNewsComm,
          eventDate: editNewsDate,
          location: editNewsLocation.trim(),
          coverUrl: editNewsCoverUrl,
          storagePath: editNewsStoragePath,
          ...(canPublishNews ? { status: editNewsStatus } : {}),
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: `Editó ${editNewsType}`,
        module: 'Noticias y Eventos',
        targetTitle: editNewsTitle.trim(),
      });
      setEditingNewsId(null);
      showToast('Publicación actualizada', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la publicación';
      showToast(msg, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStorageFile(deleteTarget.storagePath, deleteTarget.coverUrl);
      await apiRequest(`/api/news/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      showToast('Publicación y archivo eliminados', 'info');
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Error al eliminar';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="cmj-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            Noticias y Eventos Públicos ({newsEvents.length})
          </h3>
          <p className="text-xs text-slate-500">
            Redacta noticias institucionales o agenda eventos juveniles visibles en el portal público.
          </p>
        </div>
        {canCreateNews || canProposeNews ? (
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Cerrar formulario' : 'Nueva publicación'}
          </button>
        ) : (
          <PermissionDeniedBanner permission="noticias.crear" compact />
        )}
      </div>

      {!canPublishNews && (canCreateNews || canProposeNews) && (
        <PermissionDeniedBanner
          permission="noticias.publicar"
          compact
          customText="Las noticias nuevas quedan en estado pendiente hasta su publicación oficial."
        />
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreateNews}
          className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-slate-950 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={newsTitle}
              onChange={(e) => setNewsTitle(e.target.value)}
              placeholder="Titular"
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
            />
            <select
              value={newsType}
              onChange={(e) => setNewsType(e.target.value as 'noticia' | 'evento')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="noticia">Noticia</option>
              <option value="evento">Evento</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={newsComm}
              onChange={(e) => setNewsComm(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            >
              <option value="">General / Sin comisión</option>
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
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={newsLocation}
              onChange={(e) => setNewsLocation(e.target.value)}
              placeholder="Lugar (opcional)"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
          <input
            type="text"
            required
            value={newsSummary}
            onChange={(e) => setNewsSummary(e.target.value)}
            placeholder="Resumen corto para tarjeta"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs"
          />
          <textarea
            rows={3}
            required
            value={newsContent}
            onChange={(e) => setNewsContent(e.target.value)}
            placeholder="Desarrollo completo de la noticia o evento..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs"
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
            className="min-h-[40px] rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
          >
            {canPublishNews ? 'Publicar ahora' : 'Enviar para aprobación'}
          </button>
        </form>
      )}

      <DataToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar titular, resumen o lugar..."
      >
        <select
          aria-label="Filtrar por tipo"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as typeof typeFilter);
            setPage(1);
          }}
          className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
        >
          <option value="todos">Noticias y Eventos</option>
          <option value="noticia">Solo Noticias</option>
          <option value="evento">Solo Eventos</option>
        </select>
      </DataToolbar>

      {paginated.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Sin publicaciones"
          description="Publica una noticia o evento para el portal ciudadano."
        />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginated.map((n) => {
            const canEdit = canCreateNews || canPublishNews || n.authorUid === uid;
            const canDel = canDeleteNews || n.authorUid === uid;
            return (
              <div key={n.id} className="py-3 space-y-3 text-xs">
                {editingNewsId === n.id ? (
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-slate-950 p-4 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={editNewsTitle}
                        onChange={(e) => setEditNewsTitle(e.target.value)}
                        placeholder="Titular"
                        className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                      />
                      <select
                        value={editNewsType}
                        onChange={(e) =>
                          setEditNewsType(e.target.value as 'noticia' | 'evento')
                        }
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      >
                        <option value="noticia">Noticia</option>
                        <option value="evento">Evento</option>
                      </select>
                      <select
                        value={editNewsComm}
                        onChange={(e) => setEditNewsComm(e.target.value)}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      >
                        <option value="">General / Sin comisión</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editNewsDate}
                        onChange={(e) => setEditNewsDate(e.target.value)}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={editNewsLocation}
                        onChange={(e) => setEditNewsLocation(e.target.value)}
                        placeholder="Lugar"
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      value={editNewsSummary}
                      onChange={(e) => setEditNewsSummary(e.target.value)}
                      placeholder="Resumen"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                    />
                    <textarea
                      rows={3}
                      value={editNewsContent}
                      onChange={(e) => setEditNewsContent(e.target.value)}
                      placeholder="Contenido completo"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {canPublishNews && (
                          <select
                            value={editNewsStatus}
                            onChange={(e) =>
                              setEditNewsStatus(
                                e.target.value as 'borrador' | 'pendiente' | 'publicado'
                              )
                            }
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                          >
                            <option value="publicado">Publicado</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="borrador">Borrador</option>
                          </select>
                        )}
                        {editNewsCoverUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditNewsCoverUrl('');
                              setEditNewsStoragePath('');
                            }}
                            className="text-rose-500 hover:underline cursor-pointer"
                          >
                            Quitar foto
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingNewsId(null)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditNews(n)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 font-semibold text-white cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" /> Guardar cambios
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold uppercase text-emerald-700 dark:text-emerald-400">
                        {n.type} · {n.status}
                        {n.eventDate ? ` · ${n.eventDate}` : ''}
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canPublishNews && n.status !== 'publicado' && (
                        <button
                          type="button"
                          onClick={() =>
                            apiRequest(`/api/news/${encodeURIComponent(n.id)}`, {
                              method: 'PATCH',
                              body: { status: 'publicado' },
                            }).catch((err) => {
                              const msg =
                                err instanceof ApiRequestError
                                  ? err.message
                                  : 'No se pudo aprobar';
                              showToast(msg, 'error');
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-white font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEditNews(n)}
                          title="Editar publicación"
                          aria-label="Editar publicación"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 hover:border-emerald-600 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDel && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(n)}
                          aria-label="Eliminar publicación"
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        totalItems={filtered.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar publicación"
        description={`¿Confirmas eliminar "${deleteTarget?.title || ''}" y su imagen adjunta?`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
