import { AlertCircle, ArrowRight } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute } from '../../types/navigation';
import { SiteAppearanceConfig } from '../../types/siteContent';
import { Button } from '../../components/ui/Button';
import { EditorialImage } from '../../components/ui/EditorialImage';
import { EmptyState } from '../../components/ui/EmptyState';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { HomeBentoChannels } from './HomeBentoChannels';
import { HomeHeroSection } from './HomeHeroSection';
import { HomeUpdatesSection } from './HomeUpdatesSection';

interface HomePageProps {
  portal: PublicPortalState;
  siteContent: SiteAppearanceConfig;
  onNavigate: (path: AppRoute) => void;
}

const STATUTORY_PILLARS = [
  {
    num: '01.',
    title: 'Interlocución y concertación',
    desc: 'Diálogo directo con la administración municipal y las agendas juveniles de Flandes.',
  },
  {
    num: '02.',
    title: 'Veeduría y control social',
    desc: 'Seguimiento permanente a planes, programas, presupuestos y proyectos dirigidos a la juventud.',
  },
  {
    num: '03.',
    title: 'Transparencia documental',
    desc: 'Publicación abierta de actas aprobadas, informes de gestión y conjuntos de datos ciudadanos.',
  },
];

export function HomePage({ portal, siteContent, onNavigate }: HomePageProps) {
  return (
    <div>
      <HomeHeroSection portal={portal} siteContent={siteContent} onNavigate={onNavigate} />

      {portal.error && (
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
          <EmptyState
            icon={AlertCircle}
            tone="error"
            title="No fue posible cargar todos los datos públicos"
            description={portal.error}
            actionLabel="Reintentar carga"
            onAction={() => void portal.reload()}
          />
        </div>
      )}

      <FadeInSection>
        <HomeBentoChannels portal={portal} onNavigate={onNavigate} />
      </FadeInSection>

      {/* Franja editorial territorial Flandes Tolima */}
      <section className="cmj-territorial-weave border-y border-stone-200 bg-[#F7F4EE] dark:border-slate-800 dark:bg-slate-900/45">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <FadeInSection delay={0.04}>
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-7">
                <EditorialImage
                  src={siteContent.territorialImageUrl}
                  alt={siteContent.territorialAlt || siteContent.territorialTitle}
                  caption={siteContent.territorialCaption}
                  aspectClassName="aspect-[16/10]"
                />
              </div>
              <div className="lg:col-span-5">
                <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
                  {siteContent.territorialEyebrow}
                </p>
                <h2 className="cmj-display-section mt-2 font-display font-semibold text-stone-950 dark:text-white">
                  {siteContent.territorialTitle}
                </h2>
                <p className="cmj-prose mt-3 text-sm text-stone-700 dark:text-slate-300 sm:text-base">
                  {siteContent.territorialDescription}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => onNavigate('/actualidad')}>
                    <span>Explorar datos abiertos</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button variant="outline" onClick={() => onNavigate('/participacion')}>
                    Radicar propuesta
                  </Button>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Franja vinotinto con acento dorado para mandato legal */}
      <section className="bg-[#4B0E1F] text-white dark:bg-[#2A0812]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <FadeInSection delay={0.06}>
            <div className="flex flex-col justify-between gap-4 border-b border-white/15 pb-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#E5C158] uppercase">
                  Mandato estatutario · Ley 1622 de 2013 y Ley 1885 de 2018
                </p>
                <h2 className="cmj-display-section mt-2 font-display font-semibold text-white">
                  Pilares de representación juvenil en Flandes
                </h2>
              </div>
              <Button variant="gold" onClick={() => onNavigate('/consejo')}>
                <span>Ver reglamento y funciones</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {STATUTORY_PILLARS.map((pillar) => (
                <div
                  key={pillar.num}
                  className="rounded-xl border border-white/15 bg-white/5 p-6 backdrop-blur-xs"
                >
                  <p className="font-mono-tabular text-xs font-semibold text-[#E5C158]">
                    {pillar.num}
                  </p>
                  <h3 className="mt-2 font-display text-lg font-semibold text-white">
                    {pillar.title}
                  </h3>
                  <p className="cmj-prose mt-2 text-sm text-stone-200/90">
                    {pillar.desc}
                  </p>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      <HomeUpdatesSection portal={portal} onNavigate={onNavigate} />
    </div>
  );
}
