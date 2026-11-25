import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, FolderPlus, GripVertical, Images, Save, Trash2 } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../../lib/apiClient';
import { deleteStorageFile } from '../../../lib/storageUtils';
import type { Commission, GalleryAlbum, GalleryItem } from '../../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../../MediaUploader';
import { useToast } from '../../ToastProvider';
import { EmptyState } from '../../ui/AnimatedPrimitives';
import { ConfirmDialog, DataToolbar, PaginationBar } from '../../ui/DataTableUI';
import { PermissionDeniedBanner, usePermissions } from '../PermissionGate';

export function GalleryManagerTab({
  uid,
  commissions,
  galleryItems,
  galleryAlbums,
}: {
  uid: string;
  commissions: Commission[];
  galleryItems: GalleryItem[];
  galleryAlbums: GalleryAlbum[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canManageGlobalGallery = can('galeria.gestionar');
  const canUploadOwnGallery = can('galeria.subir_propia');

  // Álbumes
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [albumDate, setAlbumDate] = useState('');
  const [albumComm, setAlbumComm] = useState('');

  // Subir multimedia
  const [galTitle, setGalTitle] = useState('');
  const [galDesc, setGalDesc] = useState('');
  const [galAlbumId, setGalAlbumId] = useState('');
  const [galCommId, setGalCommId] = useState('');
  const [galEventDate, setGalEventDate] = useState('');
  const [galVideoUrl, setGalVideoUrl] = useState('');

  // Filtros y paginación
  const [search, setSearch] = useState('');
  const [albumFilter, setAlbumFilter] = useState('todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Editar elemento
  const [editingGalId, setEditingGalId] = useState<string | null>(null);
  const [editGalTitle, setEditGalTitle] = useState('');
  const [editGalDesc, setEditGalDesc] = useState('');
  const [editGalComm, setEditGalComm] = useState('');
  const [editGalAlbumId, setEditGalAlbumId] = useState('');
  const [editGalStatus, setEditGalStatus] = useState<'publicado' | 'archivado'>('publicado');

  // Drag-and-Drop
  const [orderedGallery, setOrderedGallery] = useState<GalleryItem[]>(galleryItems);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Confirmaciones eliminar
  const [deleteAlbumTarget, setDeleteAlbumTarget] = useState<GalleryAlbum | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<GalleryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setOrderedGallery(galleryItems);
  }, [galleryItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orderedGallery.filter((g) => {
      if (albumFilter !== 'todos' && (g.albumId || '') !== albumFilter) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
      );
    });
  }, [orderedGallery, search, albumFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumTitle.trim()) return;
    try {
      const res = await apiRequest<{ id: string }>('/api/gallery-albums', {
        method: 'POST',
        body: {
          title: albumTitle.trim(),
          description: albumDesc.trim(),
          eventDate: albumDate,
          commissionId: albumComm,
          status: 'publicado',
        },
      });
      setGalAlbumId(res.id);
      setAlbumTitle('');
      setAlbumDesc('');
      setAlbumDate('');
      showToast('Álbum fotográfico creado', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo crear el álbum';
      showToast(msg, 'error');
    }
  };

  const handleConfirmDeleteAlbum = async () => {
    if (!deleteAlbumTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/gallery-albums/${encodeURIComponent(deleteAlbumTarget.id)}`, {
        method: 'DELETE',
      });
      if (galAlbumId === deleteAlbumTarget.id) setGalAlbumId('');
      showToast('Álbum eliminado', 'info');
      setDeleteAlbumTarget(null);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar el álbum';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleGalleryUpload = async (files: UploadedFileInfo[]) => {
    const canManageTarget = can('galeria.gestionar', galCommId || undefined);
    try {
      for (const f of files) {
        const isVideo = f.mimeType.startsWith('video/');
        await apiRequest('/api/gallery', {
          method: 'POST',
          body: {
            title: galTitle.trim() || f.fileName.replace(/\.[^.]+$/, ''),
            description: galDesc.trim(),
            mediaType: isVideo ? 'video' : 'image',
            videoSource: 'upload',
            url: f.url,
            thumbnailUrl: f.thumbnailUrl || f.thumbUrl || '',
            storagePath: f.storagePath || '',
            thumbnailStoragePath: f.thumbnailStoragePath || '',
            commissionId: galCommId,
            albumId: galAlbumId,
            eventDate: galEventDate,
            mimeType: f.mimeType,
            status: canManageTarget ? 'publicado' : 'archivado',
          },
        });
      }
      setGalTitle('');
      setGalDesc('');
      showToast(
        canManageTarget
          ? 'Multimedia publicada en galería'
          : 'Multimedia enviada para revisión de galería',
        'success'
      );
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo subir a la galería';
      showToast(msg, 'error');
    }
  };

  const handleAddExternalVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = galVideoUrl.trim();
    if (!url || !galTitle.trim()) return;
    const source = /vimeo\.com/i.test(url) ? 'vimeo' : 'youtube';
    const canManageTarget = can('galeria.gestionar', galCommId || undefined);
    try {
      await apiRequest('/api/gallery', {
        method: 'POST',
        body: {
          title: galTitle.trim(),
          description: galDesc.trim(),
          mediaType: 'video',
          videoSource: source,
          url,
          commissionId: galCommId,
          albumId: galAlbumId,
          eventDate: galEventDate,
          status: canManageTarget ? 'publicado' : 'archivado',
        },
      });
      setGalTitle('');
      setGalDesc('');
      setGalVideoUrl('');
      showToast(
        canManageTarget ? 'Video agregado a la galería' : 'Video enviado para revisión de galería',
        'success'
      );
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo publicar el enlace de video';
      showToast(msg, 'error');
    }
  };

  const handleDropGalleryItem = async (targetId: string) => {
    if (!draggedId || draggedId === targetId || !canManageGlobalGallery) return;
    const fromIdx = orderedGallery.findIndex((i) => i.id === draggedId);
    const toIdx = orderedGallery.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const copy = orderedGallery.slice();
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setOrderedGallery(copy);
    setDraggedId(null);
    try {
      await apiRequest('/api/gallery/reorder', {
        method: 'PATCH',
        body: { orderedIds: copy.map((i) => i.id) },
      });
      showToast('Orden de galería guardado', 'success');
    } catch (err) {
      setOrderedGallery(galleryItems);
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo guardar el orden';
      showToast(msg, 'error');
    }
  };

  const startEditGallery = (g: GalleryItem) => {
    setEditingGalId(g.id);
    setEditGalTitle(g.title);
    setEditGalDesc(g.description || '');
    setEditGalComm(g.commissionId || '');
    setEditGalAlbumId(g.albumId || '');
    setEditGalStatus(g.status);
  };

  const handleSaveEditGallery = async (g: GalleryItem) => {
    if (!editGalTitle.trim()) return;
    try {
      await apiRequest(`/api/gallery/${encodeURIComponent(g.id)}`, {
        method: 'PATCH',
        body: {
          title: editGalTitle.trim(),
          description: editGalDesc.trim(),
          commissionId: editGalComm,
          albumId: editGalAlbumId,
          ...(can('galeria.gestionar', g.commissionId || undefined) ? { status: editGalStatus } : {}),
        },
      });
      setEditingGalId(null);
      showToast('Elemento de galería actualizado', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la galería';
      showToast(msg, 'error');
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    setDeleting(true);
    try {
      await deleteStorageFile(deleteItemTarget.storagePath, deleteItemTarget.url);
      if (deleteItemTarget.thumbnailStoragePath) {
        await deleteStorageFile(deleteItemTarget.thumbnailStoragePath, deleteItemTarget.thumbnailUrl);
      }
      await apiRequest(`/api/gallery/${encodeURIComponent(deleteItemTarget.id)}`, {
        method: 'DELETE',
      });
      showToast('Elemento eliminado de galería y archivo', 'info');
      setDeleteItemTarget(null);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Error al eliminar';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="cmj-card p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Images className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Álbumes y Galería Multimedia Pública
        </h3>
      </div>

      {/* Crear Álbum */}
      {canManageGlobalGallery ? (
        <form
          onSubmit={handleCreateAlbum}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3"
        >
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <FolderPlus className="h-4 w-4 text-emerald-600" /> Nuevo álbum por evento o campaña
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Nombre del álbum (ej: Semana de la Juventud 2026)"
              className="sm:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={albumDesc}
              onChange={(e) => setAlbumDesc(e.target.value)}
              placeholder="Descripción breve"
              className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <select
              value={albumComm}
              onChange={(e) => setAlbumComm(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
            >
              <option value="">General</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={albumDate}
              onChange={(e) => setAlbumDate(e.target.value)}
              className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs"
            />
            <button
              type="submit"
              className="sm:col-span-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
            >
              Crear
            </button>
          </div>
          {galleryAlbums.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {galleryAlbums.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-[11px] font-semibold"
                >
                  <span>
                    {a.title}
                    {a.eventDate ? ` (${a.eventDate})` : ''}
                  </span>
                  {can('galeria.gestionar', a.commissionId || undefined) && (
                    <button
                      type="button"
                      onClick={() => setDeleteAlbumTarget(a)}
                      title="Eliminar álbum"
                      aria-label={`Eliminar álbum ${a.title}`}
                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </form>
      ) : (
        <PermissionDeniedBanner
          permission="galeria.gestionar"
          compact
          customText="Solo usuarios con gestión de galería pueden crear álbumes y publicar directamente."
        />
      )}

      {/* Subir fotos o videos */}
      {canManageGlobalGallery || canUploadOwnGallery || can('galeria.gestionar', galCommId || undefined) ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Subir fotos o videos a la galería pública
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={galTitle}
              onChange={(e) => setGalTitle(e.target.value)}
              placeholder="Título (o usa nombre del archivo)"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <select
              value={galAlbumId}
              onChange={(e) => setGalAlbumId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            >
              <option value="">Sin álbum</option>
              {galleryAlbums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <select
              value={galCommId}
              onChange={(e) => setGalCommId(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            >
              <option value="">General / Plenaria</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={galEventDate}
              onChange={(e) => setGalEventDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            />
          </div>
          <input
            type="text"
            value={galDesc}
            onChange={(e) => setGalDesc(e.target.value)}
            placeholder="Descripción o pie de foto (opcional)"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          />
          <MediaUploader
            storageFolder="public/gallery"
            imagePreset="gallery"
            multiple
            label="Subir fotos (WebP optimizado) o videos MP4"
            onUploaded={handleGalleryUpload}
          />
          <form onSubmit={handleAddExternalVideo} className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="url"
              value={galVideoUrl}
              onChange={(e) => setGalVideoUrl(e.target.value)}
              placeholder="O pega enlace de YouTube / Vimeo..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              Agregar video externo
            </button>
          </form>
        </div>
      ) : (
        <PermissionDeniedBanner permission="galeria.gestionar" />
      )}

      {/* Buscador y Lista con Drag-and-Drop Reorder */}
      <DataToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar foto o video..."
      >
        <select
          aria-label="Filtrar por álbum"
          value={albumFilter}
          onChange={(e) => {
            setAlbumFilter(e.target.value);
            setPage(1);
          }}
          className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
        >
          <option value="todos">Todos los álbumes</option>
          {galleryAlbums.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </DataToolbar>

      {paginated.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Sin elementos en galería"
          description="Sube fotografías o enlaza videos de YouTube/Vimeo para el portal público."
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Elementos publicados ({filtered.length})
            </p>
            {canManageGlobalGallery && (
              <p className="text-[11px] text-slate-500">
                Arrastra las filas para cambiar el orden público
              </p>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {paginated.map((g) => {
              const canManageItem = can('galeria.gestionar', g.commissionId || undefined);
              const canEditItem = canManageItem || g.authorUid === uid;
              return (
                <div
                  key={g.id}
                  draggable={canManageGlobalGallery && editingGalId !== g.id}
                  onDragStart={() => setDraggedId(g.id)}
                  onDragOver={(e) => {
                    if (canManageGlobalGallery) e.preventDefault();
                  }}
                  onDrop={() => handleDropGalleryItem(g.id)}
                  className={`py-2.5 space-y-2 transition-colors ${
                    draggedId === g.id ? 'opacity-50 bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                  }`}
                >
                  {editingGalId === g.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-slate-950 p-3">
                      <input
                        type="text"
                        value={editGalTitle}
                        onChange={(e) => setEditGalTitle(e.target.value)}
                        placeholder="Título"
                        className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={editGalDesc}
                        onChange={(e) => setEditGalDesc(e.target.value)}
                        placeholder="Descripción"
                        className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                      />
                      <select
                        value={editGalAlbumId}
                        onChange={(e) => setEditGalAlbumId(e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="">Sin álbum</option>
                        {galleryAlbums.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editGalComm}
                        onChange={(e) => setEditGalComm(e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="">General</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        disabled={!canManageItem}
                        value={editGalStatus}
                        onChange={(e) =>
                          setEditGalStatus(e.target.value as 'publicado' | 'archivado')
                        }
                        className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs disabled:opacity-60"
                      >
                        <option value="publicado">Publicado</option>
                        <option value="archivado">Archivado</option>
                      </select>
                      <div className="sm:col-span-12 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingGalId(null)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditGallery(g)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {canManageGlobalGallery && (
                          <GripVertical className="h-4 w-4 text-slate-400 cursor-grab shrink-0" />
                        )}
                        <span className="font-semibold truncate">
                          [{g.mediaType} · {g.status}] {g.title}
                        </span>
                        {g.albumId && (
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 shrink-0">
                            {galleryAlbums.find((a) => a.id === g.albumId)?.title || 'Álbum'}
                          </span>
                        )}
                      </div>
                      {canEditItem && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditGallery(g)}
                            className="text-slate-600 dark:text-slate-300 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteItemTarget(g)}
                            className="text-rose-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PaginationBar
            totalItems={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteAlbumTarget)}
        title="Eliminar álbum fotográfico"
        description={`¿Confirmas eliminar el álbum "${deleteAlbumTarget?.title || ''}"?`}
        confirmLabel="Sí, eliminar álbum"
        loading={deleting}
        onConfirm={handleConfirmDeleteAlbum}
        onCancel={() => setDeleteAlbumTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteItemTarget)}
        title="Eliminar elemento de galería"
        description={`¿Confirmas eliminar "${deleteItemTarget?.title || ''}" y su archivo multimedia?`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDeleteItem}
        onCancel={() => setDeleteItemTarget(null)}
      />
    </div>
  );
}
