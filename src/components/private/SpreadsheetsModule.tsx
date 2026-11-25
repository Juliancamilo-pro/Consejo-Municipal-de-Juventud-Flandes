import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  FileSpreadsheet,
  Printer,
  Save,
  Upload,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import {
  exportCsvWithBom,
  exportStyledWorkbook,
  parseCouncilorImportFile,
  type ExcelSheetSpec,
  type ImportedCouncilorRow,
} from '../../lib/excelExport';
import type {
  AffiliationType,
  Commission,
  CommissionTask,
  Commitment,
  CouncilSession,
  CouncilVote,
  CouncilorPrivate,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { EmptyState } from '../ui/AnimatedPrimitives';
import { DataToolbar, PaginationBar } from '../ui/DataTableUI';
import { recordAudit } from './auditHelper';
import { PermissionDeniedBanner, usePermissions } from './PermissionGate';

type SheetTab = 'asistencia' | 'votaciones' | 'compromisos' | 'directorio';

export function SpreadsheetsModule({
  uid,
  actorName,
  actorRoleLabel,
  commissions,
  commissionTasks,
  publicCouncilors,
  privateCouncilors,
  sessions,
  votes,
  commitments,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  commissions: Commission[];
  commissionTasks: CommissionTask[];
  publicCouncilors: PublicCouncilor[];
  privateCouncilors: CouncilorPrivate[];
  sessions: CouncilSession[];
  votes: CouncilVote[];
  commitments: Commitment[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canExport = can('planillas.exportar') || can('comision.reportes_exportar');
  const canImport = can('planillas.importar');
  const canEditDirectory = can('usuarios.editar');
  const canAssignPresidency = can('usuarios.asignar_presidencia');
  const [tab, setTab] = useState<SheetTab>('asistencia');
  const [commFilter, setCommFilter] = useState('todas');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [exporting, setExporting] = useState(false);

  // Edición inline del directorio tipo hoja de cálculo
  const [draftEdits, setDraftEdits] = useState<
    Record<
      string,
      {
        fullName: string;
        roleLabel: RoleLabel;
        commissionId: string;
        affiliationType: AffiliationType;
        affiliationName: string;
        phone: string;
      }
    >
  >({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // Importación validada desde Excel / CSV
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedCouncilorRow[]>([]);
  const [importHeaderErrors, setImportHeaderErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const q = search.trim().toLowerCase();

  const activeCouncilors = useMemo(
    () =>
      publicCouncilors
        .filter((c) => c.active)
        .filter((c) => {
          if (commFilter === 'sin_comision') return !c.commissionId;
          if (commFilter !== 'todas') return c.commissionId === commFilter;
          return true;
        })
        .filter(
          (c) =>
            !q ||
            c.fullName.toLowerCase().includes(q) ||
            c.roleLabel.toLowerCase().includes(q) ||
            (c.commissionName || '').toLowerCase().includes(q) ||
            (c.affiliationName || '').toLowerCase().includes(q)
        )
        .sort((a, b) => (a.displayOrder ?? 50) - (b.displayOrder ?? 50)),
    [publicCouncilors, commFilter, q]
  );

  const attendanceMatrix = useMemo(() => {
    return activeCouncilors.map((c) => {
      const cells = sessions.map((s) => s.attendance?.[c.uid] || '—');
      const recorded = sessions.filter((s) => s.attendance && c.uid in s.attendance);
      const presentCount = recorded.filter(
        (s) => s.attendance?.[c.uid] === 'presente' || s.attendance?.[c.uid] === 'tarde'
      ).length;
      const pct = recorded.length ? Math.round((presentCount / recorded.length) * 100) : 0;
      return { councilor: c, cells, pct, recordedCount: recorded.length, presentCount };
    });
  }, [activeCouncilors, sessions]);

  const filteredVotes = useMemo(
    () =>
      votes.filter((v) => {
        if (commFilter !== 'todas' && commFilter !== 'sin_comision' && v.commissionId !== commFilter) {
          return false;
        }
        if (!q) return true;
        return (
          v.title.toLowerCase().includes(q) ||
          (v.resultSummary || '').toLowerCase().includes(q)
        );
      }),
    [votes, commFilter, q]
  );

  const combinedCommitments = useMemo(() => {
    const list = [
      ...commitments
        .filter((c) => commFilter === 'todas' || c.commissionId === commFilter)
        .map((c) => ({
          id: `c-${c.id}`,
          origin: 'Plenaria',
          title: c.title,
          responsible: c.responsibleName,
          commission:
            commissions.find((cm) => cm.id === c.commissionId)?.name || 'Plenaria / Sin comisión',
          dueDate: c.dueDate || '',
          status: c.status.replace('_', ' '),
          progress: c.progress,
        })),
      ...commissionTasks
        .filter((t) => commFilter === 'todas' || t.commissionId === commFilter)
        .map((t) => ({
          id: `t-${t.id}`,
          origin: 'Comisión',
          title: t.title,
          responsible: t.assignedName || 'Sin asignar',
          commission: commissions.find((cm) => cm.id === t.commissionId)?.name || t.commissionId,
          dueDate: t.dueDate || '',
          status: t.status.replace('_', ' '),
          progress: t.status === 'hecha' ? 100 : t.status === 'en_curso' ? 50 : 0,
        })),
    ];
    if (!q) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.responsible.toLowerCase().includes(q) ||
        item.commission.toLowerCase().includes(q)
    );
  }, [commitments, commissionTasks, commissions, commFilter, q]);

  const currentItemsCount =
    tab === 'asistencia'
      ? attendanceMatrix.length
      : tab === 'votaciones'
      ? filteredVotes.length
      : tab === 'compromisos'
      ? combinedCommitments.length
      : activeCouncilors.length;

  const sliceStart = (page - 1) * pageSize;
  const pagedAttendance = attendanceMatrix.slice(sliceStart, sliceStart + pageSize);
  const pagedVotes = filteredVotes.slice(sliceStart, sliceStart + pageSize);
  const pagedCommitments = combinedCommitments.slice(sliceStart, sliceStart + pageSize);
  const pagedCouncilors = activeCouncilors.slice(sliceStart, sliceStart + pageSize);

  const buildSheetSpec = (targetTab: SheetTab): ExcelSheetSpec => {
    if (targetTab === 'asistencia') {
      const sessionCols = sessions.map((s, idx) => ({
        key: `ses_${idx}`,
        header: `${s.dateIso} · ${s.title.slice(0, 22)}`,
        type: 'text' as const,
        minWidth: 15,
        maxWidth: 24,
        align: 'center' as const,
      }));
      return {
        name: 'Asistencia',
        title: 'Matriz Consolidada de Asistencia a Sesiones',
        columns: [
          { key: 'consejero', header: 'Consejero', type: 'text', minWidth: 24 },
          { key: 'cargo', header: 'Cargo', type: 'text', minWidth: 15 },
          { key: 'comision', header: 'Comisión', type: 'text', minWidth: 24, wrap: true },
          ...sessionCols,
          { key: 'asistenciaPct', header: 'Asistencia %', type: 'percent', minWidth: 14 },
        ],
        rows: attendanceMatrix.map((row) => {
          const r: Record<string, unknown> = {
            consejero: row.councilor.fullName,
            cargo: row.councilor.roleLabel,
            comision: row.councilor.commissionName || 'Sin comisión',
            asistenciaPct: row.pct / 100,
          };
          sessions.forEach((_s, idx) => {
            r[`ses_${idx}`] = row.cells[idx];
          });
          return r;
        }),
      };
    }

    if (targetTab === 'votaciones') {
      return {
        name: 'Votaciones',
        title: 'Consolidado de Votaciones y Escrutinios',
        columns: [
          { key: 'titulo', header: 'Moción / Votación', type: 'text', minWidth: 28, maxWidth: 44, wrap: true },
          { key: 'modalidad', header: 'Modalidad', type: 'text', minWidth: 14, align: 'center' },
          { key: 'mayoria', header: 'Mayoría', type: 'text', minWidth: 14, align: 'center' },
          { key: 'estado', header: 'Estado', type: 'text', minWidth: 12, align: 'center' },
          { key: 'participantes', header: 'Votantes', type: 'integer', minWidth: 12 },
          { key: 'detalle', header: 'Conteo por Opción', type: 'text', minWidth: 28, wrap: true },
          { key: 'resultado', header: 'Resultado Oficial', type: 'text', minWidth: 26, wrap: true },
        ],
        rows: filteredVotes.map((v) => ({
          titulo: v.title,
          modalidad: v.voteMode || 'nominal',
          mayoria: v.majorityType || 'simple',
          estado: v.status,
          participantes: v.voterUids.length,
          detalle: v.options.map((o) => `${o}: ${v.tallies?.[o] || 0}`).join(' · '),
          resultado: v.resultSummary || 'En curso',
        })),
      };
    }

    if (targetTab === 'compromisos') {
      return {
        name: 'Compromisos',
        title: 'Seguimiento de Compromisos y Tareas de Comisiones',
        columns: [
          { key: 'origin', header: 'Origen', type: 'text', minWidth: 14, align: 'center' },
          { key: 'title', header: 'Actividad / Compromiso', type: 'text', minWidth: 28, maxWidth: 44, wrap: true },
          { key: 'responsible', header: 'Responsable', type: 'text', minWidth: 20 },
          { key: 'commission', header: 'Comisión', type: 'text', minWidth: 24, wrap: true },
          { key: 'dueDate', header: 'Fecha Límite', type: 'date', minWidth: 14 },
          { key: 'status', header: 'Estado', type: 'text', minWidth: 14, align: 'center' },
          { key: 'progress', header: 'Avance %', type: 'percent', minWidth: 12 },
        ],
        rows: combinedCommitments.map((item) => ({
          ...item,
          progress: item.progress / 100,
        })),
      };
    }

    return {
      name: 'Directorio',
      title: 'Directorio Oficial de Consejeros Juveniles',
      columns: [
        { key: 'nombre', header: 'Nombre Completo', type: 'text', minWidth: 24 },
        { key: 'correo', header: 'Correo Electrónico', type: 'text', minWidth: 26 },
        { key: 'telefono', header: 'Teléfono', type: 'text', minWidth: 15, align: 'center' },
        { key: 'cargo', header: 'Cargo', type: 'text', minWidth: 15 },
        { key: 'comision', header: 'Comisión', type: 'text', minWidth: 26, wrap: true },
        { key: 'filiacion', header: 'Filiación', type: 'text', minWidth: 16 },
        { key: 'organizacion', header: 'Organización / Partido', type: 'text', minWidth: 22 },
      ],
      rows: activeCouncilors.map((c) => {
        const priv = privateCouncilors.find((p) => p.uid === c.uid);
        return {
          nombre: c.fullName,
          correo: priv?.email || c.email || '—',
          telefono: priv?.phone || c.phone || '—',
          cargo: c.roleLabel,
          comision: c.commissionName || 'Sin comisión',
          filiacion:
            c.affiliationType === 'partido'
              ? 'Partido político'
              : c.affiliationType === 'fundacion'
              ? 'Fundación / Org.'
              : c.affiliationType === 'independiente'
              ? 'Independiente'
              : '—',
          organizacion: c.affiliationName || '—',
        };
      }),
    };
  };

  const handleExportSingle = async (format: 'xlsx' | 'csv') => {
    const spec = buildSheetSpec(tab);
    if (!spec.rows.length) {
      showToast('No hay filas para exportar en esta planilla', 'info');
      return;
    }
    const dateTag = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      exportCsvWithBom({
        fileName: `CMJ_Flandes_${tab}_${dateTag}.csv`,
        headers: spec.columns.map((c) => ({ key: c.key, label: c.header })),
        rows: spec.rows.map((r) => {
          const out: Record<string, unknown> = { ...r };
          spec.columns.forEach((col) => {
            if (col.type === 'percent' && typeof out[col.key] === 'number') {
              out[col.key] = `${Math.round((out[col.key] as number) * 100)}%`;
            }
          });
          return out;
        }),
      });
      showToast('Planilla exportada en CSV (UTF-8)', 'success');
      return;
    }

    setExporting(true);
    try {
      await exportStyledWorkbook({
        fileName: `CMJ_Flandes_${tab}_${dateTag}.xlsx`,
        reportTitle: spec.title || `Planilla ${tab}`,
        moduleName: 'Planillas y Matrices',
        generatedBy: `${actorName} (${actorRoleLabel})`,
        sheets: [spec],
      });
      showToast('Planilla Excel (.xlsx) generada con formato institucional', 'success');
    } catch {
      showToast('Error al generar el archivo Excel', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportFullWorkbook = async () => {
    setExporting(true);
    try {
      const dateTag = new Date().toISOString().slice(0, 10);
      await exportStyledWorkbook({
        fileName: `CMJ_Flandes_Libro_Consolidado_${dateTag}.xlsx`,
        reportTitle: 'Libro Consolidado General del CMJ Flandes',
        moduleName: 'Planillas Consolidadas',
        generatedBy: `${actorName} (${actorRoleLabel})`,
        includeSummarySheet: true,
        sheets: [
          buildSheetSpec('asistencia'),
          buildSheetSpec('votaciones'),
          buildSheetSpec('compromisos'),
          buildSheetSpec('directorio'),
        ],
      });
      showToast('Libro consolidado de 5 hojas exportado (.xlsx)', 'success');
    } catch {
      showToast('Error al exportar el libro consolidado', 'error');
    } finally {
      setExporting(false);
    }
  };

  const getDraft = (c: PublicCouncilor) => {
    if (draftEdits[c.id]) return draftEdits[c.id];
    const priv = privateCouncilors.find((p) => p.uid === c.uid);
    return {
      fullName: c.fullName,
      roleLabel: c.roleLabel,
      commissionId: c.commissionId || '',
      affiliationType: (c.affiliationType || '') as AffiliationType,
      affiliationName: c.affiliationName || '',
      phone: priv?.phone || c.phone || '',
    };
  };

  const handleSaveInlineRow = async (c: PublicCouncilor) => {
    const draft = getDraft(c);
    if (!draft.fullName.trim()) {
      showToast('El nombre no puede quedar vacío', 'error');
      return;
    }
    setSavingRowId(c.id);
    try {
      await apiRequest(`/api/councilors/${encodeURIComponent(c.uid)}`, {
        method: 'PATCH',
        body: {
          fullName: draft.fullName.trim(),
          roleLabel: draft.roleLabel,
          commissionId: draft.commissionId,
          affiliationType: draft.affiliationType,
          affiliationName: draft.affiliationName.trim(),
          phone: draft.phone.trim(),
        },
      });

      setDraftEdits((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      showToast('Fila guardada', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'No se pudo guardar la fila';
      showToast(msg, 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const existingEmails = privateCouncilors.map((p) => p.email);
      const parsed = await parseCouncilorImportFile(file, commissions, existingEmails);
      setImportHeaderErrors(parsed.headerErrors);
      setImportPreview(parsed.rows);
      if (parsed.headerErrors.length > 0) {
        showToast(parsed.headerErrors[0], 'error');
      } else {
        const invalidCount = parsed.rows.filter((r) => !r.valid).length;
        showToast(
          invalidCount > 0
            ? `${parsed.rows.length} fila(s) leídas · ${invalidCount} con errores por revisar`
            : `${parsed.rows.length} fila(s) válidas listas para importar`,
          invalidCount > 0 ? 'info' : 'success'
        );
      }
    } catch {
      showToast('No se pudo leer el archivo Excel o CSV', 'error');
    }
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    const valids = importPreview.filter((r) => r.valid);
    if (!valids.length) return;
    setImporting(true);
    try {
      const res = await apiRequest<{ imported: number; ok: boolean }>('/api/councilors/bulk', {
        method: 'POST',
        body: { items: valids },
      });

      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Importó consejeros desde planilla Excel/CSV',
        module: 'Planillas',
        targetTitle: `${res.imported} registros habilitados`,
      });
      setImportPreview([]);
      setImportHeaderErrors([]);
      showToast(`${res.imported} consejero(s) habilitados correctamente`, 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'Error al importar consejeros';
      showToast(msg, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              Planillas, Matrices y Reportes CMJ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exporta reportes Excel listos para presentar, edita el directorio en línea o importa consejeros con validación por fila.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 no-print">
            {canExport ? (
              <>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => handleExportSingle('xlsx')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" /> Excel (.xlsx)
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={handleExportFullWorkbook}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Libro Completo
                </button>
                <button
                  type="button"
                  onClick={() => handleExportSingle('csv')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" /> CSV (UTF-8)
                </button>
              </>
            ) : (
              <PermissionDeniedBanner
                permission="planillas.exportar"
                compact
                customText="No tienes permiso para exportar planillas."
              />
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </button>
            {canImport && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-blue-600 text-blue-700 dark:text-cyan-400 dark:border-cyan-500/60 px-3.5 py-2 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" /> Importar Excel/CSV
                </button>
              </>
            )}
          </div>
        </div>

        {/* Subpestañas + búsqueda + filtro */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 no-print">
          <div className="inline-flex flex-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
            {(
              [
                { id: 'asistencia', label: 'Asistencia' },
                { id: 'votaciones', label: 'Votaciones' },
                { id: 'compromisos', label: 'Compromisos y Tareas' },
                { id: 'directorio', label: 'Directorio Editable' },
              ] as { id: SheetTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  tab === t.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <DataToolbar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            searchPlaceholder="Filtrar filas por nombre, título o comisión..."
          >
            <select
              aria-label="Filtrar por comisión"
              value={commFilter}
              onChange={(e) => {
                setCommFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="todas">Todas las comisiones</option>
              <option value="sin_comision">Sin comisión asignada</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </DataToolbar>
        </div>

        {/* Vista previa importación Excel con errores de encabezado o por fila */}
        {(importPreview.length > 0 || importHeaderErrors.length > 0) && (
          <div className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-950 p-4 space-y-3 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Revisión de importación ({importPreview.filter((r) => r.valid).length} válidas de{' '}
                  {importPreview.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Columnas requeridas: <strong>Nombre</strong> y <strong>Correo</strong>. Opcionales: Cargo, Comisión, Filiación, Organización, Teléfono.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setImportPreview([]);
                    setImportHeaderErrors([]);
                  }}
                  className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={importing || importPreview.filter((r) => r.valid).length === 0}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />{' '}
                  {importing
                    ? 'Importando...'
                    : `Importar ${importPreview.filter((r) => r.valid).length} válidas`}
                </button>
              </div>
            </div>

            {importHeaderErrors.length > 0 && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 space-y-1">
                {importHeaderErrors.map((err, i) => (
                  <p key={i} className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {err}
                  </p>
                ))}
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="p-2">Fila</th>
                      <th className="p-2">Nombre</th>
                      <th className="p-2">Correo</th>
                      <th className="p-2">Cargo</th>
                      <th className="p-2">Validación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r) => (
                      <tr key={r.rowNumber} className="border-b border-slate-100 dark:border-slate-800/70">
                        <td className="p-2 font-mono-num text-slate-400">#{r.rowNumber}</td>
                        <td className="p-2 font-medium">{r.fullName}</td>
                        <td className="p-2">{r.email || '—'}</td>
                        <td className="p-2">{r.roleLabel}</td>
                        <td className="p-2">
                          {r.valid ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              Lista{r.warnings.length ? ` (${r.warnings.join('; ')})` : ''}
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              {r.errors.join(' · ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Encabezado visible solo en impresión PDF */}
        <div className="hidden print:block border-b border-slate-400 pb-3 mb-4">
          <p className="text-xs font-bold uppercase">
            Consejo Municipal de Juventudes de Flandes · Tolima
          </p>
          <h3 className="text-lg font-extrabold capitalize">Planilla Institucional: {tab}</h3>
          <p className="text-xs text-slate-600">
            Generado el {new Date().toLocaleDateString('es-CO')}
          </p>
        </div>

        {/* Tabla 1: Matriz Asistencia */}
        {tab === 'asistencia' && (
          <>
            {pagedAttendance.length === 0 ? (
              <EmptyState
                title="Sin registros en la matriz"
                description="No hay consejeros activos que coincidan con el filtro aplicado."
              />
            ) : (
              <>
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {pagedAttendance.map((row) => (
                    <div key={row.councilor.uid} className="py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {row.councilor.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.councilor.roleLabel} · {row.councilor.commissionName || 'Sin comisión'}
                          </p>
                        </div>
                        <span
                          className={`font-mono-num text-sm font-extrabold ${
                            row.pct >= 80
                              ? 'text-emerald-600'
                              : row.pct >= 50
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {row.pct}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono-num">
                        {row.presentCount} asistencias de {row.recordedCount} sesiones registradas
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
                    <thead className="bg-slate-100 dark:bg-slate-800/80">
                      <tr>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Consejero</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Cargo</th>
                        {sessions.map((s) => (
                          <th
                            key={s.id}
                            className="p-2.5 border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                          >
                            <div className="font-mono-num text-[10px] text-slate-500">{s.dateIso}</div>
                            <div className="truncate max-w-[120px]">{s.title}</div>
                          </th>
                        ))}
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700 text-right">
                          Consolidado %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedAttendance.map((row) => (
                        <tr key={row.councilor.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-semibold">
                            {row.councilor.fullName}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                            {row.councilor.roleLabel}
                          </td>
                          {row.cells.map((st, idx) => (
                            <td
                              key={idx}
                              className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize text-center"
                            >
                              <span
                                className={`font-semibold ${
                                  st === 'presente'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : st === 'tarde'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : st === 'excusa'
                                    ? 'text-blue-700 dark:text-cyan-400'
                                    : st === 'ausente'
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-slate-400'
                                }`}
                              >
                                {st}
                              </span>
                            </td>
                          ))}
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-mono-num font-bold">
                            <span
                              className={
                                row.pct >= 80
                                  ? 'text-emerald-600'
                                  : row.pct >= 50
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }
                            >
                              {row.pct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Tabla 2: Votaciones */}
        {tab === 'votaciones' && (
          <>
            {pagedVotes.length === 0 ? (
              <EmptyState
                title="Sin votaciones para mostrar"
                description="No hay votaciones que coincidan con los filtros actuales."
              />
            ) : (
              <>
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {pagedVotes.map((v) => (
                    <div key={v.id} className="py-3 space-y-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{v.title}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {v.voteMode || 'nominal'} · {v.status} ·{' '}
                        <span className="font-mono-num">{v.voterUids.length} votos</span>
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {v.options.map((o) => `${o}: ${v.tallies?.[o] || 0}`).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
                    <thead className="bg-slate-100 dark:bg-slate-800/80">
                      <tr>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Votación</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Modo</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Estado</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700 text-right">Votos</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Resultados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedVotes.map((v) => (
                        <tr key={v.id}>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-semibold">
                            {v.title}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize">
                            {v.voteMode || 'nominal'}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize">
                            {v.status}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-mono-num text-right">
                            {v.voterUids.length}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                            {v.options.map((o) => `${o}: ${v.tallies?.[o] || 0}`).join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Tabla 3: Compromisos y Tareas */}
        {tab === 'compromisos' && (
          <>
            {pagedCommitments.length === 0 ? (
              <EmptyState
                title="Sin compromisos ni tareas"
                description="Ajusta los filtros o crea nuevos compromisos desde Plenaria o Comisiones."
              />
            ) : (
              <>
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {pagedCommitments.map((item) => (
                    <div key={item.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {item.progress}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {item.origin} · {item.responsible} · <span className="capitalize">{item.status}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
                    <thead className="bg-slate-100 dark:bg-slate-800/80">
                      <tr>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Origen</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Actividad</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Responsable</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Comisión</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700">Estado</th>
                        <th className="p-2.5 border border-slate-200 dark:border-slate-700 text-right">
                          Avance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCommitments.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800">{item.origin}</td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-semibold">
                            {item.title}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                            {item.responsible}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                            {item.commission}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize">
                            {item.status}
                          </td>
                          <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-mono-num font-bold">
                            {item.progress}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {/* Tabla 4: Directorio Editable tipo Excel */}
        {tab === 'directorio' && (
          <>
            {!canEditDirectory && (
              <PermissionDeniedBanner
                permission="usuarios.editar"
                compact
                customText="Vista de solo lectura del directorio."
              />
            )}
            {pagedCouncilors.length === 0 ? (
              <EmptyState
                title="Sin consejeros en el filtro"
                description="No hay consejeros activos que coincidan con tu búsqueda."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800 min-w-[760px]">
                  <thead className="bg-slate-100 dark:bg-slate-800/80">
                    <tr>
                      <th className="p-2 border border-slate-200 dark:border-slate-700">Nombre</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700">Correo</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700">Teléfono</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700">Cargo</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700">Comisión</th>
                      <th className="p-2 border border-slate-200 dark:border-slate-700">Filiación</th>
                      {canEditDirectory && (
                        <th className="p-2 border border-slate-200 dark:border-slate-700 text-right no-print">
                          Guardar
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCouncilors.map((c) => {
                      const priv = privateCouncilors.find((p) => p.uid === c.uid);
                      const draft = getDraft(c);
                      const dirty = Boolean(draftEdits[c.id]);
                      return (
                        <tr key={c.id}>
                          <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                            <input
                              type="text"
                              disabled={!canEditDirectory}
                              value={draft.fullName}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [c.id]: { ...draft, fullName: e.target.value },
                                }))
                              }
                              className="w-full rounded px-2 py-1 bg-transparent border border-transparent focus:border-emerald-600"
                            />
                          </td>
                          <td className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500">
                            {priv?.email || c.email || 'Pendiente'}
                          </td>
                          <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                            <input
                              type="text"
                              disabled={!canEditDirectory}
                              value={draft.phone}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [c.id]: { ...draft, phone: e.target.value },
                                }))
                              }
                              className="w-full rounded px-2 py-1 bg-transparent border border-transparent focus:border-emerald-600"
                            />
                          </td>
                          <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                            <select
                              disabled={!canEditDirectory || c.uid === uid}
                              value={draft.roleLabel}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [c.id]: { ...draft, roleLabel: e.target.value as RoleLabel },
                                }))
                              }
                              className="rounded px-2 py-1 bg-transparent"
                            >
                              <option value="Consejero">Consejero</option>
                              {(canAssignPresidency || c.roleLabel === 'Presidente') && (
                                <option value="Presidente">Presidente</option>
                              )}
                              <option value="Vicepresidente">Vicepresidente</option>
                              <option value="Secretario">Secretario</option>
                            </select>
                          </td>
                          <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                            <select
                              disabled={!canEditDirectory}
                              value={draft.commissionId}
                              onChange={(e) =>
                                setDraftEdits((prev) => ({
                                  ...prev,
                                  [c.id]: { ...draft, commissionId: e.target.value },
                                }))
                              }
                              className="rounded px-2 py-1 bg-transparent max-w-[180px]"
                            >
                              <option value="">Sin comisión asignada</option>
                              {commissions.map((cm) => (
                                <option key={cm.id} value={cm.id}>
                                  {cm.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                            <div className="flex gap-1">
                              <select
                                disabled={!canEditDirectory}
                                value={draft.affiliationType}
                                onChange={(e) =>
                                  setDraftEdits((prev) => ({
                                    ...prev,
                                    [c.id]: {
                                      ...draft,
                                      affiliationType: e.target.value as AffiliationType,
                                    },
                                  }))
                                }
                                className="rounded px-1.5 py-1 bg-transparent"
                              >
                                <option value="">—</option>
                                <option value="partido">Partido</option>
                                <option value="fundacion">Fundación</option>
                                <option value="independiente">Indep.</option>
                              </select>
                              <input
                                type="text"
                                disabled={!canEditDirectory}
                                value={draft.affiliationName}
                                onChange={(e) =>
                                  setDraftEdits((prev) => ({
                                    ...prev,
                                    [c.id]: { ...draft, affiliationName: e.target.value },
                                  }))
                                }
                                placeholder="Nombre partido/org."
                                className="w-32 rounded px-1.5 py-1 bg-transparent border border-transparent focus:border-emerald-600"
                              />
                            </div>
                          </td>
                          {canEditDirectory && (
                            <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-right no-print">
                              <button
                                type="button"
                                disabled={!dirty || savingRowId === c.id}
                                onClick={() => handleSaveInlineRow(c)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                                  dirty
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}
                              >
                                <Save className="h-3 w-3" /> Guardar
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <PaginationBar
          totalItems={currentItemsCount}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
