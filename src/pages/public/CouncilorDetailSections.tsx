import { Award, Building2, ExternalLink, FolderKanban, GraduationCap, Mail, Users } from 'lucide-react';
import { ProjectItem, PublicDirectoryMember, ROLE_LABELS } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { getCommissionSlug } from '../../utils/commissionUtils';
import { SOCIAL_PLATFORMS } from '../../utils/socialLinks';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { SocialBrandIcon } from '../../components/ui/SocialBrandIcon';

interface CouncilorSidebarProps {
  member: PublicDirectoryMember;
  commissionName?: string;
  commissionSlug?: string;
  onNavigate: (path: AppRoute) => void;
}

export function CouncilorDetailSidebar({
  member,
  commissionName,
  commissionSlug,
  onNavigate,
}: CouncilorSidebarProps) {
  const activeSocials = SOCIAL_PLATFORMS.filter((p) => Boolean(member.socialLinks?.[p.key]));

  return (
    <aside className="space-y-6 lg:col-span-4">
      {commissionName && (
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-slate-400">
            <Building2 className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <span>Su comisión</span>
          </div>
          <p className="mt-2 font-display text-base font-semibold text-stone-950 dark:text-white">
            {commissionName}
          </p>
          {commissionSlug && (
            <button
              type="button"
              onClick={() => onNavigate(`/comisiones/${commissionSlug}`)}
              className="mt-2 text-xs font-semibold text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
            >
              Ver plan y proyectos de la comisión →
            </button>
          )}
        </Card>
      )}

      {member.educationOccupation && (
        <Card>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-slate-400">
            <GraduationCap className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <span>Formación y ocupación</span>
          </div>
          <p className="mt-2.5 text-sm text-stone-700 dark:text-slate-200">
            {member.educationOccupation}
          </p>
        </Card>
      )}

      {member.skills && member.skills.length > 0 && (
        <Card>
          <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Habilidades e intereses
          </h2>
          <p className="mt-2.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
            {member.skills.join(' · ')}
          </p>
        </Card>
      )}

      {(activeSocials.length > 0 || member.publicEmail) && (
        <Card>
          <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Redes y canales públicos
          </h2>
          <div className="mt-3 space-y-2">
            {member.publicEmail && (
              <a
                href={`mailto:${member.publicEmail}`}
                className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/70"
              >
                <Mail className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                <span className="truncate">{member.publicEmail}</span>
              </a>
            )}
            {activeSocials.map((s) => (
              <a
                key={s.key}
                href={member.socialLinks?.[s.key]}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/70"
              >
                <span className="inline-flex items-center gap-2">
                  <SocialBrandIcon
                    platform={s.key}
                    className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#E5C158]"
                  />
                  <span>{s.label}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </aside>
  );
}

export function CouncilorAchievementsCard({ member }: { member: PublicDirectoryMember }) {
  if (!member.achievements || member.achievements.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center gap-2 text-[#7B1832] dark:text-[#D9B245]">
        <Award className="h-4 w-4" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Logros e hitos
        </h2>
      </div>
      <ul className="mt-4 space-y-3">
        {member.achievements.map((item, idx) => (
          <li
            key={`${item.year}-${idx}`}
            className="flex items-start gap-3 rounded-lg border border-stone-200 bg-[#FAF8F4] p-3 text-sm dark:border-slate-800 dark:bg-slate-950/60"
          >
            <span className="font-mono-tabular shrink-0 rounded-[4px] bg-[#7B1832] px-2 py-0.5 text-xs font-semibold text-white dark:bg-[#C59B27] dark:text-slate-950">
              {item.year}
            </span>
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function SameCommissionPeers({
  member,
  directory,
  commissionName,
  onNavigate,
}: {
  member: PublicDirectoryMember;
  directory: PublicDirectoryMember[];
  commissionName?: string;
  onNavigate: (path: AppRoute) => void;
}) {
  if (!member.commissionId) return null;
  const peers = directory.filter(
    (other) => other.commissionId === member.commissionId && other.uid !== member.uid,
  );
  if (peers.length === 0) return null;

  return (
    <Card className="mt-8">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Otros consejeros de {commissionName || 'la misma comisión'} ({peers.length})
        </h2>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {peers.map((peer) => {
          const peerSlug = peer.slug || slugifyCouncilorName(peer.displayName, peer.uid);
          return (
            <button
              key={peer.uid}
              type="button"
              onClick={() => onNavigate(`/consejeros/${peerSlug}`)}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-3 text-left transition-colors hover:border-[#7B1832]/40 hover:bg-white dark:border-slate-800 dark:bg-slate-950/60 dark:hover:bg-slate-900"
            >
              <Avatar src={peer.photoUrl} name={peer.displayName} size="md" />
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-stone-950 dark:text-white">
                  {peer.displayName}
                </p>
                <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                  {peer.positionTitle || ROLE_LABELS[peer.role]}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function CouncilorLinkedProjectsCard({
  projects,
  onNavigate,
}: {
  projects: ProjectItem[];
  onNavigate: (path: AppRoute) => void;
}) {
  if (projects.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Proyectos en los que participa ({projects.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/gestion')}
          className="text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
        >
          Ver en Gestión →
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {projects.map((proj) => (
          <div key={proj.id} className="rounded-lg border border-stone-200 p-3.5 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-stone-900 dark:text-white">{proj.title}</p>
              <span className="font-mono-tabular text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                {proj.progressPercent}%
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-600 dark:text-slate-300">{proj.summary}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export { getCommissionSlug };
