import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, History } from 'lucide-react';
import { exportCsvWithBom, exportStyledWorkbook } from '../../lib/excelExport';
import type { AuditLog } from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { DataToolbar, PaginationBar } from '../ui/DataTableUI';

function formatAuditDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('es-CO');
}

export function AuditLogModule({ auditLogs }: { auditLogs: AuditLog[] }) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [exporting, setExporting] = useState(false);

  const modules = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((a) => {
      if (a.module) set.add(a.module);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [auditLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs
      .filter((a) => moduleFilter === 'all' || a.module === moduleFilter)
      .filter(
        (a) =>
          !q ||
          a.actorName.toLowerCase().includes(q) ||
          a.action.toLowerCase().includes(q) ||
          a.module.toLowerCase().includes(q) ||
          a.targetTitle.toLowerCase().includes(q)
      );
  }, [auditLogs, search, moduleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleExportExcel = async () => {
    if (filtered.length === 0) {
      showToast('No hay registros de auditoría para exportar', 'info');
      return;
    }
    setExporting(true);
    try {
      await exportStyledWorkbook({
        fileName: `Auditoria_CMJ_${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle: 'Registro Oficial de Auditoría del Portal CMJ',
        moduleName: 'Auditoría',
        sheets: [
          {
            name: 'Auditoría',
            title: 'Historial de Acciones Registradas',
            kpis: [{ label: 'Eventos listados', value: filtered.length }],
            columns: [
              { key: 'fecha', header: 'Fecha / Hora', type: 'text', minWidth: 18, maxWidth: 24 },
              { key: 'responsable', header: 'Responsable', type: 'text', minWidth: 20, maxWidth: 28 },
              { key: 'cargo', header: 'Cargo', type: 'text', minWidth: 14, maxWidth: 18 },
              { key: 'modulo', header: 'Módulo', type: 'text', minWidth: 18, maxWidth: 26 },
              { key: 'accion', header: 'Acción', type: 'text', minWidth: 24, maxWidth: 36, wrap: true },
              { key: 'objetivo', header: 'Elemento Afectado', type: 'text', minWidth: 24, maxWidth: 40, wrap: true },
            ],
            rows: filtered.map((a) => ({
              fecha: formatAuditDate(a.createdAt) || '—',
              responsable: a.actorName,
              cargo: a.actorRoleLabel,
              modulo: a.module,
              accion: a.action,
              objetivo: a.targetTitle,
            })),
          },
        ],
      });
      showToast('Auditoría exportada a Excel', 'success');
    } catch {
      showToast('No se pudo exportar el archivo Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    exportCsvWithBom({
      fileName: `Auditoria_CMJ_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'responsable', label: 'Responsable' },
        { key: 'cargo', label: 'Cargo' },
        { key: 'modulo', label: 'Modulo' },
        { key: 'accion', label: 'Accion' },
        { key: 'objetivo', label: 'Objetivo' },
      ],
      rows: filtered.map((a) => ({
        fecha: a.createdAt || '',
        responsable: a.actorName,
        cargo: a.actorRoleLabel,
        modulo: a.module,
        accion: a.action,
        objetivo: a.targetTitle,
      })),
    });
    showToast('Auditoría exportada en CSV', 'success');
  };

  return (
    <div className="cmj-card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="h-5 w-5 text-emerald-700 dark:text-emerald-400" /> Historial de Auditoría
          </h2>
          <p className="text-xs text-slate-500">
            Registro inmutable de acciones realizadas por la Mesa Directiva y Consejeros ({filtered.length}).
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
            onClick={handleExportCsv}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      <DataToolbar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Filtrar por consejero, acción o elemento..."
      >
        <select
          aria-label="Filtrar por módulo"
          value={moduleFilter}
          onChange={(e) => {
            setModuleFilter(e.target.value);
            setPage(1);
          }}
          className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
        >
          <option value="all">Todos los módulos</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </DataToolbar>

      {pagedLogs.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">Sin eventos registrados para este filtro.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {pagedLogs.map((a) => (
            <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-bold text-slate-900 dark:text-white">{a.actorName}</span>{' '}
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  ({a.actorRoleLabel})
                </span>{' '}
                — {a.action}: <strong>{a.targetTitle}</strong>
                {Boolean(a.createdAt) && (
                  <p className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                    {formatAuditDate(a.createdAt)}
                  </p>
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-500 shrink-0">{a.module}</span>
            </div>
          ))}
        </div>
      )}

      <PaginationBar
        totalItems={filtered.length}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[15, 30, 50]}
      />
    </div>
  );
}
export default AuditLogModule;
