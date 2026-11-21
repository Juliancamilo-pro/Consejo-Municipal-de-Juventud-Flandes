import { ArrowRight, Users } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { PublicDirectoryMember, ROLE_LABELS } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonBlock } from '../../components/ui/MotionPrimitives';
import { StatusText } from '../../components/ui/StatusText';

interface CouncilDirectoryTabProps {
  portal: PublicPortalState;
  boardMembers: PublicDirectoryMember[];
  onNavigate?: (path: AppRoute) => void;
}

export function CouncilDirectoryTab({
  portal,
  boardMembers,
  onNavigate,
}: CouncilDirectoryTabProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-stone-950 dark:text-white">
          Mesa Directiva
        </h2>
        {portal.loading ? (
          <SkeletonBlock className="mt-4 h-32 w-full rounded-xl" />
        ) : boardMembers.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Users}
              title="Aún no se ha conformado la Mesa Directiva en el directorio"
              description="Cuando los integrantes de la Mesa Directiva activen y publiquen sus perfiles, aparecerán en esta sección."
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {boardMembers.map((member) => {
              const slug = member.slug || slugifyCouncilorName(member.displayName, member.uid);
              return (
                <Card key={member.uid} className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3">
                      <Avatar src={member.photoUrl} name={member.displayName} size="md" />
                      <div className="min-w-0">
                        <StatusText label={ROLE_LABELS[member.role]} tone="info" />
                        <h3 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
                          {member.displayName}
                        </h3>
                        {member.positionTitle && (
                          <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
                            {member.positionTitle}
                          </p>
                        )}
                      </div>
                    </div>
                    {(member.shortBio || member.bio) && (
                      <p className="mt-3 line-clamp-3 text-sm text-stone-600 dark:text-slate-300">
                        {member.shortBio || member.bio}
                      </p>
                    )}
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`/consejeros/${slug}`)}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
                    >
                      <span>Ver ficha completa</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-stone-950 dark:text-white">
            Directorio de Consejeros
          </h2>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('/consejeros')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
            >
              <span>Explorar buscador de consejeros</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        {portal.loading ? (
          <SkeletonBlock className="mt-4 h-32 w-full rounded-xl" />
        ) : portal.directory.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Users}
              title="Aún no hay consejeros publicados en el directorio"
              description="El directorio público se actualizará automáticamente conforme se aprueben las cuentas reales de los consejeros."
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {portal.directory.map((member) => {
              const slug = member.slug || slugifyCouncilorName(member.displayName, member.uid);
              return (
                <Card key={member.uid} className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3">
                      <Avatar src={member.photoUrl} name={member.displayName} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-slate-400">
                          <span>{ROLE_LABELS[member.role]}</span>
                          {member.sector && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{member.sector}</span>
                            </>
                          )}
                        </div>
                        <h3 className="mt-0.5 font-display text-lg font-semibold text-stone-950 dark:text-white">
                          {member.displayName}
                        </h3>
                      </div>
                    </div>
                    {(member.shortBio || member.bio) && (
                      <p className="mt-3 line-clamp-3 text-sm text-stone-600 dark:text-slate-300">
                        {member.shortBio || member.bio}
                      </p>
                    )}
                  </div>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`/consejeros/${slug}`)}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
                    >
                      <span>Ver ficha completa</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
