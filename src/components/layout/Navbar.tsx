import { useEffect, useState } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppRoute, PUBLIC_NAV_ITEMS } from '../../types/navigation';
import { BrandEmblem } from '../ui/BrandEmblem';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (path: AppRoute) => void;
  onOpenSearch?: () => void;
}

export function Navbar({ currentRoute, onNavigate, onOpenSearch }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLinkClick = (path: AppRoute) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-md transition-all duration-200 ${
        scrolled
          ? 'border-stone-300/90 bg-[#FAFAF8]/98 shadow-sm dark:border-slate-700/90 dark:bg-[#0F172A]/98'
          : 'border-stone-200/90 bg-[#FAFAF8]/95 dark:border-slate-800 dark:bg-[#0F172A]/95'
      }`}
    >
      <div className="cmj-tricolor-rule h-[3px] w-full" aria-hidden="true" />
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 transition-all duration-200 sm:px-6 lg:gap-8 lg:px-8 ${
          scrolled ? 'h-14' : 'h-16'
        }`}
      >
        {/* Zona 1: Marca institucional en una sola línea */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick('/');
          }}
          className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap font-display text-lg font-semibold tracking-tight text-stone-900 transition-opacity duration-150 hover:opacity-85 dark:text-slate-100"
        >
          <BrandEmblem className={`shrink-0 transition-all duration-200 ${scrolled ? 'h-6 w-6' : 'h-7 w-7'}`} />
          <span>CMJ Flandes</span>
        </a>

        {/* Zona 2: Enlaces de navegación limpios de una sola línea */}
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-4 lg:gap-5 xl:gap-6 md:flex"
        >
          {PUBLIC_NAV_ITEMS.map((item) => {
            const baseRoute = currentRoute.split('?')[0];
            const isActive =
              baseRoute === item.path ||
              (item.path === '/consejeros' && baseRoute.startsWith('/consejeros/')) ||
              (item.path === '/comisiones' && baseRoute.startsWith('/comisiones/'));
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.path);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`relative shrink-0 whitespace-nowrap py-1 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'font-semibold text-[#7B1832] dark:text-[#D9B245]'
                    : 'text-stone-600 hover:text-stone-950 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 h-[2px] bg-[#7B1832] transition-all duration-200 dark:bg-[#D9B245] ${
                      scrolled ? '-bottom-[16px]' : '-bottom-[20px]'
                    }`}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zona 3: Buscador global, acción primaria y menú móvil */}
        <div className="flex shrink-0 items-center gap-2">
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Buscar en el portal (Ctrl+K)"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">Buscar</span>
              <kbd className="hidden rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono-tabular text-[10px] text-stone-500 xl:inline dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                ⌘K
              </kbd>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleLinkClick('/portal')}
            className="hidden min-h-[40px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#7B1832] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#611227] active:scale-[0.98] dark:bg-[#A62B4B] dark:hover:bg-[#BD385B] md:inline-flex"
          >
            Portal Consejeros
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-800 transition-colors duration-150 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 md:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            id="mobile-nav-drawer"
            aria-label="Navegación móvil"
            initial={prefersReduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="border-t border-stone-200 bg-[#FAFAF8] px-4 pb-5 pt-3 dark:border-slate-800 dark:bg-[#0F172A] md:hidden"
          >
            <ul className="space-y-1">
              {PUBLIC_NAV_ITEMS.map((item) => {
                const baseRoute = currentRoute.split('?')[0];
                const isActive =
                  baseRoute === item.path ||
                  (item.path === '/consejeros' && baseRoute.startsWith('/consejeros/')) ||
                  (item.path === '/comisiones' && baseRoute.startsWith('/comisiones/'));
                return (
                  <li key={item.path}>
                    <a
                      href={item.path}
                      onClick={(e) => {
                        e.preventDefault();
                        handleLinkClick(item.path);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex min-h-[44px] items-center rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                        isActive
                          ? 'bg-[#7B1832]/10 text-[#7B1832] dark:bg-[#A62B4B]/20 dark:text-[#F3D77E]'
                          : 'text-stone-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
              <li>
                <a
                  href="/contacto"
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick('/contacto');
                  }}
                  aria-current={currentRoute === '/contacto' ? 'page' : undefined}
                  className={`flex min-h-[44px] items-center rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                    currentRoute === '/contacto'
                      ? 'bg-[#7B1832]/10 text-[#7B1832] dark:bg-[#A62B4B]/20 dark:text-[#F3D77E]'
                      : 'text-stone-700 hover:bg-stone-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  Contacto y PQRSD
                </a>
              </li>
            </ul>
            <div className="mt-4 border-t border-stone-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleLinkClick('/portal')}
                className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#7B1832] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#611227] dark:bg-[#A62B4B] dark:hover:bg-[#BD385B]"
              >
                Portal Consejeros
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
