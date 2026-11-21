import { useMemo, useState } from 'react';
import { ArrowRight, Compass, Landmark } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute } from '../../types/navigation';
import { SiteAppearanceConfig } from '../../types/siteContent';
import { resolveActiveSeasonalTheme } from '../../utils/seasonalThemeResolver';
import { useAccessibility } from '../../hooks/useAccessibility';
import { SeasonalOrnamentSvg } from '../../components/theme/SeasonalOrnamentSvg';
import { Button } from '../../components/ui/Button';
import { AnimatedCounter } from '../../components/ui/MotionPrimitives';

interface HomeHeroSectionProps {
  portal: PublicPortalState;
  siteContent: SiteAppearanceConfig;
  onNavigate: (path: AppRoute) => void;
}

const GUIDANCE_ITEMS: {
  eyebrow: string;
  title: string;
  desc: string;
  route: AppRoute;
  cta: string;
}[] = [
  {
    eyebrow: 'Misión 2026–2029',
    title: 'Voz juvenil en Flandes',
    desc: 'Interlocución, concertación y control social ante las autoridades del municipio.',
    route: '/consejo',
    cta: 'Conocer el Consejo',
  },
  {
    eyebrow: 'Cómo participar',
    title: 'Propuestas y PQRSD',
    desc: 'Radica iniciativas comunitarias o solicitudes ciudadanas con código de seguimiento.',
    route: '/participacion',
    cta: 'Abrir buzón juvenil',
  },
  {
    eyebrow: 'Próximos pasos',
    title: 'Agenda y comisiones',
    desc: 'Sigue las sesiones plenarias, comisiones de trabajo y convocatorias abiertas.',
    route: '/gestion',
    cta: 'Ver gestión y agenda',
  },
  {
    eyebrow: 'Transparencia',
    title: 'Actas y datos abiertos',
    desc: 'Consulta documentos aprobados, informes de rendición y noticias oficiales.',
    route: '/actualidad',
    cta: 'Explorar actualidad',
  },
];

export function HomeHeroSection({ portal, siteContent, onNavigate }: HomeHeroSectionProps) {
  const [imageError, setImageError] = useState(false);
  const { settings } = useAccessibility();
  const { theme } = useMemo(() => resolveActiveSeasonalTheme(siteContent), [siteContent]);

  const realStats = [
    {
      label: 'Consejeros en directorio',
      value: portal.directory.length,
      route: '/consejeros' as AppRoute,
      accentClass: 'text-[#7B1832] dark:text-[#D9B245]',
    },
    {
      label: 'Proyectos publicados',
      value: portal.projects.length,
      route: '/gestion' as AppRoute,
      accentClass: 'text-stone-950 dark:text-white',
    },
    {
      label: 'Actas e informes públicos',
      value: portal.documents.length,
      route: '/gestion' as AppRoute,
      accentClass: 'text-[#1E3A8A] dark:text-[#60A5FA]',
    },
    {
      label: 'Comisiones activas',
      value: portal.commissions.length,
      route: '/comisiones' as AppRoute,
      accentClass: 'text-stone-950 dark:text-white',
    },
  ].filter((item) => item.value > 0);

  const fallbackGuidanceCount = Math.max(0, 4 - realStats.length);
  const visibleGuidance = GUIDANCE_ITEMS.slice(0, fallbackGuidanceCount);

  return (
    <section className="relative border-b border-stone-200 bg-[#2B0611] dark:border-slate-800">
      <div className="relative overflow-hidden">
        {!imageError && (
          <img
            src={siteContent.heroImageUrl}
            alt={siteContent.heroAlt || siteContent.heroTitle}
            width={1376}
            height={768}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => setImageError(true)}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}

        <div
          aria-hidden="true"
          style={
            !settings.hideSeasonalOrnaments && theme.id !== 'institucional'
              ? { background: theme.heroGradientCss }
              : undefined
          }
          className="absolute inset-0 bg-gradient-to-br from-[#2B0611]/95 via-[#4A0D1E]/86 to-[#0F172A]/82"
        />

        {!settings.hideSeasonalOrnaments && theme.id !== 'institucional' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-6 bottom-6 z-10 hidden opacity-70 lg:block"
          >
            <SeasonalOrnamentSvg
              kind={theme.ornamentKind}
              accentHex={theme.accentHex}
              secondaryHex={theme.secondaryHex}
              className="h-24 w-44"
            />
          </div>
        )}

        {/* Franja de ubicación colapsada en móvil para mostrar el titular arriba en 360px */}
        <div className="relative z-10 hidden border-b border-white/15 bg-black/25 backdrop-blur-xs sm:block">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5 text-xs text-stone-100/90 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 truncate">
              <Landmark className="h-3.5 w-3.5 shrink-0 text-[#E5C158]" aria-hidden="true" />
              <span className="truncate">
                Flandes, Tolima · Puerta de Oro del Tolima · República de Colombia
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-stone-200/85">
              <Compass className="h-3.5 w-3.5 text-[#E5C158]" aria-hidden="true" />
              <span>Cuenca del Alto Magdalena · Periodo 2026–2029</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-wider text-[#E5C158] uppercase">
              {siteContent.heroEyebrow}
            </p>
            <h1 className="cmj-display-hero mt-3 font-display font-semibold text-white">
              {siteContent.heroTitle}
            </h1>
            <p className="cmj-prose mt-5 text-base text-stone-100/95 sm:text-lg">
              {siteContent.heroSubtitle}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3.5 sm:inline-grid sm:grid-cols-2">
              <Button
                size="lg"
                variant="gold"
                className="w-full justify-center"
                onClick={() => onNavigate('/participacion')}
              >
                <span>Buzón de participación juvenil</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full justify-center border-white/45 bg-white/10 text-white hover:border-white hover:bg-white/20 dark:border-white/45 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                onClick={() => onNavigate('/consejo')}
              >
                Conocer nuestro Consejo
              </Button>
            </div>

            {siteContent.heroCaption && (
              <p className="mt-6 text-xs text-stone-300/85">{siteContent.heroCaption}</p>
            )}
          </div>
        </div>
      </div>

      {/* Franja de cifras reales (> 0) u orientación ciudadana cuando el módulo inicia vacío */}
      <div className="relative z-10 border-t border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {realStats.map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => onNavigate(stat.route)}
                className="group rounded-xl border border-stone-200 bg-[#FAFAF8] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#7B1832]/45 hover:bg-white hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-[#D9B245]/45"
              >
                <p className="text-xs font-medium text-stone-600 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className={`mt-1.5 font-display text-3xl font-semibold tabular-nums ${stat.accentClass}`}>
                  <AnimatedCounter value={stat.value} />
                </p>
              </button>
            ))}

            {visibleGuidance.map((guide) => (
              <button
                key={guide.title}
                type="button"
                onClick={() => onNavigate(guide.route)}
                className="group flex flex-col justify-between rounded-xl border border-stone-200 bg-[#FAFAF8] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#7B1832]/45 hover:bg-white hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-[#D9B245]/45"
              >
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
                    {guide.eyebrow}
                  </p>
                  <p className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">
                    {guide.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-slate-400">
                    {guide.desc}
                  </p>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                  <span>{guide.cta}</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
