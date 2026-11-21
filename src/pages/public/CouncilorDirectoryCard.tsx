import { ArrowRight, Quote } from 'lucide-react';
import { Commission, PublicDirectoryMember, ROLE_LABELS } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { getCommissionSlug } from '../../utils/commissionUtils';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

interface CouncilorDirectoryCardProps {
  member: PublicDirectoryMember;
  slug: string;
  commObj?: Commission;
  compact: boolean;
  onNavigate: (path: AppRoute) => void;
}

export function CouncilorDirectoryCard({
  member,
  slug,
  commObj,
  compact,
  onNavigate,
}: CouncilorDirectoryCardProps) {
  const commName = member.commissionName || commObj?.name;

  return (
    <Card key={member.uid} variant="interactive" className="flex flex-col justify-between">
      <div>
        <div className="flex items-start gap-3.5">
          <Avatar src={member.photoUrl} name={member.displayName} size="md" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
              {ROLE_LABELS[member.role]}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-semibold text-stone-950 dark:text-white">
              {member.displayName}
            </h3>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              {[member.positionTitle, member.sector].filter(Boolean).join(' · ') || 'Periodo 2026–2029'}
            </p>
          </div>
        </div>

        {commName && (
          <button
            type="button"
            onClick={() => commObj && onNavigate(`/comisiones/${getCommissionSlug(commObj)}`)}
            className="mt-3 text-left text-xs font-medium text-[#7B1832] hover:underline dark:text-[#D9B245]"
          >
            Comisión: {commName}
          </button>
        )}

        {!compact && member.featuredQuote && (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-[#C59B27]/20 bg-[#FAF8F4] px-2.5 py-2 text-xs italic text-stone-700 dark:border-[#C59B27]/30 dark:bg-slate-950/60 dark:text-slate-200">
            <Quote className="mt-0.5 h-3 w-3 shrink-0 text-[#C59B27]" aria-hidden="true" />
            <span className="line-clamp-2">“{member.featuredQuote}”</span>
          </p>
        )}

        {!compact && !member.featuredQuote && (member.shortBio || member.bio) && (
          <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
            {member.shortBio || member.bio}
          </p>
        )}

        {!compact && member.workAxes && member.workAxes.length > 0 && (
          <p className="mt-3 text-xs text-stone-500 dark:text-slate-400">
            {member.workAxes.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/80 pt-3 dark:border-slate-800">
        <WhatsAppShareButton
          text={`Perfil oficial de ${member.displayName} en el CMJ Flandes`}
          url={typeof window !== 'undefined' ? `${window.location.origin}/consejeros/${slug}` : undefined}
        />
        <button
          type="button"
          onClick={() => onNavigate(`/consejeros/${slug}`)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
        >
          <span>Ver ficha</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
