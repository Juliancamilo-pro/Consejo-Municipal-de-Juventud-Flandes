import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FileText, FolderKanban, Megaphone, Search, UserCheck, X } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute, PUBLIC_NAV_ITEMS } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: AppRoute) => void;
  portal: PublicPortalState;
}

interface SearchHit {
  id: string;
  group: 'Sección' | 'Consejero' | 'Noticia' | 'Documento' | 'Proyecto';
  title: string;
  subtitle: string;
  route: AppRoute;
}

export function CommandPalette({ open, onClose, onNavigate, portal }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) onClose();
      } else if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const list: SearchHit[] = [];

    for (const nav of PUBLIC_NAV_ITEMS) {
      list.push({
        id: `nav-${nav.path}`,
        group: 'Sección',
        title: nav.label,
        subtitle: nav.description,
        route: nav.path,
      });
    }

    for (const c of portal.directory) {
      const slug = c.slug || slugifyCouncilorName(c.displayName, c.uid);
      list.push({
        id: `c-${c.uid}`,
        group: 'Consejero',
        title: c.displayName,
        subtitle: [c.positionTitle, c.sector, c.commissionName].filter(Boolean).join(' · ') || 'Consejero CMJ Flandes',
        route: `/consejeros/${slug}`,
      });
    }

    for (const n of portal.news) {
      list.push({
        id: `n-${n.id}`,
        group: 'Noticia',
        title: n.title,
        subtitle: n.summary,
        route: '/actualidad',
      });
    }

    for (const d of portal.documents) {
      list.push({
        id: `d-${d.id}`,
        group: 'Documento',
        title: d.title,
        subtitle: `${d.category.toUpperCase()} · Versión ${d.currentVersion}`,
        route: '/gestion',
      });
    }

    for (const p of portal.projects) {
      list.push({
        id: `p-${p.id}`,
        group: 'Proyecto',
        title: p.title,
        subtitle: `${p.progressPercent}% · ${p.summary}`,
        route: '/gestion',
      });
    }

    if (!q) return list.slice(0, 8);
    return list
      .filter((item) => `${item.title} ${item.subtitle} ${item.group}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, portal]);

  if (!open) return null;

  const pick = (route: AppRoute) => {
    setQuery('');
    onClose();
    onNavigate(route);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscador global del portal CMJ Flandes"
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/60 p-4 pt-16 backdrop-blur-xs sm:pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-stone-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar consejeros, actas, noticias, proyectos..."
            className="w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-slate-100"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar buscador"
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto p-2 dark:divide-slate-800/80">
          {hits.length === 0 ? (
            <li className="px-4 py-8 text-center text-xs text-stone-500 dark:text-slate-400">
              No se encontraron coincidencias para "{query}".
            </li>
          ) : (
            hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => pick(hit.route)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-stone-100 dark:hover:bg-slate-800/70"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F7F4EE] text-[#7B1832] dark:bg-slate-800 dark:text-[#D9B245]">
                      {hit.group === 'Consejero' ? (
                        <UserCheck className="h-4 w-4" />
                      ) : hit.group === 'Noticia' ? (
                        <Megaphone className="h-4 w-4" />
                      ) : hit.group === 'Proyecto' ? (
                        <FolderKanban className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900 dark:text-white">
                        {hit.title}
                      </p>
                      <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                        {hit.group} · {hit.subtitle}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2 text-[11px] text-stone-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <span>Búsqueda pública en tiempo real</span>
          <span className="font-mono-tabular">Esc para cerrar · Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
