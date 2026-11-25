import React, { useMemo, useState } from 'react';
import { Edit3, FileSpreadsheet, Lightbulb, Save, ThumbsUp, Trash2 } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { exportStyledWorkbook } from '../../lib/excelExport';
import type { AccessTier, Commission, IdeaItem, PublicCouncilor, RoleLabel } from '../../types/cmj';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { ConfirmDialog, DataToolbar, PaginationBar } from '../ui/DataTableUI';
import { recordAudit } from './auditHelper';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

export function IdeasBankModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier: _accessTier,
  commissions,
  ideas,
  publicCouncilors = [],
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  commissions: Commission[];
  ideas: IdeaItem[];
  publicCouncilors?: PublicCouncilor[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canCreateIdea = can('ideas.crear');
  const canVoteIdea = can('ideas.votar');
  const canModerateIdeas = can('ideas.moderar');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Participación');
  const [commissionId, setCommissionId] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'nueva' | 'en_revision' | 'aprobada'>('all');
  const [commissionFilter, setCommissionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [exporting, setExporting] = useState(false);

  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCommissionId, setEditCommissionId] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<IdeaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas
      .filter((i) => statusFilter === 'all' || i.status === statusFilter)
      .filter((i) => commissionFilter === 'all' || (i.commissionId || '') === commissionFilter)
      .filter(
        (i) =>
          !q ||
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.authorName.toLowerCase().includes(q) ||
          (i.category || '').toLowerCase().includes(q)
      );
  }, [ideas, search, statusFilter, commissionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedIdeas = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      showToast('No hay ideas en el filtro actual para exportar', 'info');
      return;
    }
    setExporting(true);
    try {
      await exportStyledWorkbook({
        fileName: `Banco_de_Ideas_CMJ_${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle: 'Banco Colaborativo de Ideas e Iniciativas Juveniles',
        moduleName: 'Buzón de Ideas',
        generatedBy: actorName,
        sheets: [
          {
            name: 'Iniciativas',
            title: 'Listado de Iniciativas Juveniles',
            kpis: [
              { label: 'Total ideas', value: filtered.length },
              { label: 'Aprobadas', value: filtered.filter((i) => i.status === 'aprobada').length },
            ],
            columns: [
              { key: 'titulo', header: 'Iniciativa', type: 'text', minWidth: 24, maxWidth: 40, wrap: true },
              { key: 'categoria', header: 'Categoría', type: 'text', minWidth: 16, maxWidth: 22 },
              { key: 'comision', header: 'Comisión', type: 'text', minWidth: 20, maxWidth: 32 },
              { key: 'estado', header: 'Estado', type: 'text', minWidth: 14, maxWidth: 16, align: 'center' },
              { key: 'apoyos', header: 'Apoyos', type: 'integer', minWidth: 10, maxWidth: 12 },
              { key: 'autor', header: 'Autor(a)', type: 'text', minWidth: 18, maxWidth: 28 },
              { key: 'descripcion', header: 'Impacto Esperado', type: 'text', minWidth: 32, maxWidth: 50, wrap: true },
            ],
            rows: filtered.map((i) => ({
              titulo: i.title,
              categoria: i.category || 'Participación',
              comision: commissions.find((c) => c.id === i.commissionId)?.name || 'General',
              estado:
                i.status === 'aprobada'
                  ? 'Aprobada'
                  : i.status === 'en_revision'
                  ? 'En revisión'
                  : 'Nueva',
              apoyos: i.upvoterUids.length,
              autor: i.authorName,
              descripcion: i.description,
            })),
          },
        ],
      });
      showToast('Banco de ideas exportado a Excel', 'success');
    } catch {
      showToast('No se pudo exportar el archivo Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

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
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo publicar la idea';
      showToast(msg, 'error');
    }
  };

  const startEditIdea = (idea: IdeaItem) => {
    setEditingIdeaId(idea.id);
    setEditTitle(idea.title);
    setEditDescription(idea.description);
    setEditCategory(idea.category || 'Participación');
    setEditCommissionId(idea.commissionId || '');
  };

  const handleSaveEditIdea = async (idea: IdeaItem) => {
    if (!editTitle.trim() || !editDescription.trim()) return;
    try {
      await apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory.trim() || 'Participación',
          commissionId: editCommissionId,
        },
      });
      setEditingIdeaId(null);
      showToast('Iniciativa actualizada', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la idea';
      showToast(msg, 'error');
    }
  };

  const handleToggleVote = async (idea: IdeaItem) => {
    try {
      await apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}/upvote`, {
        method: 'POST',
      });
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo registrar apoyo';
      showToast(msg, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/ideas/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      showToast('Iniciativa eliminada', 'info');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="cmj-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" /> Banco Colaborativo de Ideas
          </h2>
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportExcel}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            {exporting ? 'Exportando...' : 'Exportar Excel (.xlsx)'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título de tu iniciativa"
            aria-label="Título de la iniciativa"
            className="sm:col-span-2 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
          />
          <select
            value={commissionId}
            onChange={(e) => setCommissionId(e.target.value)}
            aria-label="Comisión asociada"
            className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">General / Sin comisión</option>
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
            aria-label="Categoría"
            className="sm:w-56 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe brevemente el impacto esperado en Flandes..."
            aria-label="Impacto esperado"
            className="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={!canCreateIdea}
            className="min-h-[40px] rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
          >
            Publicar idea
          </button>
        </div>
        {!canModerateIdeas && (
          <PermissionDeniedBanner
            permission="ideas.moderar"
            compact
            customText="Solo Mesa Directiva modera estados de iniciativas."
          />
        )}
      </form>

      <div className="cmj-card p-6 space-y-4">
        <DataToolbar
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Buscar iniciativa, autor o categoría..."
        >
          <select
            aria-label="Filtrar estado"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'nueva' | 'en_revision' | 'aprobada');
              setPage(1);
            }}
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="all">Todos los estados</option>
            <option value="nueva">Nueva</option>
            <option value="en_revision">En revisión</option>
            <option value="aprobada">Aprobada</option>
          </select>
          <select
            aria-label="Filtrar comisión"
            value={commissionFilter}
            onChange={(e) => {
              setCommissionFilter(e.target.value);
              setPage(1);
            }}
            className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            <option value="all">Todas las comisiones</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </DataToolbar>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pagedIdeas.length === 0 ? (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
              No hay iniciativas que coincidan con el filtro actual.
            </div>
          ) : (
            pagedIdeas.map((idea) => {
              const upvoted = idea.upvoterUids.includes(uid);
              const canEdit = canModerateIdeas || idea.authorUid === uid;
              const commName =
                commissions.find((c) => c.id === idea.commissionId)?.name || 'General';
              const author = publicCouncilors.find((c) => c.uid === idea.authorUid);

              return (
                <div
                  key={idea.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
                >
                  {editingIdeaId === idea.id ? (
                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Título"
                        className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="Categoría"
                          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                        />
                        <select
                          value={editCommissionId}
                          onChange={(e) => setEditCommissionId(e.target.value)}
                          className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        >
                          <option value="">General / Sin comisión</option>
                          {commissions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingIdeaId(null)}
                          className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditIdea(idea)}
                          className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                            {idea.category} · {commName} · {idea.status.replace('_', ' ')}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                            {idea.title}
                          </h3>
                        </div>
                        <button
                          type="button"
                          disabled={!canVoteIdea}
                          onClick={() => handleToggleVote(idea)}
                          aria-label={`Apoyar ${idea.title}`}
                          className={`min-h-[36px] inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer shrink-0 disabled:opacity-50 ${
                            upvoted
                              ? 'bg-emerald-700 text-white'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> {idea.upvoterUids.length}
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{idea.description}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <AvatarBadge
                            name={author?.fullName || idea.authorName}
                            photoUrl={author?.photoUrl}
                            thumbUrl={author?.photoThumbUrl}
                            size="xs"
                          />
                          <span className="truncate">Por {idea.authorName}</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {canModerateIdeas && (
                            <select
                              aria-label={`Estado de ${idea.title}`}
                              value={idea.status}
                              onChange={(e) =>
                                apiRequest(`/api/ideas/${encodeURIComponent(idea.id)}`, {
                                  method: 'PATCH',
                                  body: { status: e.target.value },
                                }).catch((err) =>
                                  showToast(
                                    err instanceof ApiRequestError
                                      ? err.message
                                      : 'No se pudo actualizar el estado',
                                    'error'
                                  )
                                )
                              }
                              className="min-h-[32px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px]"
                            >
                              <option value="nueva">Nueva</option>
                              <option value="en_revision">En revisión</option>
                              <option value="aprobada">Aprobada</option>
                            </select>
                          )}
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditIdea(idea)}
                                title="Editar idea"
                                aria-label={`Editar ${idea.title}`}
                                className="text-slate-600 dark:text-slate-300 hover:text-blue-600 p-1 cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(idea)}
                                aria-label={`Eliminar ${idea.title}`}
                                className="text-rose-500 p-1 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <PaginationBar
          totalItems={filtered.length}
          page={safePage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[6, 12, 24]}
        />
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar iniciativa del buzón"
        description={
          deleteTarget
            ? `¿Seguro deseas eliminar la iniciativa "${deleteTarget.title}"?`
            : ''
        }
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
export default IdeasBankModule;
