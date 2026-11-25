import React, { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Edit3, FileSpreadsheet, Trash2, X } from 'lucide-react';
import { apiRequest } from '../../../lib/apiClient';
import { exportStyledWorkbook } from '../../../lib/excelExport';
import type { Commission, Commitment, PublicCouncilor } from '../../../types/cmj';
import { useToast } from '../../ToastProvider';
import { EmptyState } from '../../ui/AnimatedPrimitives';
import { ConfirmDialog, DataToolbar, PaginationBar } from '../../ui/DataTableUI';
import { PermissionDeniedBanner, usePermissions } from '../PermissionGate';

export function CommitmentsSection({
  uid,
  actorName,
  isLeader: _isLeader,
  commissions,
  activeCouncilors,
  publicCouncilors,
  commitments,
}: {
  uid: string;
  actorName: string;
  isLeader: boolean;
  commissions: Commission[];
  activeCouncilors: PublicCouncilor[];
  publicCouncilors: PublicCouncilor[];
  commitments: Commitment[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canCreateComp = can('compromisos.crear');
  const canEditAllComp = can('compromisos.editar_todos');
  const canDeleteComp = can('compromisos.eliminar');

  // Nuevo compromiso
  const [compTitle, setCompTitle] = useState('');
  const [compRespUid, setCompRespUid] = useState(uid);
  const [compCommId, setCompCommId] = useState('');
  const [compDue, setCompDue] = useState('');

  // Filtros y paginación
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | Commitment['status']>('todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Editar compromiso
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [editCompTitle, setEditCompTitle] = useState('');
  const [editCompRespUid, setEditCompRespUid] = useState('');
  const [editCompCommId, setEditCompCommId] = useState('');
  const [editCompDue, setEditCompDue] = useState('');

  // Confirmar eliminación
  const [deleteTarget, setDeleteTarget] = useState<Commitment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commitments.filter((c) => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.responsibleName.toLowerCase().includes(q)
      );
    });
  }, [commitments, search, statusFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/commitments/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      showToast('Compromiso eliminado', 'info');
      setDeleteTarget(null);
    } catch {
      showToast('No se pudo eliminar el compromiso', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCommitmentsExcel = async () => {
    await exportStyledWorkbook({
      fileName: `CMJ_Flandes_Compromisos_${new Date().toISOString().slice(0, 10)}.xlsx`,
      reportTitle: 'Seguimiento de Compromisos Institucionales',
      moduleName: 'Votaciones y Compromisos',
      generatedBy: actorName,
      sheets: [
        {
          name: 'Compromisos',
          title: 'Matriz de Seguimiento de Compromisos CMJ',
          kpis: [
            { label: 'Total compromisos', value: filtered.length },
            { label: 'Cumplidos', value: filtered.filter((c) => c.status === 'cumplido').length },
            { label: 'Pendientes', value: filtered.filter((c) => c.status === 'pendiente').length },
          ],
          columns: [
            { key: 'titulo', header: 'Compromiso / Acuerdo', type: 'text', minWidth: 34, wrap: true },
            { key: 'responsable', header: 'Responsable', type: 'text', minWidth: 22 },
            { key: 'comision', header: 'Comisión', type: 'text', minWidth: 22 },
            { key: 'estado', header: 'Estado', type: 'text', minWidth: 14 },
            { key: 'avance', header: 'Avance', type: 'percent', minWidth: 12 },
            { key: 'limite', header: 'Fecha límite', type: 'date', minWidth: 14 },
          ],
          rows: filtered.map((c) => ({
            titulo: c.title,
            responsable: c.responsibleName,
            comision:
              commissions.find((cm) => cm.id === c.commissionId)?.name || 'Plenaria General',
            estado: c.status.replace('_', ' ').toUpperCase(),
            avance: (c.progress ?? 0) / 100,
            limite: c.dueDate || '',
          })),
        },
      ],
    });
    showToast('Compromisos exportados a Excel', 'success');
  };

  return (
    <div className="cmj-card p-6 space-y-4 no-print">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            Seguimiento de Compromisos
          </h2>
          <p className="text-xs text-slate-500">
            Compromisos derivados de sesiones, comisiones y Mesa Directiva.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCommitmentsExcel}
          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
        </button>
      </div>

      {canCreateComp ? (
        <form onSubmit={handleCreateCommitment} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <input
            type="text"
            required
            value={compTitle}
            onChange={(e) => setCompTitle(e.target.value)}
            placeholder="Nuevo compromiso..."
            className="sm:col-span-5 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          />
          <select
            aria-label="Responsable del compromiso"
            value={compRespUid}
            onChange={(e) => setCompRespUid(e.target.value)}
            className="sm:col-span-3 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
          >
            {activeCouncilors.map((c) => (
              <option key={c.uid} value={c.uid}>
                {c.fullName}
              </option>
            ))}
          </select>
          <select
            aria-label="Comisión del compromiso"
            value={compCommId}
            onChange={(e) => setCompCommId(e.target.value)}
            className="sm:col-span-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
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
              aria-label="Fecha límite"
              value={compDue}
              onChange={(e) => setCompDue(e.target.value)}
              className="flex-1 min-w-0 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs"
            />
            <button
              type="submit"
              aria-label="Agregar compromiso"
              className="min-h-[40px] rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
            >
              +
            </button>
          </div>
        </form>
      ) : (
        <PermissionDeniedBanner
          permission="compromisos.crear"
          compact
          customText="Puedes actualizar el avance de tus compromisos asignados o solicitar permiso para crear nuevos."
        />
      )}

      <DataToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar compromiso o responsable..."
      >
        <select
          aria-label="Filtrar estado de compromiso"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="en_progreso">En progreso</option>
          <option value="cumplido">Cumplidos</option>
        </select>
      </DataToolbar>

      {paginated.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Sin compromisos registrados"
          description="Asigna compromisos desde aquí o ajusta los filtros de búsqueda."
        />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginated.map((c) => {
            const canEdit =
              canEditAllComp || (c.responsibleUid === uid && c.status !== 'cumplido');
            const isEditingComp = editingCompId === c.id;
            return (
              <div key={c.id} className="py-3 space-y-2">
                {isEditingComp && canEditAllComp ? (
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
                        aria-label="Guardar compromiso"
                        onClick={() => handleSaveCompEdit(c)}
                        className="rounded-lg bg-emerald-700 p-1.5 text-white cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancelar edición"
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
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {c.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Responsable: {c.responsibleName}
                        {c.dueDate ? ` · Límite ${c.dueDate}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label={`Estado de ${c.title}`}
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
                        className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_progreso">En progreso</option>
                        <option value="cumplido">Cumplido</option>
                      </select>
                      <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400 w-10 text-right">
                        {c.progress}%
                      </span>
                      {canEditAllComp && (
                        <button
                          type="button"
                          onClick={() => startEditComp(c)}
                          title="Editar compromiso"
                          aria-label="Editar compromiso"
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-700 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDeleteComp && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          aria-label="Eliminar compromiso"
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
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
        title="Eliminar compromiso"
        description={`¿Confirmas eliminar el compromiso "${deleteTarget?.title || ''}"?`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
