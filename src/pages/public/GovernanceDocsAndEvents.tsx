import { useMemo, useState } from 'react';
import { Eye, FileText, LayoutGrid, List } from 'lucide-react';
import { incrementDocumentDownloadCount } from '../../services/documentsExtrasService';
import { Commission, InstitutionalDocument } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { getCommissionSlug } from '../../utils/commissionUtils';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  extractDocumentYear,
  formatFileSize,
} from '../../utils/documentUtils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterChip, FilterToolbar } from '../../components/ui/FilterToolbar';
import { Select } from '../../components/ui/Input';
import { StorageDownloadButton } from '../../components/ui/StorageFileActions';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';
import { GovernanceCalendarPanel } from './GovernanceCalendarPanel';

export { GovernanceCalendarPanel };

const PAGE_STEP = 10;

export function GovernanceDocsPanel({
  documents,
  commissions,
  onPreview,
  onNavigate,
}: {
  documents: InstitutionalDocument[];
  commissions: Commission[];
  onPreview: (docItem: InstitutionalDocument) => void;
  onNavigate?: (path: AppRoute) => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [commissionFilter, setCommissionFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recientes' | 'titulo' | 'descargas'>('recientes');
  const [viewMode, setViewMode] = useState<'tarjetas' | 'tabla'>('tarjetas');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);

  const publicDocs = useMemo(
    () => documents.filter((d) => d.visibility === 'publico' && d.status === 'publicada'),
    [documents],
  );

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    publicDocs.forEach((d) => set.add(extractDocumentYear(d)));
    return Array.from(set).sort((a, b) => b - a);
  }, [publicDocs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = publicDocs.filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (yearFilter && String(extractDocumentYear(d)) !== yearFilter) return false;
      if (commissionFilter && d.commissionId !== commissionFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.consecutiveNumber || '').toLowerCase().includes(q) ||
        (d.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
    return [...list].sort((a, b) => {
      if (sortBy === 'titulo') return a.title.localeCompare(b.title, 'es-CO');
      if (sortBy === 'descargas') return (b.downloadCount ?? 0) - (a.downloadCount ?? 0);
      return extractDocumentYear(b) - extractDocumentYear(a);
    });
  }, [publicDocs, search, categoryFilter, yearFilter, commissionFilter, sortBy]);

  if (publicDocs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aún no se han publicado actas ni informes"
        description="Solo las actas aprobadas e informes de gestión marcados como públicos por la Mesa Directiva se visualizan en este repositorio."
        actionLabel={onNavigate ? 'Ir a Participación Ciudadana' : undefined}
        onAction={onNavigate ? () => onNavigate('/participacion') : undefined}
      />
    );
  }

  const visibleDocs = filtered.slice(0, visibleCount);
  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setYearFilter('');
    setCommissionFilter('');
    setSortBy('recientes');
    setVisibleCount(PAGE_STEP);
  };

  const activeChips: FilterChip[] = [];
  if (search.trim()) {
    activeChips.push({ id: 'q', label: `Búsqueda: ${search.trim()}`, onRemove: () => setSearch('') });
  }
  if (categoryFilter) {
    activeChips.push({
      id: 'cat',
      label: `Categoría: ${DOCUMENT_CATEGORY_LABELS[categoryFilter as InstitutionalDocument['category']] || categoryFilter}`,
      onRemove: () => setCategoryFilter(''),
    });
  }
  if (yearFilter) {
    activeChips.push({ id: 'year', label: `Año: ${yearFilter}`, onRemove: () => setYearFilter('') });
  }
  if (commissionFilter) {
    const com = commissions.find((c) => c.id === commissionFilter);
    activeChips.push({
      id: 'com',
      label: `Comisión: ${com?.name || commissionFilter}`,
      onRemove: () => setCommissionFilter(''),
    });
  }

  const activeSecondaryCount = [commissionFilter, sortBy !== 'recientes' ? sortBy : ''].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <FilterToolbar
        searchLabel="Buscar en el archivo oficial"
        searchPlaceholder="Título, consecutivo o etiqueta..."
        searchValue={search}
        onSearchChange={setSearch}
        activeSecondaryCount={activeSecondaryCount}
        activeChips={activeChips}
        onClearAll={resetFilters}
        resultsCount={filtered.length}
        primaryFilters={
          <>
            <Select label="Categoría" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Todas las categorías</option>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{DOCUMENT_CATEGORY_LABELS[cat]}</option>
              ))}
            </Select>
            <Select label="Año" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">Todos los años</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </Select>
          </>
        }
        secondaryFilters={
          <>
            <Select label="Comisión" value={commissionFilter} onChange={(e) => setCommissionFilter(e.target.value)}>
              <option value="">Todas las comisiones</option>
              {commissions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select label="Ordenar por" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recientes' | 'titulo' | 'descargas')}>
              <option value="recientes">Año más reciente</option>
              <option value="titulo">Título (A–Z)</option>
              <option value="descargas">Más descargados</option>
            </Select>
          </>
        }
        viewToggle={
          <div className="flex h-[44px] items-center rounded-lg border border-stone-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode('tarjetas')}
              aria-label="Vista en tarjetas"
              className={`rounded-md p-2 ${viewMode === 'tarjetas' ? 'bg-[#7B1832] text-white' : 'text-stone-600 dark:text-slate-300'}`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tabla')}
              aria-label="Vista en tabla"
              className={`rounded-md p-2 ${viewMode === 'tabla' ? 'bg-[#7B1832] text-white' : 'text-stone-600 dark:text-slate-300'}`}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin documentos para esos filtros"
          description="Ajusta la búsqueda, categoría, año o comisión para consultar el archivo oficial."
          actionLabel="Limpiar filtros"
          onAction={resetFilters}
        />
      ) : viewMode === 'tabla' ? (
        <Card padding="none" className="overflow-hidden">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-stone-200 bg-[#FAF8F4] text-stone-600 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Consecutivo</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Año</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-slate-800">
                {visibleDocs.map((docItem) => (
                  <tr key={docItem.id}>
                    <td className="px-4 py-3 font-mono-tabular text-[#7B1832] dark:text-[#D9B245]">{docItem.consecutiveNumber || '—'}</td>
                    <td className="px-4 py-3 font-medium text-stone-950 dark:text-white">{docItem.title}</td>
                    <td className="px-4 py-3 text-stone-600 dark:text-slate-300">{DOCUMENT_CATEGORY_LABELS[docItem.category] || docItem.category}</td>
                    <td className="px-4 py-3 font-mono-tabular text-stone-500">{extractDocumentYear(docItem)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => onPreview(docItem)}>Ver</Button>
                        <span onClick={() => void incrementDocumentDownloadCount(docItem.id)}>
                          <StorageDownloadButton compact item={docItem} />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleDocs.map((docItem) => {
            const comm = commissions.find((c) => c.id === docItem.commissionId);
            return (
              <Card key={docItem.id} padding="sm" variant="interactive">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      {DOCUMENT_CATEGORY_LABELS[docItem.category] || docItem.category}
                      {docItem.consecutiveNumber ? ` · ${docItem.consecutiveNumber}` : ''} · {extractDocumentYear(docItem)} · v{docItem.currentVersion} · {formatFileSize(docItem.fileSize)}
                      {(docItem.downloadCount ?? 0) > 0 ? ` · ${docItem.downloadCount} descargas` : ''}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{docItem.title}</h3>
                    {comm && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate(`/comisiones/${getCommissionSlug(comm)}`)}
                        className="mt-0.5 text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
                      >
                        Comisión: {comm.name} →
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <WhatsAppShareButton text={`Documento público CMJ Flandes: ${docItem.title}`} />
                    {(docItem.fileMime === 'application/pdf' || docItem.fileMime.startsWith('image/') || docItem.fileMime.startsWith('video/')) && (
                      <Button size="sm" variant="outline" onClick={() => onPreview(docItem)}>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ver</span>
                      </Button>
                    )}
                    <span onClick={() => void incrementDocumentDownloadCount(docItem.id)}>
                      <StorageDownloadButton item={docItem} />
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {visibleCount < filtered.length && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_STEP)}>
            Cargar más documentos ({filtered.length - visibleCount} restantes)
          </Button>
        </div>
      )}
    </div>
  );
}
