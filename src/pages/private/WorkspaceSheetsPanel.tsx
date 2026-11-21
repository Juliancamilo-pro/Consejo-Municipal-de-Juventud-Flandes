import { FormEvent, useState } from 'react';
import { ExternalLink, FileSpreadsheet, Link2, RefreshCw } from 'lucide-react';
import { fetchAnnualActionPlan } from '../../services/actionPlanService';
import {
  appendSheetRows,
  buildCmjExportRows,
  CmjSheetDatasetKind,
  createGoogleSpreadsheet,
  formatA1Range,
  getSpreadsheetMetadata,
  GoogleSheetMetadata,
  GoogleSheetSummary,
  listRecentGoogleSheets,
  readSheetRange,
  updateSheetRange,
} from '../../services/googleSheetsService';
import { saveWorkspaceLinkToServer } from '../../services/workspaceApi';
import { AttendanceRecord, CommitmentItem, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import {
  PendingSheetAction,
  WorkspaceSheetsPreviewCard,
} from './WorkspaceSheetsPreviewCard';

interface WorkspaceSheetsPanelProps {
  accessToken: string | null;
  users?: UserProfile[];
  attendance?: AttendanceRecord[];
  commitments?: CommitmentItem[];
  onRefreshLinks: () => Promise<void>;
}

export function WorkspaceSheetsPanel({
  accessToken,
  users = [],
  attendance = [],
  commitments = [],
  onRefreshLinks,
}: WorkspaceSheetsPanelProps) {
  const [sheets, setSheets] = useState<GoogleSheetSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [meta, setMeta] = useState<GoogleSheetMetadata | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  const [exportTitle, setExportTitle] = useState('Consolidado CMJ Flandes 2026-2029');
  const [dataset, setDataset] = useState<CmjSheetDatasetKind>('directorio');
  const [appendInput, setAppendInput] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingSheetAction>(null);
  const [executing, setExecuting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoadSheets = async () => {
    if (!accessToken) return;
    setLoadingList(true);
    setErrorMsg(null);
    try {
      setSheets(await listRecentGoogleSheets(accessToken));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error listando hojas de Google Sheets.');
    } finally {
      setLoadingList(false);
    }
  };

  const loadTabGrid = async (spreadsheetId: string, tabTitle: string) => {
    if (!accessToken || !tabTitle) return;
    setLoadingGrid(true);
    setErrorMsg(null);
    try {
      const grid = await readSheetRange(accessToken, spreadsheetId, formatA1Range(tabTitle, 'A1:Z100'));
      setRows(grid);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron leer las celdas.');
    } finally {
      setLoadingGrid(false);
    }
  };

  const handleInspectSheet = async (sheetId: string) => {
    if (!accessToken) return;
    setLoadingGrid(true);
    setErrorMsg(null);
    try {
      const loadedMeta = await getSpreadsheetMetadata(accessToken, sheetId);
      setMeta(loadedMeta);
      const firstTab = loadedMeta.sheets[0]?.title || '';
      setActiveTab(firstTab);
      if (firstTab) {
        await loadTabGrid(loadedMeta.spreadsheetId, firstTab);
      } else {
        setRows([]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cargando metadatos de la hoja.');
      setLoadingGrid(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!accessToken || !pendingAction) return;
    setExecuting(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      if (pendingAction.kind === 'create_export') {
        const planItems =
          pendingAction.dataset === 'plan_accion'
            ? await fetchAnnualActionPlan().catch(() => [])
            : [];
        const exportRows = buildCmjExportRows(pendingAction.dataset, {
          users,
          attendance,
          commitments,
          actionPlan: planItems,
        });
        const created = await createGoogleSpreadsheet(accessToken, pendingAction.title, 'Datos_CMJ');
        const tabName = created.sheets[0]?.title || 'Datos_CMJ';
        await updateSheetRange(
          accessToken,
          created.spreadsheetId,
          formatA1Range(tabName, 'A1'),
          exportRows,
        );
        await saveWorkspaceLinkToServer({
          resourceType: 'sheet',
          externalId: created.spreadsheetId,
          title: created.title,
          url: created.url,
          folderTag: pendingAction.dataset,
          notes: `Exportación oficial CMJ (${exportRows.length - 1} registros)`,
        });
        setNotice(`Hoja "${created.title}" creada y sincronizada con ${exportRows.length - 1} registros.`);
        await Promise.all([handleLoadSheets(), onRefreshLinks(), handleInspectSheet(created.spreadsheetId)]);
      } else if (pendingAction.kind === 'append_row' && meta) {
        await appendSheetRows(accessToken, meta.spreadsheetId, pendingAction.sheetTitle, [
          pendingAction.rowValues,
        ]);
        setAppendInput('');
        setNotice(`Fila agregada en "${pendingAction.sheetTitle}".`);
        await loadTabGrid(meta.spreadsheetId, pendingAction.sheetTitle);
      }
      setPendingAction(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error escribiendo en Google Sheets.');
    } finally {
      setExecuting(false);
    }
  };

  const handlePinSheet = async (s: GoogleSheetSummary) => {
    const url = s.webViewLink || `https://docs.google.com/spreadsheets/d/${s.id}/edit`;
    try {
      await saveWorkspaceLinkToServer({
        resourceType: 'sheet',
        externalId: s.id,
        title: s.name,
        url,
        folderTag: 'hojas',
        notes: 'Hoja de cálculo vinculada al CMJ',
      });
      await onRefreshLinks();
      setNotice(`Hoja "${s.name}" vinculada en Referencias CMJ.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo vincular la hoja.');
    }
  };

  const handleRequestExport = (e: FormEvent) => {
    e.preventDefault();
    if (!exportTitle.trim()) return;
    setPendingAction({ kind: 'create_export', title: exportTitle.trim(), dataset });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                Hojas de cálculo en Google Drive
              </h3>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Inspecciona pestañas, lee rangos reales y vincula hojas oficiales.
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={!accessToken} loading={loadingList} onClick={() => void handleLoadSheets()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /><span>Cargar Sheets</span>
            </Button>
          </div>
          {!accessToken ? (
            <p className="mt-4 text-xs text-stone-600 dark:text-slate-300">
              Conecta tu cuenta de Google arriba para abrir y actualizar hojas de Google Sheets.
            </p>
          ) : sheets.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={FileSpreadsheet} title="Haz clic en 'Cargar Sheets'" description="Se mostrarán tus hojas de cálculo recientes sin realizar cambios." />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-stone-200 dark:divide-slate-800">
              {sheets.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <button type="button" onClick={() => void handleInspectSheet(s.id)} className="text-left font-medium text-stone-900 hover:text-[#7B1832] dark:text-slate-100 dark:hover:text-[#D9B245]">
                    {s.name}
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void handlePinSheet(s)} className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 dark:border-slate-700 dark:text-slate-200">
                      <Link2 className="h-3 w-3" aria-hidden="true" /><span>Fijar</span>
                    </button>
                    <a href={s.webViewLink || `https://docs.google.com/spreadsheets/d/${s.id}/edit`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]">
                      <span>Abrir</span><ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Exportar tabla del CMJ a Google Sheets
          </h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
            Crea una hoja de cálculo nueva con datos reales del portal previa confirmación.
          </p>
          <form onSubmit={handleRequestExport} className="mt-4 space-y-3">
            <Input label="Nombre del archivo en Google Sheets" required maxLength={160} value={exportTitle} onChange={(e) => setExportTitle(e.target.value)} />
            <Select label="Tabla a exportar" value={dataset} onChange={(e) => setDataset(e.target.value as CmjSheetDatasetKind)}>
              <option value="directorio">Directorio interno de consejeros ({users.length})</option>
              <option value="asistencia">Registro de asistencia ({attendance.length})</option>
              <option value="compromisos">Seguimiento de compromisos ({commitments.length})</option>
              <option value="plan_accion">Metas del Plan de Acción Anual</option>
            </Select>
            <Button type="submit" disabled={!accessToken}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" /><span>Crear y exportar a Google Sheets</span>
            </Button>
          </form>
        </Card>
      </div>

      {notice && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {errorMsg && <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMsg}</p>}

      <WorkspaceSheetsPreviewCard
        meta={meta}
        activeTab={activeTab}
        rows={rows}
        loadingGrid={loadingGrid}
        appendInput={appendInput}
        pendingAction={pendingAction}
        executing={executing}
        onSelectTab={(t) => {
          setActiveTab(t);
          if (meta) void loadTabGrid(meta.spreadsheetId, t);
        }}
        onChangeAppendInput={setAppendInput}
        onRequestAppend={(e) => {
          e.preventDefault();
          const rowValues = appendInput.split(';').map((v) => v.trim());
          if (meta && activeTab && rowValues.some(Boolean)) {
            setPendingAction({ kind: 'append_row', sheetTitle: activeTab, rowValues });
          }
        }}
        onConfirmModal={() => void handleConfirmAction()}
        onCloseModal={() => setPendingAction(null)}
      />
    </div>
  );
}
