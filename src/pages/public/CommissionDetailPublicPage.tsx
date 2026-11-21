import { useMemo } from 'react';
import { CheckCircle2, Download, FileText, FolderKanban, Users } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { resolveDocumentAccessUrl } from '../../services/storageService';
import { AppRoute } from '../../types/navigation';
import {
  computeCommissionGoalsProgress,
  getCommissionAccent,
  getCommissionSlug,
} from '../../utils/commissionUtils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FadeInSection, SkeletonBlock } from '../../components/ui/MotionPrimitives';
import { useToast } from '../../components/ui/Toast';
import { CommissionDetailHeader } from './CommissionDetailHeader';
import { CommissionPublicSidebar } from './CommissionPublicSidebar';

interface CommissionDetailPublicPageProps {
  slug: string;
  portal: PublicPortalState;
  onNavigate: (path: AppRoute) => void;
}

export function CommissionDetailPublicPage({
  slug,
  portal,
  onNavigate,
}: CommissionDetailPublicPageProps) {
  const { showToast } = useToast();

  const commission = useMemo(
    () => portal.commissions.find((c) => getCommissionSlug(c) === slug) || null,
    [portal.commissions, slug],
  );

  if (portal.loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
        <SkeletonBlock className="h-56 w-full rounded-xl" />
        <SkeletonBlock className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  if (!commission) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Users}
          title="Comisión no encontrada"
          description="La comisión solicitada no se encuentra activa o la dirección ha cambiado."
          actionLabel="Volver a comisiones"
          onAction={() => onNavigate('/comisiones')}
        />
      </section>
    );
  }

  const accent = getCommissionAccent(commission.accentColor);
  const publishedMembers = portal.directory.filter(
    (d) =>
      d.commissionId === commission.id ||
      (commission.memberUids || []).includes(d.uid),
  );
  const relatedProjects = portal.projects.filter((p) => p.commissionId === commission.id);
  const relatedDocs = portal.documents.filter((d) => d.commissionId === commission.id);
  const upcomingEvents = portal.events.filter(
    (ev) =>
      ev.title.toLowerCase().includes(commission.name.toLowerCase()) ||
      (ev.description || '').toLowerCase().includes(commission.name.toLowerCase()),
  );
  const goals = commission.goals || [];
  const goalsProgress = computeCommissionGoalsProgress(commission);

  const handleDownload = async (docItem: (typeof relatedDocs)[number]) => {
    try {
      const url = await resolveDocumentAccessUrl(docItem, false);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo descargar el documento.', 'error');
    }
  };

  return (
    <div>
      <CommissionDetailHeader commission={commission} onNavigate={onNavigate} />

      <section className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <FadeInSection>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {commission.mission && (
                <Card>
                  <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
                    Misión de la comisión
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                    {commission.mission}
                  </p>
                </Card>
              )}

              {(commission.objectives?.length || commission.workLines?.length) ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Card>
                    <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                      Objetivos
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-stone-600 dark:text-slate-300">
                      {(commission.objectives || []).map((obj, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]"
                            aria-hidden="true"
                          />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card>
                    <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                      Líneas de trabajo
                    </h3>
                    <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-stone-600 dark:text-slate-300">
                      {(commission.workLines || []).map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </Card>
                </div>
              ) : null}

              {goals.length > 0 && (
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
                      Metas del plan de trabajo
                    </h2>
                    <span className="font-mono-tabular text-sm font-semibold text-[#7B1832] dark:text-[#D9B245]">
                      Promedio {goalsProgress}%
                    </span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {goals.map((g) => (
                      <div key={g.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-stone-900 dark:text-white">{g.title}</span>
                          <span className="font-mono-tabular text-xs font-semibold text-stone-600 dark:text-slate-300">
                            {g.progressPercent}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                          <div className="h-full rounded-full" style={{ width: `${g.progressPercent}%`, backgroundColor: accent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div>
                <h2 className="mb-4 font-display text-xl font-semibold text-stone-950 dark:text-white">
                  Proyectos asociados ({relatedProjects.length})
                </h2>
                {relatedProjects.length === 0 ? (
                  <EmptyState
                    icon={FolderKanban}
                    title="Aún no hay proyectos publicados"
                    description="Los proyectos juveniles de esta comisión aparecerán aquí una vez sean publicados."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {relatedProjects.map((p) => (
                      <Card key={p.id}>
                        <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">{p.title}</h3>
                        <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-300">{p.summary}</p>
                        <p className="mt-3 font-mono-tabular text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                          Avance: {p.progressPercent}%
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="mb-4 font-display text-xl font-semibold text-stone-950 dark:text-white">
                  Documentos públicos ({relatedDocs.length})
                </h2>
                {relatedDocs.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Sin documentos públicos aún"
                    description="Las actas e informes públicos de esta comisión aparecerán aquí."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {relatedDocs.map((d) => (
                      <Card key={d.id} padding="sm" className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-stone-950 dark:text-white">{d.title}</p>
                          <p className="text-xs text-stone-500 dark:text-slate-400">
                            {d.category} · v{d.currentVersion}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void handleDownload(d)}>
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Descargar</span>
                        </Button>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <CommissionPublicSidebar
              commission={commission}
              publishedMembers={publishedMembers}
              upcomingEvents={upcomingEvents}
              onNavigate={onNavigate}
            />
          </div>
        </FadeInSection>
      </section>
    </div>
  );
}
