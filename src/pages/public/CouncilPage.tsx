import { useState } from 'react';
import { BookOpen, Building2 } from 'lucide-react';
import { getCommissionSlug } from '../../utils/commissionUtils';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute } from '../../types/navigation';
import { SiteAppearanceConfig } from '../../types/siteContent';
import { Card } from '../../components/ui/Card';
import { EditorialImage } from '../../components/ui/EditorialImage';
import { EmptyState } from '../../components/ui/EmptyState';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { StatusText } from '../../components/ui/StatusText';
import { Tabs } from '../../components/ui/Tabs';
import { CouncilDirectoryTab } from './CouncilDirectoryTab';
import { CouncilOrganigram } from './CouncilOrganigram';

interface CouncilPageProps {
  portal: PublicPortalState;
  siteContent: SiteAppearanceConfig;
  onNavigate?: (path: AppRoute) => void;
}

type CouncilTab = 'identidad' | 'directorio' | 'comisiones' | 'organigrama';

export function CouncilPage({ portal, siteContent, onNavigate }: CouncilPageProps) {
  const [tab, setTab] = useState<CouncilTab>('identidad');

  const boardMembers = portal.directory.filter((m) =>
    ['presidente', 'vicepresidente', 'secretario_admin'].includes(m.role),
  );

  const hasAsideMetrics = portal.directory.length > 0 || portal.commissions.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Institucional · Ley 1622 de 2013 y Ley 1885 de 2018"
        title={siteContent.councilTitle}
        description={siteContent.councilSubtitle}
        breadcrumbs={[
          { label: 'Inicio', onClick: () => onNavigate?.('/') },
          { label: 'Consejo' },
        ]}
        primaryAction={
          onNavigate
            ? { label: 'Ver directorio completo', onClick: () => onNavigate('/consejeros') }
            : undefined
        }
        aside={
          hasAsideMetrics ? (
            <div className="flex items-center gap-6 rounded-xl border border-stone-200 bg-white px-5 py-3.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              {portal.directory.length > 0 && (
                <div>
                  <span className="text-stone-500 dark:text-slate-400">Consejeros</span>
                  <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#7B1832] dark:text-[#D9B245]">
                    {portal.directory.length}
                  </p>
                </div>
              )}
              {portal.directory.length > 0 && portal.commissions.length > 0 && (
                <div className="h-8 w-px bg-stone-200 dark:bg-slate-800" />
              )}
              {portal.commissions.length > 0 && (
                <div>
                  <span className="text-stone-500 dark:text-slate-400">Comisiones</span>
                  <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-stone-950 dark:text-white">
                    {portal.commissions.length}
                  </p>
                </div>
              )}
            </div>
          ) : undefined
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <FadeInSection>
          <Tabs
            ariaLabel="Secciones de Conoce nuestro Consejo"
            activeId={tab}
            onChange={setTab}
            options={[
              { id: 'identidad', label: 'Misión y Normativa' },
              { id: 'directorio', label: 'Mesa y Directorio' },
              { id: 'comisiones', label: 'Comisiones' },
              { id: 'organigrama', label: 'Organigrama' },
            ]}
          />

          <div className="mt-8">
            {tab === 'identidad' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <EditorialImage
                      src={siteContent.councilImageUrl}
                      alt={siteContent.councilAlt || siteContent.councilTitle}
                      caption={siteContent.councilCaption}
                      aspectClassName="aspect-[4/3]"
                      width={1200}
                      height={896}
                      className="h-full"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-6 lg:col-span-7">
                    <Card variant="elevated">
                      <p className="text-xs font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
                        Propósito institucional
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-semibold text-stone-950 dark:text-white">
                        Misión
                      </h2>
                      <p className="cmj-prose mt-3 text-sm text-stone-600 dark:text-slate-300">
                        {portal.councilInfo?.mission ||
                          'Representar las juventudes de Flandes entre 14 y 28 años ante las entidades municipales, promoviendo la concertación, la participación ciudadana y el control social.'}
                      </p>
                    </Card>

                    <Card variant="elevated">
                      <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
                        Horizonte 2026–2029
                      </p>
                      <h2 className="mt-2 font-display text-2xl font-semibold text-stone-950 dark:text-white">
                        Visión
                      </h2>
                      <p className="cmj-prose mt-3 text-sm text-stone-600 dark:text-slate-300">
                        {portal.councilInfo?.vision ||
                          'Consolidar al Consejo Municipal de Juventud de Flandes como un órgano transparente, participativo y cercano a cada barrio, vereda y organización juvenil del municipio.'}
                      </p>
                    </Card>
                  </div>
                </div>

                <Card>
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-1 h-5 w-5 shrink-0 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                    <div>
                      <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
                        Marco normativo colombiano
                      </h2>
                      <dl className="mt-4 divide-y divide-stone-200 text-sm dark:divide-slate-800">
                        <div className="py-3">
                          <dt className="font-semibold text-stone-900 dark:text-slate-100">
                            Ley Estatutaria 1622 de 2013
                          </dt>
                          <dd className="cmj-prose mt-1 text-stone-600 dark:text-slate-300">
                            Expide el Estatuto de Ciudadanía Juvenil, define los Consejos Municipales
                            de Juventud como mecanismos autónomos de participación, concertación,
                            vigilancia y control de la gestión pública juvenil entre los 14 y 28 años.
                          </dd>
                        </div>
                        <div className="py-3">
                          <dt className="font-semibold text-stone-900 dark:text-slate-100">
                            Ley Estatutaria 1885 de 2018
                          </dt>
                          <dd className="cmj-prose mt-1 text-stone-600 dark:text-slate-300">
                            Modifica la Ley 1622 de 2013 y reglamenta el sistema electoral de los
                            Consejos de Juventud, curules especiales, listas independientes, procesos y
                            prácticas organizativas y partidos o movimientos políticos.
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {tab === 'directorio' && (
              <CouncilDirectoryTab
                portal={portal}
                boardMembers={boardMembers}
                onNavigate={onNavigate}
              />
            )}

            {tab === 'comisiones' && (
              <div>
                {portal.loading ? (
                  <SkeletonCardGrid count={2} />
                ) : portal.commissions.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="Aún no se han registrado comisiones de trabajo"
                    description="Las comisiones temáticas del CMJ Flandes aparecerán aquí una vez sean creadas desde el panel administrativo."
                    actionLabel={onNavigate ? 'Ir a Participación Ciudadana' : undefined}
                    onAction={onNavigate ? () => onNavigate('/participacion') : undefined}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {portal.commissions.map((com) => {
                      const slug = getCommissionSlug(com);
                      return (
                        <Card key={com.id} variant="interactive" className="flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <StatusText label="Comisión activa" tone="success" />
                              {(com.memberUids?.length ?? 0) > 0 && (
                                <span className="font-mono-tabular text-xs text-stone-500 dark:text-slate-400">
                                  {com.memberUids?.length} integrantes
                                </span>
                              )}
                            </div>
                            <h3 className="mt-2 font-display text-xl font-semibold text-stone-950 dark:text-white">
                              {com.name}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                              {com.mission || com.description}
                            </p>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-200 pt-3 text-xs dark:border-slate-800">
                            <span className="text-stone-500 dark:text-slate-400">
                              {com.leaderName ? `Líder: ${com.leaderName}` : 'Comisión CMJ'}
                            </span>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate(`/comisiones/${slug}`)}
                                className="font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
                              >
                                Ver ficha completa →
                              </button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'organigrama' && (
              <CouncilOrganigram
                directoryCount={portal.directory.length}
                boardCount={boardMembers.length}
                commissionsCount={portal.commissions.length}
              />
            )}
          </div>
        </FadeInSection>
      </section>
    </div>
  );
}
