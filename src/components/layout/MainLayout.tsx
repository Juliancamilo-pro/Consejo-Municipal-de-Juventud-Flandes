import { ReactNode, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AccessibilitySettings, FontScale } from '../../types/accessibility';
import { AppRoute } from '../../types/navigation';
import { DEFAULT_SITE_APPEARANCE, SiteAppearanceConfig } from '../../types/siteContent';
import { resolveActiveSeasonalTheme } from '../../utils/seasonalThemeResolver';
import { SeasonalThemeBanner } from '../theme/SeasonalThemeBanner';
import { CommandPalette } from '../ui/CommandPalette';
import { PageTransition } from '../ui/MotionPrimitives';
import { OfflineBanner } from '../ui/OfflineBanner';
import { AccessibilityMenu } from './AccessibilityMenu';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { SkipLinks } from './SkipLinks';

interface MainLayoutProps {
  currentRoute: AppRoute;
  onNavigate: (path: AppRoute) => void;
  portal: PublicPortalState;
  siteContent?: SiteAppearanceConfig;
  accessibility: {
    settings: AccessibilitySettings;
    toggleTheme: () => void;
    setFontScale: (scale: FontScale) => void;
    toggleHighContrast: () => void;
    toggleReduceMotion: () => void;
    toggleHideSeasonalOrnaments?: () => void;
    resetAccessibility: () => void;
  };
  children: ReactNode;
}

export function MainLayout({
  currentRoute,
  onNavigate,
  portal,
  siteContent = DEFAULT_SITE_APPEARANCE,
  accessibility,
  children,
}: MainLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const resolvedTheme = useMemo(
    () => resolveActiveSeasonalTheme(siteContent),
    [siteContent],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const hideOrnaments = Boolean(accessibility.settings.hideSeasonalOrnaments);

  return (
    <MotionConfig reducedMotion={accessibility.settings.reduceMotion ? 'always' : 'user'}>
      <div className="flex min-h-screen flex-col bg-[#FAFAF8] text-stone-900 transition-colors duration-200 dark:bg-[#0F172A] dark:text-slate-100">
        <SkipLinks />
        <OfflineBanner />
        <Navbar
          currentRoute={currentRoute}
          onNavigate={onNavigate}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <SeasonalThemeBanner theme={resolvedTheme.theme} hideOrnaments={hideOrnaments} />

        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {portal.error && (
            <div
              role="alert"
              className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-100"
            >
              <span>{portal.error}</span>
              <button
                type="button"
                onClick={() => void portal.reload()}
                className="inline-flex min-h-[36px] items-center rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950"
              >
                Reintentar
              </button>
            </div>
          )}
          <PageTransition routeKey={currentRoute}>{children}</PageTransition>
        </main>

        <Footer
          onNavigate={onNavigate}
          theme={accessibility.settings.theme}
          onToggleTheme={accessibility.toggleTheme}
        />

        <CommandPalette
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigate={onNavigate}
          portal={portal}
        />

        <AccessibilityMenu
          settings={accessibility.settings}
          onToggleTheme={accessibility.toggleTheme}
          onSetFontScale={accessibility.setFontScale}
          onToggleHighContrast={accessibility.toggleHighContrast}
          onToggleReduceMotion={accessibility.toggleReduceMotion}
          onToggleHideSeasonalOrnaments={accessibility.toggleHideSeasonalOrnaments || (() => undefined)}
          onReset={accessibility.resetAccessibility}
        />
      </div>
    </MotionConfig>
  );
}
