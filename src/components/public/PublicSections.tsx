import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Briefcase,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Globe,
  GraduationCap,
  HeartPulse,
  Layers,
  Leaf,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Music,
  Phone,
  Scale,
  Search,
  Shield,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { Commission, PortalSettings, PublicCouncilor, PublicSection } from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import {
  AnimatedCounter,
  EmptyState,
  ParallaxHero,
  SectionReveal,
  TiltCard,
} from '../ui/AnimatedPrimitives';
import { AvatarBadge } from './AvatarBadge';

export function CommissionIcon({ name }: { name?: string }) {
  switch (name) {
    case 'GraduationCap':
      return <GraduationCap className="h-5 w-5" />;
    case 'BookOpen':
      return <BookOpen className="h-5 w-5" />;
    case 'HeartPulse':
      return <HeartPulse className="h-5 w-5" />;
    case 'Leaf':
      return <Leaf className="h-5 w-5" />;
    case 'Music':
      return <Music className="h-5 w-5" />;
    case 'Briefcase':
      return <Briefcase className="h-5 w-5" />;
    case 'Scale':
      return <Scale className="h-5 w-5" />;
    case 'Users':
      return <Users className="h-5 w-5" />;
    case 'Sparkles':
      return <Sparkles className="h-5 w-5" />;
    case 'Shield':
      return <Shield className="h-5 w-5" />;
    case 'Megaphone':
      return <Megaphone className="h-5 w-5" />;
    case 'Globe':
      return <Globe className="h-5 w-5" />;
    default:
      return <Layers className="h-5 w-5" />;
  }
}

function buildSocialHref(raw: string | undefined, network: 'instagram' | 'facebook'): string | null {
  const val = (raw || '').trim();
  if (!val) return null;
  if (/^https?:\/\//i.test(val)) return val;
  const cleanHandle = val.replace(/^@+/, '').replace(/^\/+/, '');
  if (!cleanHandle) return null;
  return network === 'instagram'
    ? `https://www.instagram.com/${encodeURIComponent(cleanHandle)}`
    : `https://www.facebook.com/${encodeURIComponent(cleanHandle)}`;
}

function buildWhatsappHref(phone?: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  const fullNumber = digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  return `https://wa.me/${fullNumber}`;
}

function buildTelHref(phone?: string): string | null {
  const cleaned = (phone || '').replace(/[^\d+]/g, '');
  return cleaned.length >= 7 ? `tel:${cleaned}` : null;
}

function formatAffiliationLabel(type?: string): string {
  if (type === 'partido') return 'Partido político';
  if (type === 'fundacion') return 'Fundación / Organización';
  if (type === 'independiente') return 'Independiente';
  return '';
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
    <section id="inicio" className="relative pt-8 pb-16 sm:pt-12 sm:pb-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              Flandes, Tolima · Ley 1622 de 2013 y Ley 1885 de 2018
            </p>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] text-balance">
              {settings.heroTitle}
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {settings.heroSubtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('consejeros')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 shadow-sm transition-colors cursor-pointer"
              >
                Conocer a los consejeros
                <ArrowUpRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('convocatorias')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Participar y opinar
              </button>
            </div>

            {/* Indicadores numéricos calculados desde datos reales */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-200 dark:border-slate-800/80">
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="font-mono-num text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={councilorsCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Consejeros activos
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="font-mono-num text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={commissionsCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Comisiones
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="font-mono-num text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={publishedCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Publicaciones y actas
                </p>
              </div>
              <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3.5">
                <p className="font-mono-num text-2xl font-extrabold text-slate-900 dark:text-white">
                  <AnimatedCounter value={openCallsCount} />
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Consultas abiertas
                </p>
              </div>
            </div>
          </div>

          <ParallaxHero className="lg:col-span-6">
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-[16/10] shadow-xl">
              {settings.heroImageUrl ? (
                <>
                  <img
                    src={settings.heroImageUrl}
                    alt="Consejo Municipal de Juventudes de Flandes"
                    loading="eager"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
                    <BrandLogo size="md" className="ring-2 ring-white/80" />
                    <div className="text-white drop-shadow">
                      <p className="text-xs font-extrabold tracking-tight">CMJ Flandes · Tolima</p>
                      <p className="text-[11px] text-white/85">Portal Oficial de Juventudes</p>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  className={`relative h-full w-full bg-gradient-to-br ${
                    themeGradient || 'from-emerald-800 via-emerald-900 to-slate-950'
                  } p-6 sm:p-8 flex items-center`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 600 360"
                    className="absolute inset-0 h-full w-full opacity-15 pointer-events-none"
                  >
                    <defs>
                      <pattern id="cmj-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="600" height="360" fill="url(#cmj-grid)" />
                    <path
                      d="M0 290 C 140 230, 260 330, 380 265 C 470 220, 540 280, 600 245 L 600 360 L 0 360 Z"
                      fill="white"
                      fillOpacity="0.25"
                    />
                  </svg>

                  <div className="relative z-10 w-full flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                    <BrandLogo
                      size="hero"
                      className="ring-4 ring-white/20 shadow-2xl"
                    />
                    <div className="space-y-2.5 text-center sm:text-left text-white">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">
                        Democracia Joven · Río Magdalena
                      </p>
                      <h2 className="text-xl sm:text-2xl font-extrabold leading-tight text-balance">
                        Participación, control social y agenda juvenil en Flandes
                      </h2>
                      <p className="text-xs text-white/80 leading-relaxed max-w-sm">
                        Espacio oficial de encuentro entre los consejeros municipales de juventud, instituciones y ciudadanía.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ParallaxHero>
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
  const [roleFilter, setRoleFilter] = useState('todos');
  const [commissionFilter, setCommissionFilter] = useState('todas');
  const [affiliationFilter, setAffiliationFilter] = useState('todas');
  const [selectedCouncilor, setSelectedCouncilor] = useState<PublicCouncilor | null>(null);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const filteredCouncilors = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return councilors
      .filter((c) => {
        if (roleFilter === 'mesa') {
          if (!['Presidente', 'Vicepresidente', 'Secretario'].includes(c.roleLabel)) return false;
        } else if (roleFilter !== 'todos' && c.roleLabel !== roleFilter) {
          return false;
        }

        if (commissionFilter === 'sin_comision') {
          if (c.commissionId) return false;
        } else if (commissionFilter !== 'todas' && c.commissionId !== commissionFilter) {
          return false;
        }

        if (affiliationFilter !== 'todas' && (c.affiliationType || '') !== affiliationFilter) {
          return false;
        }

        if (!q) return true;
        return (
          c.fullName.toLowerCase().includes(q) ||
          c.roleLabel.toLowerCase().includes(q) ||
          (c.commissionName || 'Sin comisión').toLowerCase().includes(q) ||
          (c.affiliationName || '').toLowerCase().includes(q) ||
          formatAffiliationLabel(c.affiliationType).toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));
  }, [councilors, searchText, roleFilter, commissionFilter, affiliationFilter]);

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <>
      {/* Identidad Institucional */}
      <SectionReveal
        id="quienes_somos"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Identidad Institucional
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
                ¿Qué es el CMJ Flandes?
              </h2>
            </div>
            <p className="lg:col-span-7 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {settings.aboutText}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 border-t-4 border-t-emerald-600 bg-white dark:bg-slate-900 p-6">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Misión</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {settings.missionText}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 border-t-4 border-t-blue-600 bg-white dark:bg-slate-900 p-6">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                <Award className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Visión</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {settings.visionText}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 border-t-4 border-t-amber-500 bg-white dark:bg-slate-900 p-6">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Marco Legal</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Estatuto de Ciudadanía Juvenil (Ley 1622 de 2013 y Ley 1885 de 2018): interlocución directa ante la Alcaldía y el Concejo Municipal.
              </p>
            </div>
          </div>
        </div>
      </SectionReveal>

      {/* Directorio de Consejeros */}
      <SectionReveal
        id="consejeros"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Mesa Directiva y Plenaria
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
                Directorio de Consejeros de Juventud
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                Conoce a cada integrante, su cargo, comisión, filiación y canales directos de contacto.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar nombre, correo o teléfono..."
                  className="w-full sm:w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filtrar por cargo"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="todos">Todos los cargos</option>
                <option value="mesa">Solo Mesa Directiva</option>
                <option value="Presidente">Presidente</option>
                <option value="Vicepresidente">Vicepresidente</option>
                <option value="Secretario">Secretario</option>
                <option value="Consejero">Consejero</option>
              </select>
              <select
                value={commissionFilter}
                onChange={(e) => setCommissionFilter(e.target.value)}
                aria-label="Filtrar por comisión"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="todas">Todas las comisiones</option>
                <option value="sin_comision">Sin comisión asignada</option>
                {commissions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={affiliationFilter}
                onChange={(e) => setAffiliationFilter(e.target.value)}
                aria-label="Filtrar por filiación"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="todas">Todas las filiaciones</option>
                <option value="partido">Partido político</option>
                <option value="fundacion">Fundación / Organización</option>
                <option value="independiente">Independiente</option>
              </select>
            </div>
          </div>

          {filteredCouncilors.length === 0 ? (
            <EmptyState
              title="No se encontraron consejeros con esos filtros"
              description="Ajusta los filtros de búsqueda o registra consejeros desde el portal privado."
              actionLabel={isAuthenticated ? 'Gestionar consejeros' : undefined}
              onAction={isAuthenticated ? onEnterPrivatePortal : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredCouncilors.map((c) => {
                const affLabel = formatAffiliationLabel(c.affiliationType);
                const igHref = buildSocialHref(c.instagram, 'instagram');
                const fbHref = buildSocialHref(c.facebook, 'facebook');
                const waHref = buildWhatsappHref(c.phone);
                const telHref = buildTelHref(c.phone);
                const isBoard = ['Presidente', 'Vicepresidente', 'Secretario'].includes(c.roleLabel);

                return (
                  <TiltCard
                    key={c.id}
                    className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-4 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <AvatarBadge
                        name={c.fullName}
                        photoUrl={c.photoUrl}
                        thumbUrl={c.photoThumbUrl}
                        mediumUrl={c.photoMediumUrl}
                        accentColor={commissions.find((cm) => cm.id === c.commissionId)?.accentColor}
                        statusIndicator={c.active ? 'active' : 'inactive'}
                        size="lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[11px] font-bold uppercase tracking-wider ${
                            isBoard
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-blue-600 dark:text-cyan-400'
                          }`}
                        >
                          {c.roleLabel}
                        </p>
                        <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white leading-snug text-balance">
                          {c.fullName}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                          {c.commissionName || 'Sin comisión asignada'}
                        </p>
                      </div>
                    </div>

                    {(affLabel || c.affiliationName) && (
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {affLabel || 'Filiación'}
                        </span>
                        {c.affiliationName ? ` · ${c.affiliationName}` : ''}
                      </div>
                    )}

                    {c.bio && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                        {c.bio}
                      </p>
                    )}

                    {/* Datos de contacto directo */}
                    {(c.phone || c.email) && (
                      <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                        {c.phone && (
                          <div className="flex items-center justify-between gap-2">
                            <a
                              href={telHref || '#'}
                              className="inline-flex items-center gap-2 font-mono-num text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 truncate"
                            >
                              <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{c.phone}</span>
                            </a>
                            {waHref && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shrink-0"
                              >
                                <MessageCircle className="h-3 w-3" />
                                WhatsApp
                              </a>
                            )}
                          </div>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 truncate"
                          >
                            <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 min-w-0">
                        {igHref && (
                          <a
                            href={igHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white truncate"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            Instagram
                          </a>
                        )}
                        {fbHref && (
                          <a
                            href={fbHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white truncate"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            Facebook
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedCouncilor(c)}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0 cursor-pointer"
                      >
                        Ver ficha completa
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          )}
        </div>
      </SectionReveal>

      {/* Las 5 Comisiones */}
      <SectionReveal
        id="comisiones"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Estructura Operativa
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
              Las 5 Comisiones del CMJ Flandes
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Selecciona una comisión para ver su plan de trabajo e integrantes asignados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {commissions
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((comm) => {
                const membersCount = councilors.filter((u) => u.commissionId === comm.id).length;
                return (
                  <TiltCard
                    key={comm.id}
                    onClick={() => setSelectedCommission(comm)}
                    className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="relative h-36 bg-slate-100 dark:bg-slate-800/80 overflow-hidden">
                      {comm.coverUrl ? (
                        <img
                          src={comm.coverUrl}
                          alt={comm.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className="h-full w-full flex items-center justify-between p-5 text-white"
                          style={{
                            background: `linear-gradient(135deg, ${comm.accentColor || '#047857'}, #0f172a)`,
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
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {comm.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex-1 line-clamp-3">
                        {comm.description}
                      </p>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 truncate">
                          Coordina:{' '}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {comm.coordinatorName || 'Por asignar'}
                          </strong>
                        </span>
                        <span className="font-mono-num text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {membersCount} {membersCount === 1 ? 'integrante' : 'integrantes'}
                        </span>
                      </div>
                    </div>
                  </TiltCard>
                );
              })}
          </div>
        </div>
      </SectionReveal>

      {/* Modal Ficha Completa del Consejero */}
      {selectedCouncilor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => setSelectedCouncilor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <AvatarBadge
                  name={selectedCouncilor.fullName}
                  photoUrl={selectedCouncilor.photoUrl}
                  thumbUrl={selectedCouncilor.photoThumbUrl}
                  mediumUrl={selectedCouncilor.photoMediumUrl}
                  accentColor={
                    commissions.find((cm) => cm.id === selectedCouncilor.commissionId)?.accentColor
                  }
                  statusIndicator={selectedCouncilor.active ? 'active' : 'inactive'}
                  size="xl"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {selectedCouncilor.roleLabel}
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white text-balance">
                    {selectedCouncilor.fullName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedCouncilor.commissionName || 'Sin comisión asignada'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCouncilor(null)}
                aria-label="Cerrar ficha"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(selectedCouncilor.affiliationType || selectedCouncilor.affiliationName) && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 text-xs space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                  Representación y Filiación
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatAffiliationLabel(selectedCouncilor.affiliationType) || 'Filiación'}
                  {selectedCouncilor.affiliationName
                    ? ` · ${selectedCouncilor.affiliationName}`
                    : ''}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Perfil y Trayectoria
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedCouncilor.bio ||
                  'Este consejero aún no ha publicado su reseña biográfica.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Canales de Contacto Directo
              </p>

              {selectedCouncilor.phone ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-mono-num text-slate-800 dark:text-slate-100">
                    <Phone className="h-4 w-4 text-emerald-600" />
                    <span>{selectedCouncilor.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {buildTelHref(selectedCouncilor.phone) && (
                      <a
                        href={buildTelHref(selectedCouncilor.phone)!}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100"
                      >
                        <Phone className="h-3.5 w-3.5" /> Llamar
                      </a>
                    )}
                    {buildWhatsappHref(selectedCouncilor.phone) && (
                      <a
                        href={buildWhatsappHref(selectedCouncilor.phone)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Teléfono no publicado.</p>
              )}

              {selectedCouncilor.email ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <a
                    href={`mailto:${selectedCouncilor.email}`}
                    className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-cyan-400 hover:underline break-all"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span>{selectedCouncilor.email}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(selectedCouncilor.email!)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copiar
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  Correo institucional no publicado.
                </p>
              )}

              {(selectedCouncilor.instagram || selectedCouncilor.facebook) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  {buildSocialHref(selectedCouncilor.instagram, 'instagram') && (
                    <a
                      href={buildSocialHref(selectedCouncilor.instagram, 'instagram')!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Instagram ({selectedCouncilor.instagram})
                    </a>
                  )}
                  {buildSocialHref(selectedCouncilor.facebook, 'facebook') && (
                    <a
                      href={buildSocialHref(selectedCouncilor.facebook, 'facebook')!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Facebook ({selectedCouncilor.facebook})
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                Consejero Municipal de Juventud · Flandes, Tolima
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle de Comisión */}
      {selectedCommission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => setSelectedCommission(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Comisión 0{selectedCommission.number}
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white text-balance">
                  {selectedCommission.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Coordinación: {selectedCommission.coordinatorName || 'Por asignar'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCommission(null)}
                aria-label="Cerrar comisión"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Objeto de la comisión
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {selectedCommission.description}
              </p>
            </div>

            {selectedCommission.workPlanSummary && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Plan de Acción Vigente
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedCommission.workPlanSummary}
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Integrantes asignados
              </h4>
              {councilors.filter((u) => u.commissionId === selectedCommission.id).length === 0 ? (
                <p className="text-xs text-slate-500">
                  Aún no hay consejeros asignados a esta comisión.
                </p>
              ) : (
                <div className="space-y-2">
                  {councilors
                    .filter((u) => u.commissionId === selectedCommission.id)
                    .map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setSelectedCommission(null);
                          setSelectedCouncilor(member);
                        }}
                        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-400 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarBadge
                            name={member.fullName}
                            photoUrl={member.photoUrl}
                            thumbUrl={member.photoThumbUrl}
                            mediumUrl={member.photoMediumUrl}
                            accentColor={selectedCommission.accentColor}
                            statusIndicator={member.active ? 'active' : 'inactive'}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {member.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {member.roleLabel} {member.phone ? `· ${member.phone}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                          Ver ficha →
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
