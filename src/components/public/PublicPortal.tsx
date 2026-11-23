import React, { useState } from 'react';
import {
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { FESTIVE_THEMES } from '../../lib/seedData';
import type {
  CallOrSurvey,
  Commission,
  GalleryItem,
  NewsEvent,
  PortalDocument,
  PortalSettings,
  PublicCouncilor,
  PublicSection,
} from '../../types/cmj';
import { HeroBannerSection, IdentityAndDirectorySection } from './PublicSections';
import { PublicMediaAndCivic } from './PublicMediaAndCivic';

const NAV_ITEMS: { id: PublicSection; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'quienes_somos', label: '¿Qué es?' },
  { id: 'consejeros', label: 'Consejeros' },
  { id: 'comisiones', label: 'Comisiones' },
  { id: 'noticias', label: 'Noticias' },
  { id: 'galeria', label: 'Galería' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'convocatorias', label: 'Participa' },
  { id: 'contacto', label: 'Contacto' },
];

export function PublicPortal({
  settings,
  commissions,
  councilors,
  newsEvents,
  galleryItems,
  documents,
  callsSurveys,
  isAuthenticated,
  darkMode,
  onToggleDarkMode,
  onOpenAuth,
  onEnterPrivatePortal,
}: {
  settings: PortalSettings;
  commissions: Commission[];
  councilors: PublicCouncilor[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
  documents: PortalDocument[];
  callsSurveys: CallOrSurvey[];
  isAuthenticated: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAuth: () => void;
  onEnterPrivatePortal: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeTheme =
    FESTIVE_THEMES.find((t) => t.id === settings.activeTheme) || FESTIVE_THEMES[0];

  const scrollToSection = (sectionId: PublicSection) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const publishedCount =
    newsEvents.filter((n) => n.status === 'publicado').length +
    documents.filter((d) => d.visibility === 'publico').length;
  const openCallsCount = callsSurveys.filter((c) => c.status === 'abierta').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      {activeTheme.ribbonText && (
        <div className={`${activeTheme.bannerBg} px-4 py-2 text-center text-xs font-semibold`}>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            {activeTheme.ribbonText}
          </span>
        </div>
      )}

      {/* Barra de navegación */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => scrollToSection('inicio')}
            className="flex items-center gap-3 text-left cursor-pointer"
          >
            <div
              className={`h-9 w-9 rounded-xl bg-gradient-to-br ${activeTheme.accentGradient} flex items-center justify-center text-white font-extrabold text-sm shadow-sm`}
            >
              CMJ
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                CMJ Flandes
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Tolima · Juventudes
              </p>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Cambiar modo claro u oscuro"
              className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={onEnterPrivatePortal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Portal Privado
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 cursor-pointer whitespace-nowrap"
              >
                <Lock className="h-3.5 w-3.5" />
                Acceso Consejeros
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Menú"
              className="lg:hidden rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 grid grid-cols-2 gap-1.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main>
        <HeroBannerSection
          settings={settings}
          councilorsCount={councilors.length}
          commissionsCount={commissions.length}
          publishedCount={publishedCount}
          openCallsCount={openCallsCount}
          themeGradient={activeTheme.accentGradient}
          onNavigate={scrollToSection}
        />

        <IdentityAndDirectorySection
          settings={settings}
          councilors={councilors}
          commissions={commissions}
          isAuthenticated={isAuthenticated}
          onEnterPrivatePortal={onEnterPrivatePortal}
        />

        <PublicMediaAndCivic
          settings={settings}
          commissions={commissions}
          newsEvents={newsEvents}
          galleryItems={galleryItems}
          documents={documents}
          callsSurveys={callsSurveys}
          isAuthenticated={isAuthenticated}
          onEnterPrivatePortal={onEnterPrivatePortal}
        />
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <strong className="text-slate-800 dark:text-slate-200">
              Consejo Municipal de Juventudes (CMJ) · Flandes, Tolima
            </strong>
            <p className="mt-0.5">Ley Estatutaria 1622 de 2013 · Ley 1885 de 2018</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => scrollToSection('documentos')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Transparencia
            </button>
            <button
              type="button"
              onClick={isAuthenticated ? onEnterPrivatePortal : onOpenAuth}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Portal Privado
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default PublicPortal;
