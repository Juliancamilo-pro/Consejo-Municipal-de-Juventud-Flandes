import React, { useState } from 'react';
import {
  LayoutDashboard,
  Lock,
  MapPin,
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
  GalleryAlbum,
  GalleryItem,
  NewsEvent,
  PortalActa,
  PortalDocument,
  PortalSettings,
  PublicCouncilor,
  PublicSection,
} from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import { OfflineIndicator, PWAInstallButton } from '../PWAInstallButton';
import { HeroBannerSection, IdentityAndDirectorySection } from './PublicSections';
import { PublicMediaAndCivic } from './PublicMediaAndCivic';

const DESKTOP_NAV_ITEMS: { id: PublicSection; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'quienes_somos', label: 'Consejo' },
  { id: 'consejeros', label: 'Consejeros' },
  { id: 'noticias', label: 'Actualidad' },
  { id: 'convocatorias', label: 'Participa' },
];

const ALL_SECTION_ITEMS: { id: PublicSection; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'quienes_somos', label: '¿Qué es el CMJ?' },
  { id: 'consejeros', label: 'Consejeros' },
  { id: 'comisiones', label: 'Las 5 Comisiones' },
  { id: 'noticias', label: 'Noticias y Eventos' },
  { id: 'galeria', label: 'Galería Multimedia' },
  { id: 'documentos', label: 'Transparencia y Actas' },
  { id: 'convocatorias', label: 'Convocatorias y Encuestas' },
  { id: 'contacto', label: 'Buzón y Contacto' },
];

export function PublicPortal({
  settings,
  commissions,
  councilors,
  newsEvents,
  galleryItems,
  galleryAlbums = [],
  documents,
  actas = [],
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
  galleryAlbums?: GalleryAlbum[];
  documents: PortalDocument[];
  actas?: PortalActa[];
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
    documents.filter((d) => d.visibility === 'publico').length +
    actas.length;
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

      {/* Barra de navegación de 3 zonas */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => scrollToSection('inicio')}
            className="flex items-center gap-3 text-left cursor-pointer shrink-0"
          >
            <BrandLogo size="md" />
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                CMJ Flandes
              </p>
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
                Consejo Municipal de Juventudes
              </p>
            </div>
          </button>

          <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-1">
            {DESKTOP_NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact />
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Portal Privado
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
              >
                <Lock className="h-3.5 w-3.5" />
                Acceso Consejeros
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menú de navegación"
              className="lg:hidden rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {ALL_SECTION_ITEMS.map((item) => (
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
          galleryAlbums={galleryAlbums}
          documents={documents}
          actas={actas}
          callsSurveys={callsSurveys}
          isAuthenticated={isAuthenticated}
          onEnterPrivatePortal={onEnterPrivatePortal}
        />
      </main>
      <OfflineIndicator />

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 flex items-start gap-4">
            <BrandLogo size="lg" />
            <div className="space-y-1.5">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Consejo Municipal de Juventudes de Flandes
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Mecanismo autónomo de participación, concertación y control social juvenil en el municipio de Flandes, Tolima.
              </p>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <MapPin className="h-3.5 w-3.5" /> Flandes, Tolima · Ley 1622 de 2013 y Ley 1885 de 2018
              </p>
            </div>
          </div>

          <div className="md:col-span-4 grid grid-cols-2 gap-2 text-xs">
            {ALL_SECTION_ITEMS.slice(1).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="text-left text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 py-1 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-3 md:text-right space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Acceso Institucional
            </p>
            <div>
              <button
                type="button"
                onClick={isAuthenticated ? onEnterPrivatePortal : onOpenAuth}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5" />
                {isAuthenticated ? 'Ir al Portal Privado' : 'Ingreso de Consejeros'}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default PublicPortal;
