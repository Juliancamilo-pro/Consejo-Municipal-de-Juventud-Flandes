import { FormEvent } from 'react';
import { ExternalLink, Plus, Table2 } from 'lucide-react';
import { GoogleSheetMetadata } from '../../services/googleSheetsService';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Input, Select } from '../../components/ui/Input';

export type PendingSheetAction =
  | { kind: 'create_export'; title: string; dataset: 'directorio' | 'asistencia' | 'compromisos' | 'plan_accion' }
  | { kind: 'append_row'; sheetTitle: string; rowValues: string[] }
  | null;

interface WorkspaceSheetsPreviewCardProps {
  meta: GoogleSheetMetadata | null;
  activeTab: string;
  rows: string[][];
  loadingGrid: boolean;
  appendInput: string;
  pendingAction: PendingSheetAction;
  executing: boolean;
  onSelectTab: (tabTitle: string) => void;
  onChangeAppendInput: (val: string) => void;
  onRequestAppend: (e: FormEvent) => void;
  onConfirmModal: () => void;
  onCloseModal: () => void;
}

export function WorkspaceSheetsPreviewCard({
  meta,
  activeTab,
  rows,
  loadingGrid,
  appendInput,
  pendingAction,
  executing,
  onSelectTab,
  onChangeAppendInput,
  onRequestAppend,
  onConfirmModal,
  onCloseModal,
}: WorkspaceSheetsPreviewCardProps) {
  return (
    <>
      {meta && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
                Vista previa en vivo · Google Sheets
              </p>
              <h3 className="mt-0.5 flex items-center gap-2 font-display text-lg font-semibold text-stone-950 dark:text-white">
                <Table2 className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                <span>{meta.title}</span>
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {meta.sheets.length > 0 && (
                <div className="w-48">
                  <Select
                    label="Pestaña"
                    value={activeTab}
                    onChange={(e) => onSelectTab(e.target.value)}
                  >
                    {meta.sheets.map((s) => (
                      <option key={s.sheetId} value={s.title}>
                        {s.title}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <a
                href={meta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
              >
                <span>Abrir hoja</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {loadingGrid ? (
            <p className="text-xs text-stone-500">Cargando celdas de la pestaña "{activeTab}"...</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-stone-500">Esta pestaña no contiene filas visibles en A1:Z100.</p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-lg border border-stone-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <tbody>
                  {rows.slice(0, 30).map((r, rIdx) => (
                    <tr
                      key={rIdx}
                      className={
                        rIdx === 0
                          ? 'border-b border-stone-200 bg-[#FAF8F4] font-semibold text-stone-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white'
                          : 'border-b border-stone-200/60 dark:border-slate-800/70'
                      }
                    >
                      {r.map((cell, cIdx) => (
                        <td key={cIdx} className="whitespace-nowrap px-3 py-2 text-stone-700 dark:text-slate-300">
                          {cell || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={onRequestAppend} className="flex flex-col gap-2 border-t border-stone-200 pt-3 sm:flex-row sm:items-end dark:border-slate-800">
            <div className="flex-1">
              <Input
                label="Agregar nueva fila (valores separados por ; )"
                value={appendInput}
                onChange={(e) => onChangeAppendInput(e.target.value)}
                placeholder="Ej. María Gómez; Consejera; Flandes Urbano; 100%"
              />
            </div>
            <Button type="submit" size="sm" disabled={!appendInput.trim()}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Añadir fila</span>
            </Button>
          </form>
        </Card>
      )}

      <Dialog
        open={Boolean(pendingAction)}
        loading={executing}
        title={
          pendingAction?.kind === 'create_export'
            ? '¿Crear hoja de cálculo y exportar datos del CMJ?'
            : '¿Agregar nueva fila en Google Sheets?'
        }
        description={
          pendingAction?.kind === 'create_export'
            ? `Se creará la hoja "${pendingAction.title}" en tu Google Drive con los registros actuales de ${pendingAction.dataset}.`
            : `Se insertará una nueva fila al final de la pestaña "${pendingAction?.kind === 'append_row' ? pendingAction.sheetTitle : ''}".`
        }
        confirmLabel="Confirmar escritura en Google Sheets"
        onConfirm={onConfirmModal}
        onCancel={onCloseModal}
      />
    </>
  );
}
