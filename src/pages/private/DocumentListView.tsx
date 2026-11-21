import { Eye, FileText } from 'lucide-react';
import { incrementDocumentDownloadCount } from '../../services/documentsExtrasService';
import { InstitutionalDocument } from '../../types/models';
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  formatFileSize,
} from '../../utils/documentUtils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusText } from '../../components/ui/StatusText';
import { StorageDownloadButton } from '../../components/ui/StorageFileActions';
import { DocumentViewMode } from './DocumentFiltersBar';

interface DocumentListViewProps {
  paged: InstitutionalDocument[];
  totalCount: number;
  viewMode: DocumentViewMode;
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  onSelect: (docId: string) => void;
  onPreview: (docItem: InstitutionalDocument) => void;
}

export function DocumentListView({
  paged,
  totalCount,
  viewMode,
  page,
  totalPages,
  onPageChange,
  onSelect,
  onPreview,
}: DocumentListViewProps) {
  if (paged.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No hay documentos para los filtros seleccionados"
        description="Sube actas o informes o limpia los filtros de búsqueda."
      />
    );
  }

  return (
    <>
      {viewMode === 'tabla' ? (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-[#FAF8F4] text-stone-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Consecutivo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-slate-800">
              {paged.map((docItem) => (
                <tr key={docItem.id} className="hover:bg-stone-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-stone-950 dark:text-white">
                    <button
                      type="button"
                      onClick={() => onSelect(docItem.id)}
                      className="text-left hover:text-[#7B1832] dark:hover:text-[#D9B245]"
                    >
                      {docItem.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-slate-300">
                    {DOCUMENT_CATEGORY_LABELS[docItem.category] || docItem.category}
                  </td>
                  <td className="px-4 py-3 font-mono-tabular text-stone-500">
                    {docItem.consecutiveNumber || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusText
                      label={DOCUMENT_STATUS_LABELS[docItem.status]}
                      tone={docItem.status === 'publicada' ? 'success' : 'info'}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => onSelect(docItem.id)}>
                        Ficha
                      </Button>
                      <span onClick={() => void incrementDocumentDownloadCount(docItem.id)}>
                        <StorageDownloadButton compact item={docItem} />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-3">
          {paged.map((docItem) => (
            <Card key={docItem.id} padding="sm">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                    <span>{DOCUMENT_CATEGORY_LABELS[docItem.category] || docItem.category}</span>
                    {docItem.consecutiveNumber && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular font-semibold text-[#7B1832] dark:text-[#D9B245]">
                          {docItem.consecutiveNumber}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular">v{docItem.currentVersion}</span>
                    <span aria-hidden="true">·</span>
                    <span>{docItem.visibility === 'publico' ? 'Público' : 'Interno'}</span>
                    <StatusText
                      label={DOCUMENT_STATUS_LABELS[docItem.status]}
                      tone={docItem.status === 'publicada' ? 'success' : 'info'}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(docItem.id)}
                    className="mt-1 text-left font-display text-base font-semibold text-stone-950 hover:text-[#7B1832] dark:text-white dark:hover:text-[#D9B245]"
                  >
                    {docItem.title}
                  </button>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
                    {docItem.authorName} · {docItem.fileName} · {formatFileSize(docItem.fileSize)} ·{' '}
                    {docItem.downloadCount ?? 0} descargas
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onPreview(docItem)}>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Visor</span>
                  </Button>
                  <span onClick={() => void incrementDocumentDownloadCount(docItem.id)}>
                    <StorageDownloadButton item={docItem} />
                  </span>
                  <Button size="sm" onClick={() => onSelect(docItem.id)}>
                    <span>Ficha y revisión</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-stone-600 dark:text-slate-300">
          <span>
            Página {page} de {totalPages} ({totalCount} documentos)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
