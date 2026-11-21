import { Calendar, FileText } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute } from '../../types/navigation';
import { EmptyState } from '../../components/ui/EmptyState';
import { FadeInSection, SkeletonBlock } from '../../components/ui/MotionPrimitives';
import { StatusText } from '../../components/ui/StatusText';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

interface HomeUpdatesSectionProps {
  portal: PublicPortalState;
  onNavigate: (path: AppRoute) => void;
}

export function HomeUpdatesSection({ portal, onNavigate }: HomeUpdatesSectionProps) {
  const upcomingEvents = portal.events.slice(0, 3);
  const latestNews = portal.news.slice(0, 3);
  const latestDocs = portal.documents.slice(0, 3);

  return (
    <section className="bg-white dark:bg-[#0F172A]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <FadeInSection delay={0.08}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-5 flex items-baseline justify-between border-b border-stone-200 pb-3 dark:border-slate-800">
                <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
                  Próximos eventos y agenda
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/gestion')}
                  className="text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
                >
                  Ver calendario →
                </button>
              </div>
              {portal.loading ? (
                <div className="space-y-3">
                  <SkeletonBlock className="h-24 w-full rounded-xl" />
                  <SkeletonBlock className="h-24 w-full rounded-xl" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="Aún no se han programado eventos públicos"
                  description="Cuando se registren sesiones o actividades abiertas en el calendario institucional, aparecerán aquí. Puedes proponer un tema desde el buzón juvenil."
                  actionLabel="Proponer tema en buzón"
                  onAction={() => onNavigate('/participacion')}
                />
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((ev) => {
                    const d = new Date(ev.startIso);
                    const dayNum = Number.isNaN(d.getTime()) ? '--' : String(d.getDate()).padStart(2, '0');
                    const monthShort = Number.isNaN(d.getTime())
                      ? ''
                      : d.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase();
                    return (
                      <article
                        key={ev.id}
                        className="flex gap-4 rounded-xl border border-stone-200 bg-[#FAFAF8] p-4 transition-colors hover:border-[#7B1832]/40 dark:border-slate-800 dark:bg-slate-900/75"
                      >
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-stone-200 bg-white text-center dark:border-slate-700 dark:bg-slate-800">
                          <span className="font-mono-tabular text-lg font-semibold leading-none text-[#7B1832] dark:text-[#D9B245]">
                            {dayNum}
                          </span>
                          <span className="mt-1 text-[10px] font-semibold tracking-wider text-stone-600 dark:text-slate-300">
                            {monthShort}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                            <span>{ev.location}</span>
                            <span aria-hidden="true">·</span>
                            <StatusText label={ev.eventType} tone="info" />
                          </div>
                          <h3 className="mt-1 font-display text-lg font-semibold text-stone-900 dark:text-slate-100">
                            {ev.title}
                          </h3>
                          {ev.description && (
                            <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-5 flex items-baseline justify-between border-b border-stone-200 pb-3 dark:border-slate-800">
                <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
                  Últimas publicaciones y actas
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/actualidad')}
                  className="text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
                >
                  Ver actualidad →
                </button>
              </div>
              {portal.loading ? (
                <div className="space-y-3">
                  <SkeletonBlock className="h-24 w-full rounded-xl" />
                  <SkeletonBlock className="h-24 w-full rounded-xl" />
                </div>
              ) : latestNews.length === 0 && latestDocs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Aún no se han publicado actas ni noticias"
                  description="Las publicaciones oficiales y documentos aprobados por el Consejo aparecerán aquí una vez sean publicados."
                  actionLabel="Conocer comisiones de trabajo"
                  onAction={() => onNavigate('/comisiones')}
                />
              ) : (
                <div className="space-y-3">
                  {latestNews.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-stone-200 bg-[#FAFAF8] p-5 transition-colors hover:border-[#7B1832]/50 dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-[#D9B245]/50"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#7B1832] capitalize dark:text-[#D9B245]">
                            {item.type}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.authorName}</span>
                        </div>
                        <WhatsAppShareButton text={`${item.title} · CMJ Flandes:`} />
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('/actualidad')}
                        className="mt-1.5 text-left"
                      >
                        <h3 className="font-display text-lg font-semibold text-stone-900 hover:underline dark:text-slate-100">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">
                          {item.summary}
                        </p>
                      </button>
                    </article>
                  ))}
                  {latestDocs.map((docItem) => (
                    <article
                      key={docItem.id}
                      onClick={() => onNavigate('/gestion')}
                      className="cursor-pointer rounded-xl border border-stone-200 bg-[#FAFAF8] p-5 transition-colors hover:border-[#1E3A8A]/50 dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-[#60A5FA]/50"
                    >
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                        <span className="font-medium text-[#1E3A8A] capitalize dark:text-[#60A5FA]">
                          {docItem.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">Versión {docItem.currentVersion}</span>
                      </div>
                      <h3 className="mt-1.5 font-display text-lg font-semibold text-stone-900 dark:text-slate-100">
                        {docItem.title}
                      </h3>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
