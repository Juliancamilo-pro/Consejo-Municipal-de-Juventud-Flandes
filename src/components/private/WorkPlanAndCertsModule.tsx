import React, { useState } from 'react';
import { Award, Edit3, Printer, Save, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import type { AccessTier, Commission, WorkPlanItem } from '../../types/cmj';
import { useToast } from '../ToastProvider';

export function WorkPlanAndCertsModule({
  actorName,
  accessTier,
  commissions,
  workPlans,
}: {
  uid?: string;
  actorName: string;
  accessTier: AccessTier;
  commissions: Commission[];
  workPlans: WorkPlanItem[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [title, setTitle] = useState('');
  const [axis, setAxis] = useState('Eje Estratégico Juvenil');
  const [commissionId, setCommissionId] = useState('');
  const [quarter, setQuarter] = useState('2026-Q4');

  const [editingWpId, setEditingWpId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAxis, setEditAxis] = useState('');
  const [editCommId, setEditCommId] = useState('');
  const [editQuarter, setEditQuarter] = useState('');
  const [editStatus, setEditStatus] = useState<'planeado' | 'ejecucion' | 'completado'>('planeado');
  const [editProgress, setEditProgress] = useState(0);
  const [editEvidenceCount, setEditEvidenceCount] = useState(0);

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
          title: editTitle.trim(),
          axis: editAxis.trim(),
          commissionId: editCommId,
          quarter: editQuarter.trim() || '2026-Q4',
          status: editStatus,
          progress: Number(editProgress),
          evidenceCount: Number(editEvidenceCount),
        },
      });
      setEditingWpId(null);
      showToast('Meta actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la meta', 'error');
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
              <option value="">Plenaria / Sin comisión</option>
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
              className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              {editingWpId === wp.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 no-print">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Meta u objetivo"
                    className="sm:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={editAxis}
                    onChange={(e) => setEditAxis(e.target.value)}
                    placeholder="Eje"
                    className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                  <select
                    value={editCommId}
                    onChange={(e) => setEditCommId(e.target.value)}
                    className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
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
                    value={editQuarter}
                    onChange={(e) => setEditQuarter(e.target.value)}
                    placeholder="Periodo"
                    className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                  />
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as 'planeado' | 'ejecucion' | 'completado')
                    }
                    className="sm:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
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
                      className="w-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="sm:col-span-3 flex items-center gap-2 text-xs">
                    <span>Evidencias:</span>
                    <input
                      type="number"
                      min={0}
                      value={editEvidenceCount}
                      onChange={(e) => setEditEvidenceCount(Number(e.target.value))}
                      className="w-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs"
                    />
                  </label>
                  <div className="sm:col-span-3 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingWpId(null)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEditWp(wp)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" /> Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400">
                      {wp.axis} · {wp.quarter} ·{' '}
                      {commissions.find((c) => c.id === wp.commissionId)?.name || 'Plenaria / General'} ·{' '}
                      {wp.evidenceCount || 0} evidencias
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{wp.title}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
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
                      <>
                        <button
                          type="button"
                          onClick={() => startEditWp(wp)}
                          title="Editar meta"
                          className="no-print text-slate-600 dark:text-slate-300 hover:text-blue-600 p-1 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
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
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
export default WorkPlanAndCertsModule;
