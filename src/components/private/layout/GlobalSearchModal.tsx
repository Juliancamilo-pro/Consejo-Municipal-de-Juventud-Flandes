import React, { useEffect } from 'react';
import { Search } from 'lucide-react';
import type { PrivateModule } from '../../../types/cmj';

export interface GlobalSearchHit {
  id: string;
  title: string;
  subtitle: string;
  module: PrivateModule;
  badge: string;
}

export function GlobalSearchModal({
  open,
  query,
  hits,
  onQueryChange,
  onSelect,
  onClose,
}: {
  open: boolean;
  query: string;
  hits: GlobalSearchHit[];
  onQueryChange: (val: string) => void;
  onSelect: (module: PrivateModule) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Búsqueda global"
      className="fixed inset-0 z-[85] flex items-start justify-center pt-12 sm:pt-20 bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar consejeros, actas, sesiones, documentos o votaciones..."
            aria-label="Buscar en el portal privado"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
          >
            Esc
          </button>
        </div>
        <div className="max-h-[65vh] sm:max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {hits.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">
              No se encontraron resultados para "{query}".
            </p>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => {
                  onSelect(hit.module);
                  onClose();
                }}
                className="w-full min-h-[48px] text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {hit.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{hit.subtitle}</p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                  {hit.badge}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
