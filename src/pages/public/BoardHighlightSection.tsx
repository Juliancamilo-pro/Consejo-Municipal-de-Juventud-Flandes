import { ArrowRight, Users } from 'lucide-react';
import { PublicDirectoryMember, ROLE_LABELS } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { StatusText } from '../../components/ui/StatusText';

export function BoardHighlightSection({
  loading,
  boardMembers,
  onNavigate,
}: {
  loading: boolean;
  boardMembers: PublicDirectoryMember[];
  onNavigate: (path: AppRoute) => void;
}) {
  return (
    <FadeInSection>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="cmj-display-section font-display font-semibold text-stone-950 dark:text-white">
          Mesa Directiva Destacada
        </h2>
        {boardMembers.length > 0 && (
          <span className="font-mono-tabular text-xs font-medium text-stone-500 dark:text-slate-400">
            {boardMembers.length} {boardMembers.length === 1 ? 'dignatario' : 'dignatarios'}
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonCardGrid count={3} />
      ) : boardMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no se han publicado integrantes de Mesa Directiva"
          description="Cuando los dignatarios aprueben su ficha pública aparecerán destacados en este espacio. Mientras tanto puedes conocer las competencias estatutarias del Consejo."
          actionLabel="Conocer marco del Consejo"
          onAction={() => onNavigate('/consejo')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {boardMembers.map((member) => {
            const slug = member.slug || slugifyCouncilorName(member.displayName, member.uid);
            return (
              <Card
                key={member.uid}
                variant="interactive"
                className="flex flex-col justify-between border-[#7B1832]/20 bg-gradient-to-b from-white to-[#FAF8F4] dark:border-[#D9B245]/20 dark:from-slate-900 dark:to-slate-950"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <Avatar src={member.photoUrl} name={member.displayName} size="lg" />
                    <div className="min-w-0">
                      <StatusText label={ROLE_LABELS[member.role]} tone="info" />
                      <h3 className="mt-1.5 font-display text-lg font-semibold text-stone-950 dark:text-white">
                        {member.displayName}
                      </h3>
                      {member.positionTitle && (
                        <p className="text-xs font-medium text-[#7B1832] dark:text-[#D9B245]">
                          {member.positionTitle}
                        </p>
                      )}
                    </div>
                  </div>
                  {(member.shortBio || member.bio) && (
                    <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                      {member.shortBio || member.bio}
                    </p>
                  )}
                </div>
                <div className="mt-5 border-t border-stone-200/80 pt-3.5 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate(`/consejeros/${slug}`)}
                    className="w-full justify-between"
                  >
                    <span>Ver ficha completa</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </FadeInSection>
  );
}
