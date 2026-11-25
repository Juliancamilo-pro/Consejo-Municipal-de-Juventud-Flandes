import React, { useMemo, useState } from 'react';
import { Award, Edit3, FileSpreadsheet, Printer, Save, Trash2 } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { exportStyledWorkbook } from '../../lib/excelExport';
import type { Commission, WorkPlanItem } from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { ConfirmDialog, DataToolbar, PaginationBar } from '../ui/DataTableUI';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

export function WorkPlanAndCertsModule({
  actorName,
  commissions,
  workPlans,
}: {
  actorName: string;
  commissions: Commission[];
  workPlans: WorkPlanItem[];
}) {
  const { showToast } = useToast();
  const { can, coordinatorCommissionIds } = usePermissions();
  const canCreateAny = can('plan_trabajo.crear');
  const canDeleteAny = can('plan_trabajo.eliminar');
  const canCreateGoal = canCreateAny || coordinatorCommissionIds.length > 0;
  const availableCreateCommissions = useMemo(
    () =>
      canCreateAny
        ? commissions
        : commissions.filter((c) => coordinatorCommissionIds.includes(c.id)),
    [canCreateAny, commissions, coordinatorCommissionIds]
  );

  const [title, setTitle] = useState('');
  const [axis, setAxis] = useState('Eje Estratégico Juvenil');
  const [commissionId, setCommissionId] = useState(() =>
    canCreateAny ? '' : coordinatorCommissionIds[0] || ''
  );
  const [quarter, setQuarter] = useState('2026-Q4');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'planeado' | 'ejecucion' | 'completado'>('all');
  const [commissionFilter, setCommissionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [exporting, setExporting] = useState(false);

  const [editingWpId, setEditingWpId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAxis, setEditAxis] = useState('');
  const [editCommId, setEditCommId] = useState('');
  const [editQuarter, setEditQuarter] = useState('');
  const [editStatus, setEditStatus] = useState<'planeado' | 'ejecucion' | 'completado'>('planeado');
  const [editProgress, setEditProgress] = useState(0);
  const [editEvidenceCount, setEditEvidenceCount] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<WorkPlanItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workPlans
      .filter((wp) => statusFilter === 'all' || wp.status === statusFilter)
      .filter((wp) => commissionFilter === 'all' || (wp.commissionId || '') === commissionFilter)
      .filter(
        (wp) =>
          !q ||
          wp.title.toLowerCase().includes(q) ||
          wp.axis.toLowerCase().includes(q) ||
          (wp.quarter || '').toLowerCase().includes(q)
      );
  }, [workPlans, search, statusFilter, commissionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedPlans = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      showToast('No hay metas en el filtro actual para exportar', 'info');
      return;
    }
    setExporting(true);
    try {
      const avgProgress = Math.round(
        filtered.reduce((acc, w) => acc + w.progress, 0) / filtered.length
      );
      await exportStyledWorkbook({
        fileName: `Plan_de_Trabajo_CMJ_${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle: 'Plan de Trabajo y Cumplimiento de Metas CMJ',
        moduleName: 'Plan de Trabajo',
        generatedBy: actorName,
        sheets: [
          {
            name: 'Plan de Trabajo',
            title: 'Seguimiento de Metas y Evidencias',
            kpis: [
              { label: 'Metas listadas', value: filtered.length },
              { label: 'Completadas', value: filtered.filter((w) => w.status === 'completado').length },
              { label: 'Avance promedio', value: `${avgProgress}%` },
            ],
            columns: [
              { key: 'meta', header: 'Meta / Objetivo', type: 'text', minWidth: 28, maxWidth: 46, wrap: true },
              { key: 'eje', header: 'Eje Temático', type: 'text', minWidth: 20, maxWidth: 30 },
              { key: 'comision', header: 'Comisión / Área', type: 'text', minWidth: 20, maxWidth: 32 },
              { key: 'periodo', header: 'Periodo', type: 'text', minWidth: 12, maxWidth: 14, align: 'center' },
              { key: 'estado', header: 'Estado', type: 'text', minWidth: 14, maxWidth: 18, align: 'center' },
              { key: 'avance', header: 'Avance %', type: 'percent', minWidth: 12, maxWidth: 14 },
              { key: 'evidencias', header: 'Evidencias', type: 'integer', minWidth: 12, maxWidth: 14 },
            ],
            rows: filtered.map((wp) => ({
              meta: wp.title,
              eje: wp.axis,
              comision:
                commissions.find((c) => c.id === wp.commissionId)?.name || 'Plenaria / General',
              periodo: wp.quarter || '—',
              estado:
                wp.status === 'completado'
                  ? 'Completado'
                  : wp.status === 'ejecucion'
                  ? 'En ejecución'
                  : 'Planeado',
              avance: wp.progress / 100,
              evidencias: wp.evidenceCount || 0,
            })),
          },
        ],
      });
      showToast('Plan de trabajo exportado a Excel', 'success');
    } catch {
      showToast('No se pudo generar el archivo Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

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
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo agregar la meta';
      showToast(msg, 'error');
    }
  };

  const startEditWp = (wp: WorkPlanItem) => {
    setEditingWpId(wp.id);
    setEditTitle(wp.title);
    setEditAxis(wp.axis);
    setEditCommId(wp.commissionId || '');
    setEditQuarter(wp.quarter || '2026-Q4');
    setEditStatus(wp.status);
    setEditProgress(wp.progress);
    setEditEvidenceCount(wp.evidenceCount || 0);
  };

  const handleSaveEditWp = async (wp: WorkPlanItem) => {
    if (!editTitle.trim() || !editAxis.trim()) return;
    try {
      await apiRequest(`/api/work-plans/${encodeURIComponent(wp.id)}`, {
        method: 'PATCH',
        body: {
          ...(canCreateAny
            ? {
                title: editTitle.trim(),
                axis: editAxis.trim(),
                commissionId: editCommId,
                quarter: editQuarter.trim() || '2026-Q4',
              }
            : {}),
          status: editStatus,
          progress: Number(editProgress),
          evidenceCount: Number(editEvidenceCount),
        },
      });
      setEditingWpId(null);
      showToast('Meta actualizada', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la meta';
      showToast(msg, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/work-plans/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      showToast('Meta eliminada del plan de trabajo', 'info');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo eliminar';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="cmj-card p-6 space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-700 dark:text-emerald-400" /> Plan de Trabajo y Cumplimiento
            </h2>
            <p className="text-xs text-slate-500">
              Registra metas por eje estratégico, controla evidencias y emite informes oficiales.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportExcel}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {exporting ? 'Exportando...' : 'Exportar Excel (.xlsx)'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" /> Certificado / PDF
            </button>
          </div>
        </div>

        {canCreateGoal ? (
          <form onSubmit={handleAddGoal} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meta u objetivo del plan"
              aria-label="Meta u objetivo"
              className="sm:col-span-5 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={axis}
              onChange={(e) => setAxis(e.target.value)}
              placeholder="Eje temático"
              aria-label="Eje temático"
              className="sm:col-span-3 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <select
              value={commissionId || (!canCreateAny ? availableCreateCommissions[0]?.id || '' : '')}
              onChange={(e) => setCommissionId(e.target.value)}
              aria-label="Comisión"
              className="sm:col-span-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs"
            >
              {canCreateAny && <option value="">Plenaria / Sin comisión</option>}
              {availableCreateCommissions.map((c) => (
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
                aria-label="Periodo"
                className="w-20 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-2 text-xs"
              />
              <button
                type="submit"
                className="flex-1 min-h-[40px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                +
              </button>
            </div>
          </form>
        ) : (
          <PermissionDeniedBanner
            permission="plan_trabajo.crear"
            customText="No tienes permiso para registrar nuevas metas en el plan de trabajo general."
          />
        )}
      </div>

      <div className="cmj-card p-6 space-y-4">
        <div className="hidden print:block border-b border-slate-300 pb-3 mb-3">
          <h3 className="text-lg font-extrabold">
            Certificado de Cumplimiento Plan de Trabajo · CMJ Flandes
          </h3>
          <p className="text-xs">Emitido por {actorName}</p>
        </div>

        <div className="no-print">
          <DataToolbar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            searchPlaceholder="Buscar meta, eje o periodo..."
          >
            <select
              aria-label="Filtrar estado"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(
                  e.target.value as 'all' | 'planeado' | 'ejecucion' | 'completado'
                );
                setPage(1);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="all">Todos los estados</option>
              <option value="planeado">Planeado</option>
              <option value="ejecucion">En ejecución</option>
              <option value="completado">Completado</option>
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
        </div>

        {pagedPlans.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No hay metas cargadas que coincidan con el filtro.
          </p>
        ) : (
          <div className="space-y-3">
            {pagedPlans.map((wp) => {
              const canEditWp = can('plan_trabajo.editar', wp.commissionId || undefined);
              return (
                <div
                  key={wp.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  {editingWpId === wp.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 no-print">
                      <input
                        type="text"
                        disabled={!canCreateAny}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Meta u objetivo"
                        className="sm:col-span-5 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs disabled:opacity-60"
                      />
                      <input
                        type="text"
                        disabled={!canCreateAny}
                        value={editAxis}
                        onChange={(e) => setEditAxis(e.target.value)}
                        placeholder="Eje"
                        className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs disabled:opacity-60"
                      />
                      <select
                        disabled={!canCreateAny}
                        value={editCommId}
                        onChange={(e) => setEditCommId(e.target.value)}
                        className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs disabled:opacity-60"
                      >
                        <option value="">Plenaria / Sin comisión</option>
                        {commissions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        disabled={!canCreateAny}
                        value={editQuarter}
                        onChange={(e) => setEditQuarter(e.target.value)}
                        placeholder="Periodo"
                        className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs disabled:opacity-60"
                      />
                      <select
                        value={editStatus}
                        onChange={(e) =>
                          setEditStatus(e.target.value as 'planeado' | 'ejecucion' | 'completado')
                        }
                        className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      >
                        <option value="planeado">Planeado</option>
                        <option value="ejecucion">En ejecución</option>
                        <option value="completado">Completado</option>
                      </select>
                      <label className="sm:col-span-3 flex items-center gap-2 text-xs">
                        <span>Avance:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editProgress}
                          onChange={(e) => setEditProgress(Number(e.target.value))}
                          className="w-16 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
                        />
                      </label>
                      <label className="sm:col-span-3 flex items-center gap-2 text-xs">
                        <span>Evidencias:</span>
                        <input
                          type="number"
                          min={0}
                          value={editEvidenceCount}
                          onChange={(e) => setEditEvidenceCount(Number(e.target.value))}
                          className="w-16 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
                        />
                      </label>
                      <div className="sm:col-span-3 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingWpId(null)}
                          className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditWp(wp)}
                          className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Save className="h-3.5 w-3.5" /> Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {wp.axis} · {wp.quarter} ·{' '}
                          {commissions.find((c) => c.id === wp.commissionId)?.name || 'Plenaria / General'} ·{' '}
                          {wp.evidenceCount || 0} evidencias
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{wp.title}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <input
                          type="range"
                          aria-label={`Avance de ${wp.title}`}
                          disabled={!canEditWp}
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
                            }).catch((err) => {
                              const msg =
                                err instanceof ApiRequestError
                                  ? err.message
                                  : 'No se pudo actualizar el avance';
                              showToast(msg, 'error');
                            });
                          }}
                          className={`w-28 accent-emerald-700 no-print ${
                            canEditWp ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                          }`}
                        />
                        <span className="font-mono-num text-xs font-extrabold w-10 text-right">
                          {wp.progress}%
                        </span>
                        {canEditWp && (
                          <button
                            type="button"
                            onClick={() => startEditWp(wp)}
                            title="Editar meta"
                            aria-label={`Editar ${wp.title}`}
                            className="no-print text-slate-600 dark:text-slate-300 hover:text-blue-600 p-1.5 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteAny && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(wp)}
                            aria-label={`Eliminar ${wp.title}`}
                            className="no-print text-rose-500 p-1.5 cursor-pointer"
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
          page={safePage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar meta del plan"
        description={
          deleteTarget
            ? `¿Seguro deseas eliminar "${deleteTarget.title}" del Plan de Trabajo?`
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
export default WorkPlanAndCertsModule;
