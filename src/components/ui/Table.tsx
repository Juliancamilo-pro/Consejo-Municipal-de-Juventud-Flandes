import { ReactNode, useMemo, useState } from 'react';
import { ArrowUpDown, Download, FileSpreadsheet, FileText, Search } from 'lucide-react';
import {
  ExportColumnDef,
  exportRowsToCsv,
  exportRowsToPdf,
  exportRowsToXlsx,
} from '../../utils/tableExport';

export interface TableColumn<T> {
  key: string;
  header: string;
  sortValue?: (row: T) => string | number;
  exportValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchableText?: (row: T) => string;
  exportFileName?: string;
  exportTitle?: string;
  toolbarExtra?: ReactNode;
  pageSize?: number;
  emptyText?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchPlaceholder = 'Buscar en la tabla...',
  searchableText,
  exportFileName,
  exportTitle,
  toolbarExtra,
  pageSize = 10,
  emptyText = 'No hay registros que coincidan.',
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchableText) return rows;
    return rows.filter((r) => searchableText(r).toLowerCase().includes(q));
  }, [rows, query, searchableText]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const getter = col.sortValue;
    return [...filtered].sort((a, b) => {
      const av = getter(a);
      const bv = getter(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv), 'es-CO')
        : String(bv).localeCompare(String(av), 'es-CO');
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const visible = sorted.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const exportDefs: ExportColumnDef<T>[] = useMemo(
    () =>
      columns
        .filter((c) => c.exportValue || c.sortValue)
        .map((c) => ({
          header: c.header,
          getValue: (row: T) => (c.exportValue ? c.exportValue(row) : c.sortValue ? c.sortValue(row) : ''),
        })),
    [columns],
  );

  const handleXlsx = async () => {
    if (!exportFileName) return;
    setExporting('xlsx');
    try {
      await exportRowsToXlsx(exportFileName, exportDefs, sorted, exportTitle);
    } finally {
      setExporting(null);
    }
  };

  const handlePdf = async () => {
    if (!exportFileName) return;
    setExporting('pdf');
    try {
      await exportRowsToPdf(exportFileName, exportDefs, sorted, exportTitle);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-3">
      {(searchableText || exportFileName || toolbarExtra) && (
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {searchableText && (
              <div className="relative min-w-[210px] flex-1 sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="min-h-[38px] w-full rounded-lg border border-stone-300 bg-white pr-3 pl-8 text-xs text-stone-900 focus:border-[#7B1832] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}
            {toolbarExtra}
          </div>

          {exportFileName && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportRowsToCsv(exportFileName, exportDefs, sorted)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={exporting === 'xlsx'}
                onClick={() => void handleXlsx()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>{exporting === 'xlsx' ? 'Generando...' : 'Excel'}</span>
              </button>
              <button
                type="button"
                disabled={exporting === 'pdf'}
                onClick={() => void handlePdf()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileText className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                <span>{exporting === 'pdf' ? 'Generando...' : 'PDF'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="max-h-[540px] overflow-auto rounded-xl border border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900/75">
        <table className="min-w-full divide-y divide-stone-200 text-left text-xs dark:divide-slate-800">
          <thead className="sticky top-0 z-10 border-b border-stone-200 bg-[#FAF8F4] text-stone-700 shadow-2xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 font-semibold ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-stone-950 dark:hover:text-white"
                    >
                      <span>{col.header}</span>
                      <ArrowUpDown className="h-3 w-3 opacity-60" aria-hidden="true" />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-slate-800">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-stone-500 dark:text-slate-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-stone-50/80 dark:hover:bg-slate-800/40">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-stone-700 dark:text-slate-200 ${col.align === 'right' ? 'text-right' : ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono-tabular">
            Página {safePage + 1} de {totalPages} · {sorted.length} registros
          </span>
          <label className="inline-flex items-center gap-1.5">
            <span>Filas:</span>
            <select
              aria-label="Filas por página"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
              className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {[10, 25, 50].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        </div>

        {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="min-h-[34px] rounded-lg border border-stone-200 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="min-h-[34px] rounded-lg border border-stone-200 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
