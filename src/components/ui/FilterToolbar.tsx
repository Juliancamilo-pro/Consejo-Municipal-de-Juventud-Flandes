import { ReactNode, useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { Drawer } from './Drawer';
import { Input } from './Input';

export interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface FilterToolbarProps {
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  primaryFilters?: ReactNode;
  secondaryFilters?: ReactNode;
  activeSecondaryCount?: number;
  viewToggle?: ReactNode;
  activeChips?: FilterChip[];
  onClearAll?: () => void;
  resultsCount?: number;
  className?: string;
}

export function FilterToolbar({
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  primaryFilters,
  secondaryFilters,
  activeSecondaryCount = 0,
  viewToggle,
  activeChips = [],
  onClearAll,
  resultsCount,
  className = '',
}: FilterToolbarProps) {
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleToggleMore = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setMobileDrawerOpen(true);
      return;
    }
    setDesktopExpanded((prev) => !prev);
  };

  const hasFilters = activeChips.length > 0;

  return (
    <Card padding="sm" className={className}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-12">
          <div className={`relative min-w-0 ${primaryFilters ? 'md:col-span-4' : 'md:col-span-8'}`}>
            <Search
              className="pointer-events-none absolute top-[41px] left-3 h-4 w-4 text-stone-400"
              aria-hidden="true"
            />
            <Input
              label={searchLabel}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>

          {primaryFilters && (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-5">
              {primaryFilters}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 md:col-span-3 md:justify-end">
            {secondaryFilters && (
              <Button
                type="button"
                variant={desktopExpanded || activeSecondaryCount > 0 ? 'secondary' : 'outline'}
                size="md"
                onClick={handleToggleMore}
                aria-expanded={desktopExpanded || mobileDrawerOpen}
                className="min-h-[44px] whitespace-nowrap"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Más filtros</span>
                {activeSecondaryCount > 0 && (
                  <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 font-mono-tabular text-[11px] font-semibold">
                    {activeSecondaryCount}
                  </span>
                )}
              </Button>
            )}
            {viewToggle}
          </div>
        </div>

        {secondaryFilters && desktopExpanded && (
          <div className="hidden border-t border-stone-200 pt-4 sm:block dark:border-slate-800">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {secondaryFilters}
            </div>
          </div>
        )}

        {(hasFilters || (typeof resultsCount === 'number' && resultsCount > 0)) && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-stone-200/80 pt-3 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={chip.onRemove}
                  aria-label={`Quitar filtro ${chip.label}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#7B1832]/30 bg-[#7B1832]/5 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[#7B1832] transition-colors hover:bg-[#7B1832]/12 dark:border-[#D9B245]/40 dark:bg-[#D9B245]/10 dark:text-[#D9B245] dark:hover:bg-[#D9B245]/20"
                >
                  <span>{chip.label}</span>
                  <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              ))}

              {hasFilters && onClearAll && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold whitespace-nowrap text-stone-600 transition-colors hover:text-[#7B1832] hover:underline dark:text-slate-300 dark:hover:text-[#D9B245]"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Limpiar todo</span>
                </button>
              )}
            </div>

            {typeof resultsCount === 'number' && resultsCount > 0 && (
              <span className="font-mono-tabular text-xs font-medium whitespace-nowrap text-stone-500 dark:text-slate-400">
                {resultsCount} {resultsCount === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
          </div>
        )}
      </div>

      {secondaryFilters && (
        <Drawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          title="Más filtros"
          subtitle="Ajusta los criterios para refinar los resultados"
        >
          <div className="space-y-4">
            {secondaryFilters}
            <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-slate-800">
              {onClearAll && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClearAll();
                    setMobileDrawerOpen(false);
                  }}
                >
                  Limpiar todo
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="ml-auto"
                onClick={() => setMobileDrawerOpen(false)}
              >
                Aplicar filtros
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </Card>
  );
}
