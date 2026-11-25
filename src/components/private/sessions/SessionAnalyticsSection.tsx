import React from 'react';
import { BarChart3, ClipboardList, FileSpreadsheet } from 'lucide-react';
import { exportStyledWorkbook } from '../../../lib/excelExport';
import type { Commission, CouncilSession, PublicCouncilor } from '../../../types/cmj';
import { AvatarBadge } from '../../public/AvatarBadge';
import { useToast } from '../../ToastProvider';
import { ATT_LABELS } from './sessionShared';

export interface CouncilorAttendanceStat {
  councilor: PublicCouncilor;
  recordedCount: number;
  attended: number;
  excuses: number;
  absences: number;
  pct: number;
  consecutiveAbsences: number;
}

export function SessionAnalyticsSection({
  actorName,
  commissions,
  statsPeriodFilter,
  statsCommissionFilter,
  onPeriodChange,
  onCommissionChange,
  councilorStats,
  sessionTrend,
  filteredSessionsForStats,
  filteredCouncilorsForStats,
  activeCouncilors,
}: {
  actorName: string;
  commissions: Commission[];
  statsPeriodFilter: 'all' | '30d' | '90d' | 'year';
  statsCommissionFilter: string;
  onPeriodChange: (v: 'all' | '30d' | '90d' | 'year') => void;
  onCommissionChange: (v: string) => void;
  councilorStats: CouncilorAttendanceStat[];
  sessionTrend: { id: string; label: string; title: string; present: number; pct: number }[];
  filteredSessionsForStats: CouncilSession[];
  filteredCouncilorsForStats: PublicCouncilor[];
  activeCouncilors: PublicCouncilor[];
}) {
  const { showToast } = useToast();

  const handleExportAttendanceExcel = async () => {
    const avgPct = councilorStats.length
      ? councilorStats.reduce((acc, s) => acc + s.pct, 0) / councilorStats.length / 100
      : 0;

    const consolidadoRows = councilorStats.map((st, idx) => ({
      pos: idx + 1,
      consejero: st.councilor.fullName,
      cargo: st.councilor.roleLabel,
      comision: st.councilor.commissionName || 'Sin comisión',
      asistencias: st.attended,
      excusas: st.excuses,
      ausencias: st.absences,
      registradas: st.recordedCount,
      cumplimiento: st.pct / 100,
      consecutivas: st.consecutiveAbsences,
    }));

    const sessionCols = filteredSessionsForStats.map((s, i) => ({
      key: `s_${i}`,
      header: `${s.dateIso} · ${s.title.slice(0, 18)}`,
      type: 'text' as const,
      minWidth: 16,
      maxWidth: 24,
      align: 'center' as const,
    }));

    const matrixRows = activeCouncilors.map((c) => {
      const row: Record<string, unknown> = {
        consejero: c.fullName,
        cargo: c.roleLabel,
        comision: c.commissionName || 'Sin comisión',
      };
      filteredSessionsForStats.forEach((s, i) => {
        row[`s_${i}`] = s.attendance?.[c.uid]?.toUpperCase() || 'SIN REGISTRO';
      });
      return row;
    });

    await exportStyledWorkbook({
      fileName: `CMJ_Flandes_Asistencia_${new Date().toISOString().slice(0, 10)}.xlsx`,
      reportTitle: 'Informe Oficial de Asistencia y Quórum',
      moduleName: 'Sesiones y Asistencia',
      generatedBy: actorName,
      includeSummarySheet: true,
      sheets: [
        {
          name: 'Consolidado',
          title: 'Consolidado de Cumplimiento por Consejero',
          kpis: [
            { label: 'Consejeros evaluados', value: consolidadoRows.length },
            { label: 'Sesiones analizadas', value: filteredSessionsForStats.length },
            { label: 'Promedio asistencia', value: `${Math.round(avgPct * 100)}%` },
          ],
          columns: [
            { key: 'pos', header: '#', type: 'integer', minWidth: 8 },
            { key: 'consejero', header: 'Consejero(a)', type: 'text', minWidth: 24 },
            { key: 'cargo', header: 'Cargo', type: 'text', minWidth: 15 },
            { key: 'comision', header: 'Comisión', type: 'text', minWidth: 22 },
            { key: 'asistencias', header: 'Asistencias', type: 'integer', minWidth: 13 },
            { key: 'excusas', header: 'Excusas', type: 'integer', minWidth: 11 },
            { key: 'ausencias', header: 'Ausencias', type: 'integer', minWidth: 12 },
            { key: 'registradas', header: 'Sesiones reg.', type: 'integer', minWidth: 14 },
            { key: 'cumplimiento', header: 'Cumplimiento', type: 'percent', minWidth: 15 },
            { key: 'consecutivas', header: 'Aus. seguidas', type: 'integer', minWidth: 14 },
          ],
          rows: consolidadoRows,
        },
        {
          name: 'Matriz Asistencia',
          title: 'Matriz Detallada por Sesión',
          columns: [
            { key: 'consejero', header: 'Consejero(a)', type: 'text', minWidth: 24 },
            { key: 'cargo', header: 'Cargo', type: 'text', minWidth: 15 },
            { key: 'comision', header: 'Comisión', type: 'text', minWidth: 22 },
            ...sessionCols,
          ],
          rows: matrixRows,
        },
      ],
    });
    showToast('Reporte Excel profesional descargado', 'success');
  };

  return (
    <div className="cmj-card p-6 space-y-6 no-print">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            Analítica de Asistencia y Mapa de Calor
          </h3>
          <p className="text-xs text-slate-500">
            Seguimiento por consejero, comisión y periodo con exportación directa a Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por periodo"
            value={statsPeriodFilter}
            onChange={(e) => onPeriodChange(e.target.value as typeof statsPeriodFilter)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          >
            <option value="all">Todo el periodo</option>
            <option value="30d">Últimos 30 días</option>
            <option value="90d">Últimos 90 días</option>
            <option value="year">Año vigente</option>
          </select>
          <select
            aria-label="Filtrar por comisión"
            value={statsCommissionFilter}
            onChange={(e) => onCommissionChange(e.target.value)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          >
            <option value="todas">Todas las comisiones</option>
            {commissions.map((cm) => (
              <option key={cm.id} value={cm.id}>
                {cm.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExportAttendanceExcel}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
          </button>
        </div>
      </div>

      {sessionTrend.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Tendencia de quórum y asistencia (% por sesión)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 items-end h-32 pt-4">
            {sessionTrend.map((pt) => (
              <div key={pt.id} className="flex flex-col items-center gap-1 h-full justify-end">
                <span className="font-mono-num text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {pt.pct}%
                </span>
                <div className="w-full max-w-[34px] h-20 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-end overflow-hidden">
                  <div
                    title={`${pt.title}: ${pt.pct}%`}
                    className="w-full rounded-t-md bg-gradient-to-t from-emerald-700 to-teal-500 transition-all duration-300"
                    style={{ height: `${Math.max(4, pt.pct)}%` }}
                  />
                </div>
                <span className="font-mono-num text-[10px] text-slate-500 truncate max-w-full">
                  {pt.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {councilorStats.map(
          ({ councilor, recordedCount, attended, absences, consecutiveAbsences, pct }) => (
            <div
              key={councilor.uid}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarBadge
                    name={councilor.fullName}
                    photoUrl={councilor.photoUrl}
                    thumbUrl={councilor.photoThumbUrl}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {councilor.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {attended}/{recordedCount} asistencias · {absences} aus.
                    </p>
                  </div>
                </div>
                <span
                  className={`font-mono-num text-sm font-extrabold ${
                    pct >= 80
                      ? 'text-emerald-600'
                      : pct >= 60
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    pct >= 80 ? 'bg-emerald-600' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {consecutiveAbsences >= 2 && (
                <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  Alerta: {consecutiveAbsences} inasistencias consecutivas
                </p>
              )}
            </div>
          )
        )}
      </div>

      {filteredSessionsForStats.length > 0 && filteredCouncilorsForStats.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-emerald-600" />
              Matriz / Mapa de Calor (últimas {Math.min(12, filteredSessionsForStats.length)} sesiones)
            </p>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-emerald-600 inline-block" /> P
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-amber-400 inline-block" /> T
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-blue-500 inline-block" /> E
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-rose-500 inline-block" /> A
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr>
                  <th className="py-1.5 px-2 text-left font-semibold text-slate-500">Consejero</th>
                  {filteredSessionsForStats.slice(-12).map((s) => (
                    <th
                      key={s.id}
                      title={s.title}
                      className="py-1.5 px-1 text-center font-mono-num text-slate-400"
                    >
                      {s.dateIso.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCouncilorsForStats.map((c) => (
                  <tr key={c.uid}>
                    <td className="py-1.5 px-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                      {c.fullName}
                    </td>
                    {filteredSessionsForStats.slice(-12).map((s) => {
                      const st = s.attendance?.[c.uid];
                      const meta = st ? ATT_LABELS[st] : null;
                      return (
                        <td key={s.id} className="py-1 px-1 text-center">
                          <span
                            title={
                              meta ? `${s.title}: ${meta.label}` : `${s.title}: Sin registro`
                            }
                            className={`inline-flex items-center justify-center h-6 w-6 rounded-md font-bold text-[10px] ${
                              meta
                                ? meta.cellCls
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {meta ? meta.short : '·'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
