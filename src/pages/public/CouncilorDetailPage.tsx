import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  MessageSquare,
  Quote,
  Sparkles,
  Target,
} from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { ROLE_LABELS } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';
import {
  CouncilorAchievementsCard,
  CouncilorDetailSidebar,
  CouncilorLinkedProjectsCard,
  getCommissionSlug,
  SameCommissionPeers,
} from './CouncilorDetailSections';

interface CouncilorDetailPageProps {
  slug: string;
  portal: PublicPortalState;
  onNavigate: (path: AppRoute) => void;
}

export function CouncilorDetailPage({ slug, portal, onNavigate }: CouncilorDetailPageProps) {
  const [copied, setCopied] = useState(false);

  if (portal.loading && portal.directory.length === 0) {
    return (
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
        <SkeletonCardGrid count={3} />
      </section>
    );
  }

  const member = portal.directory.find(
    (m) => (m.slug || slugifyCouncilorName(m.displayName, m.uid)) === slug,
  );

  if (!member) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <EmptyState
          icon={Sparkles}
          title="Ficha de consejero no encontrada"
          description="El perfil público consultado no existe o aún se encuentra en proceso de aprobación por la Mesa Directiva."
          actionLabel="Volver al directorio"
          onAction={() => onNavigate('/consejeros')}
        />
      </section>
    );
  }

  const memberSlug = member.slug || slugifyCouncilorName(member.displayName, member.uid);
  const commission = portal.commissions.find((c) => c.id === member.commissionId);
  const commissionName = member.commissionName || commission?.name;
  const commissionSlug = commission ? getCommissionSlug(commission) : undefined;
  const linkedProjects = portal.projects.filter((p) => member.projectIds?.includes(p.id));
  const hasNarrative =
    Boolean(member.fullBio) ||
    Boolean(member.motivation) ||
    Boolean(member.proposals) ||
    Boolean(member.achievements && member.achievements.length > 0) ||
    linkedProjects.length > 0;

  const handleCopyLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url || !navigator.clipboard) return;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <FadeInSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/consejeros')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Volver al directorio de consejeros</span>
          </button>
          <span className="text-xs text-stone-500 dark:text-slate-400">
            Inicio / Consejeros / {member.displayName}
          </span>
        </div>

        <Card className="mt-5 overflow-hidden">
          <div className="cmj-tricolor-rule -mx-6 -mt-6 mb-6 h-[3px]" aria-hidden="true" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar src={member.photoUrl} name={member.displayName} size="xl" />
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
                    {ROLE_LABELS[member.role]}
                  </span>
                  <span aria-hidden="true" className="text-stone-400 dark:text-slate-500">·</span>
                  <span className="font-mono-tabular font-medium text-stone-500 dark:text-slate-400">
                    Periodo {member.period || '2026–2029'}
                  </span>
                </div>
                <h1 className="mt-2 font-display text-2xl font-semibold text-stone-950 dark:text-white sm:text-3xl">
                  {member.displayName}
                </h1>
                {member.positionTitle && (
                  <p className="mt-1 text-sm font-medium text-[#7B1832] dark:text-[#D9B245]">
                    {member.positionTitle}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                  {member.sector && <span>{member.sector}</span>}
                  {commissionName && (
                    <button
                      type="button"
                      onClick={() => commissionSlug && onNavigate(`/comisiones/${commissionSlug}`)}
                      className="font-semibold text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
                    >
                      Comisión: {commissionName} →
                    </button>
                  )}
                </div>
                {member.workAxes && member.workAxes.length > 0 && (
                  <p className="mt-2.5 text-xs font-medium text-[#7B1832] dark:text-[#D9B245]">
                    Ejes de trabajo: {member.workAxes.join(' · ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onNavigate(`/participacion?para=${encodeURIComponent(memberSlug)}`)}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                <span>Enviar mensaje</span>
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleCopyLink}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    <span>Enlace copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </Button>
              <WhatsAppShareButton
                text={`Conoce el perfil oficial de ${member.displayName} en el CMJ Flandes:`}
              />
            </div>
          </div>

          {member.featuredQuote && (
            <blockquote className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#C59B27]/30 bg-[#FAF8F4] px-4 py-3 text-sm italic text-stone-800 dark:border-[#C59B27]/35 dark:bg-slate-950/60 dark:text-slate-200">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#C59B27]" aria-hidden="true" />
              <span>“{member.featuredQuote}”</span>
            </blockquote>
          )}

          {(member.shortBio || member.bio) && (
            <p className="mt-5 border-t border-stone-200 pt-5 text-base leading-relaxed text-stone-700 dark:border-slate-800 dark:text-slate-200">
              {member.shortBio || member.bio}
            </p>
          )}
        </Card>

        {member.showManagementKpis && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card padding="sm">
              <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                Sesiones con asistencia registrada
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#7B1832] dark:text-[#D9B245]">
                {member.kpiSessionsAttended ?? 0}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
                Compromisos cumplidos
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#1E3A8A] dark:text-[#60A5FA]">
                {member.kpiCommitmentsFulfilled ?? 0}
              </p>
            </Card>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {member.fullBio && (
              <Card>
                <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
                  Sobre mí
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                  {member.fullBio}
                </p>
              </Card>
            )}

            {member.motivation && (
              <Card>
                <div className="flex items-center gap-2 text-[#7B1832] dark:text-[#D9B245]">
                  <Target className="h-4 w-4" aria-hidden="true" />
                  <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                    Por qué estoy en el CMJ
                  </h2>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                  {member.motivation}
                </p>
              </Card>
            )}

            {member.proposals && (
              <Card>
                <div className="flex items-center gap-2 text-[#1E3A8A] dark:text-[#60A5FA]">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                    Propuestas y plan de trabajo
                  </h2>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                  {member.proposals}
                </p>
              </Card>
            )}

            <CouncilorAchievementsCard member={member} />

            <CouncilorLinkedProjectsCard projects={linkedProjects} onNavigate={onNavigate} />

            {!hasNarrative && (
              <EmptyState
                icon={Sparkles}
                title="Ficha en construcción institucional"
                description="Este consejero aún no ha publicado detalles adicionales sobre propuestas o logros. Puedes enviarle un mensaje ciudadano desde el botón superior."
              />
            )}
          </div>

          <CouncilorDetailSidebar
            member={member}
            commissionName={commissionName}
            commissionSlug={commissionSlug}
            onNavigate={onNavigate}
          />
        </div>

        <SameCommissionPeers
          member={member}
          directory={portal.directory}
          commissionName={commissionName}
          onNavigate={onNavigate}
        />
      </FadeInSection>
    </section>
  );
}
