import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  Briefcase,
  ChevronRight,
  Compass,
  ExternalLink,
  GraduationCap,
  Layers,
  Leaf,
  MapPin,
  Music,
  Scale,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import type { Commission, PortalSettings, PublicCouncilor, PublicSection } from '../../types/cmj';
import { AnimatedCounter, EmptyState, SectionReveal } from '../ui/AnimatedPrimitives';
import { AvatarBadge } from './AvatarBadge';

export function CommissionIcon({ name }: { name?: string }) {
  switch (name) {
    case 'GraduationCap':
      return <GraduationCap className="h-5 w-5" />;
    case 'Leaf':
      return <Leaf className="h-5 w-5" />;
    case 'Music':
      return <Music className="h-5 w-5" />;
    case 'Briefcase':
      return <Briefcase className="h-5 w-5" />;
    case 'Scale':
      return <Scale className="h-5 w-5" />;
    default:
      return <Layers className="h-5 w-5" />;
  }
}

export function HeroBannerSection({
  settings,
  councilorsCount,
  commissionsCount,
  publishedCount,
  openCallsCount,
  themeGradient,
  onNavigate,
}: {
  settings: PortalSettings;
  councilorsCount: number;
  commissionsCount: number;
  publishedCount: number;
  openCallsCount: number;
  themeGradient: string;
  onNavigate: (sec: PublicSection) => void;
}) {
  return (
    <section id="inicio" className="relative pt-8 pb-14 sm:pt-12 sm:pb-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-cyan-900/60 bg-blue-50 dark:bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-cyan-300">
              <MapPin className="h-3.5 w-3.5" />
              Flandes, Tolima · Ley 1622 de 2013 y Ley 1885 de 2018
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12] text-balance">
              {settings.heroTitle}
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {settings.heroSubtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('convocatorias')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors cursor-pointer"
              >
                Participar y opinar
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('comisiones')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Conocer las 5 comisiones
              </button>
            </div>

            {/* Indicadores numéricos calculados desde datos reales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={councilorsCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Consejeros activos
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={commissionsCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Comisiones de trabajo
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={publishedCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Publicaciones y actas
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={openCallsCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Consultas abiertas
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 aspect-[16/10] shadow-xl">
              {settings.heroImageUrl ? (
                <img
                  src={settings.heroImageUrl}
                  alt="Consejo Municipal de Juventudes de Flandes"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className={`relative h-full w-full bg-gradient-to-br ${themeGradient} p-8 flex flex-col justify-between text-white`}>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 600 360"
                    className="absolute inset-0 h-full w-full opacity-20 pointer-events-none"
                  >
                    <defs>
                      <pattern id="cmj-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="600" height="360" fill="url(#cmj-grid)" />
                    <path
                      d="M0 280 C 120 220, 220 330, 340 270 C 440 220, 520 285, 600 245 L 600 360 L 0 360 Z"
                      fill="white"
                      fillOpacity="0.25"
                    />
                  </svg>
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="rounded-lg bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-semibold">
                      Portal Ciudadano Juvenil
                    </span>
                    <span className="font-mono-num text-xs opacity-90">Flandes · Tolima</span>
                  </div>
                  <div className="relative z-10 space-y-2 max-w-md">
                    <p className="text-xs uppercase tracking-wider font-semibold text-white/80">
                      Democracia joven junto al río Magdalena
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                      Participación, control social y agenda de juventudes
                    </h2>
                    <p className="text-xs text-white/85">
                      La Mesa Directiva puede cargar una fotografía institucional de portada desde el Editor del Portal.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function IdentityAndDirectorySection({
  settings,
  councilors,
  commissions,
  isAuthenticated,
  onEnterPrivatePortal,
}: {
  settings: PortalSettings;
  councilors: PublicCouncilor[];
  commissions: Commission[];
  isAuthenticated: boolean;
  onEnterPrivatePortal: () => void;
}) {
  const [searchText, setSearchText] = useState('');
  const [commissionFilter, setCommissionFilter] = useState('todas');

  const filteredCouncilors = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return councilors
      .filter((c) => {
        if (commissionFilter !== 'todas' && c.commissionId !== commissionFilter) return false;
        if (!q) return true;
        return (
          c.fullName.toLowerCase().includes(q) ||
          c.roleLabel.toLowerCase().includes(q) ||
          c.commissionName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
  }, [councilors, searchText, commissionFilter]);

  return (
    <>
      <SectionReveal id="quienes_somos" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
              Identidad Institucional
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              ¿Qué es el CMJ Flandes?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {settings.aboutText}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Misión</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {settings.missionText}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Award className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Visión</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {settings.visionText}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Marco Legal</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Estatuto de Ciudadanía Juvenil (Ley 1622 de 2013 y Ley 1885 de 2018): interlocución directa ante la Alcaldía y Concejo Municipal.
              </p>
            </div>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal id="consejeros" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                Mesa Directiva y Plenaria
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Consejeros Municipales de Juventud
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar consejero..."
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={commissionFilter}
                onChange={(e) => setCommissionFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="todas">Todas las comisiones</option>
                {commissions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredCouncilors.length === 0 ? (
            <EmptyState
              title="Aún no hay perfiles de consejeros publicados"
              description="Cuando la Secretaría y los consejeros completen sus fichas desde el portal privado, aparecerán aquí automáticamente."
              actionLabel={isAuthenticated ? 'Registrar consejeros ahora' : undefined}
              onAction={isAuthenticated ? onEnterPrivatePortal : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCouncilors.map((c) => (
                <article
                  key={c.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-4 hover:border-blue-300 dark:hover:border-cyan-700 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <AvatarBadge name={c.fullName} photoUrl={c.photoUrl} size="lg" />
                    <div className="min-w-0 flex-1">
                      <span className="inline-block rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-cyan-300">
                        {c.roleLabel}
                      </span>
                      <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white truncate">
                        {c.fullName}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {c.commissionName}
                      </p>
                    </div>
                  </div>
                  {c.bio && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {c.bio}
                    </p>
                  )}
                  {(c.instagram || c.facebook) && (
                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {c.instagram && (
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> {c.instagram}
                        </span>
                      )}
                      {c.facebook && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {c.facebook}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </SectionReveal>

      <SectionReveal id="comisiones" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
              Estructura Operativa
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Las 5 Comisiones del CMJ Flandes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {commissions
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((comm) => (
                <article
                  key={comm.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
                >
                  <div className="relative h-36 bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                    {comm.coverUrl ? (
                      <img
                        src={comm.coverUrl}
                        alt={comm.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-full w-full flex items-center justify-between p-5 text-white"
                        style={{
                          background: `linear-gradient(135deg, ${comm.accentColor || '#2563EB'}, #0f172a)`,
                        }}
                      >
                        <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                          <CommissionIcon name={comm.iconName} />
                        </div>
                        <span className="font-mono-num text-3xl font-extrabold opacity-25">
                          0{comm.number}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col gap-2.5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{comm.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                      {comm.description}
                    </p>
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Coordinación:{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {comm.coordinatorName || 'Por asignar'}
                        </strong>
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
