import { Bell, ChevronRight, Compass, LogOut, RefreshCw, Search } from 'lucide-react';
import { ROLE_LABELS, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';

interface PrivatePortalHeaderProps {
  profile: UserProfile;
  activeLabel: string;
  quickFilter: string;
  onQuickFilterChange: (value: string) => void;
  totalAlertsBadge: number;
  onOpenNotifications: () => void;
  onOpenTour: () => void;
  onReload: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export function PrivatePortalHeader({
  profile,
  activeLabel,
  quickFilter,
  onQuickFilterChange,
  totalAlertsBadge,
  onOpenNotifications,
  onOpenTour,
  onReload,
  onLogout,
}: PrivatePortalHeaderProps) {
  return (
    <header className="cmj-territorial-weave border-b border-stone-200/90 bg-[#F7F4EE] dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 py-5 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
            <span>Despacho de Consejeros</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            <span className="text-stone-700 dark:text-slate-300">{activeLabel}</span>
          </div>
          <h1 className="cmj-display-section mt-1 font-display font-semibold text-stone-950 dark:text-white">
            {activeLabel}
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-slate-400">
            {profile.displayName} · {ROLE_LABELS[profile.role]} · CMJ Flandes, Tolima (2026–2029)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative hidden sm:block">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={quickFilter}
              onChange={(e) => onQuickFilterChange(e.target.value)}
              placeholder="Filtrar módulo..."
              aria-label="Filtrar módulos del panel"
              className="min-h-[38px] w-44 rounded-lg border border-stone-300 bg-white pr-2.5 pl-8 text-xs text-stone-900 transition-colors focus:border-[#7B1832] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-[#D9B245]"
            />
          </div>

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Abrir alertas y avisos internos"
            className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 transition-colors hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {totalAlertsBadge > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7B1832] px-1 text-[10px] font-bold text-white dark:bg-[#D9B245] dark:text-slate-950">
                {totalAlertsBadge}
              </span>
            )}
          </button>

          <Button size="sm" variant="outline" onClick={onOpenTour}>
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tour</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => void onReload()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Actualizar</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => void onLogout()}>
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Salir</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
