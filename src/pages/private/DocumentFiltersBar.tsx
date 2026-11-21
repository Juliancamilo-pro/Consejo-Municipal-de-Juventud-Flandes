import { LayoutGrid, List, Search } from 'lucide-react';
import { Commission, InstitutionalDocument } from '../../types/models';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
} from '../../utils/documentUtils';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';

export type DocumentQuickView = 'todos' | 'mios' | 'pendientes' | 'recientes';
export type DocumentViewMode = 'tarjetas' | 'tabla';

interface DocumentFiltersBarProps {
  documents: InstitutionalDocument[];
  commissions: Commission[];
  availableYears: number[];
  quickView: DocumentQuickView;
  viewMode: DocumentViewMode;
  search: string;
  catFilter: string;
  statusFilter: string;
  comFilter: string;
  visFilter: string;
  yearFilter: string;
  onQuickView: (next: DocumentQuickView) => void;
  onViewMode: (next: DocumentViewMode) => void;
  onSearch: (v: string) => void;
  onCat: (v: string) => void;
  onStatus: (v: string) => void;
  onCom: (v: string) => void;
  onVis: (v: string) => void;
  onYear: (v: string) => void;
}

export function DocumentFiltersBar({
  documents,
  commissions,
  availableYears,
  quickView,
  viewMode,
  search,
  catFilter,
  statusFilter,
  comFilter,
  visFilter,
  yearFilter,
  onQuickView,
  onViewMode,
  onSearch,
  onCat,
  onStatus,
  onCom,
  onVis,
  onYear,
}: DocumentFiltersBarProps) {
  return (
    <Card padding="sm" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Tabs
          ariaLabel="Vistas rápidas de documentos"
          activeId={quickView}
          onChange={onQuickView}
          options={[
            { id: 'todos', label: `Todos (${documents.length})` },
            { id: 'mios', label: 'Mis documentos' },
            {
              id: 'pendientes',
              label: `En revisión (${documents.filter((d) => d.status === 'revision').length})`,
            },
            { id: 'recientes', label: 'Recientes' },
          ]}
        />

        <div className="flex items-center gap-1 rounded-lg border border-stone-200 p-0.5 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onViewMode('tarjetas')}
            aria-label="Vista en tarjetas"
            className={`rounded-md p-2 ${
              viewMode === 'tarjetas'
                ? 'bg-[#7B1832] text-white'
                : 'text-stone-600 dark:text-slate-300'
            }`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onViewMode('tabla')}
            aria-label="Vista en tabla"
            className={`rounded-md p-2 ${
              viewMode === 'tabla'
                ? 'bg-[#7B1832] text-white'
                : 'text-stone-600 dark:text-slate-300'
            }`}
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search
            className="pointer-events-none absolute top-9 left-3 h-4 w-4 text-stone-400"
            aria-hidden="true"
          />
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Título, consecutivo, etiqueta..."
            className="pl-9"
          />
        </div>
        <Select label="Categoría" value={catFilter} onChange={(e) => onCat(e.target.value)}>
          <option value="">Todas</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {DOCUMENT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select label="Estado" value={statusFilter} onChange={(e) => onStatus(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(DOCUMENT_STATUS_LABELS).map(([k, lbl]) => (
            <option key={k} value={k}>
              {lbl}
            </option>
          ))}
        </Select>
        <Select label="Comisión" value={comFilter} onChange={(e) => onCom(e.target.value)}>
          <option value="">Todas</option>
          {commissions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Visibilidad" value={visFilter} onChange={(e) => onVis(e.target.value)}>
            <option value="">Todas</option>
            <option value="publico">Público</option>
            <option value="interno">Interno</option>
          </Select>
          <Select label="Año" value={yearFilter} onChange={(e) => onYear(e.target.value)}>
            <option value="">Todos</option>
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Card>
  );
}
