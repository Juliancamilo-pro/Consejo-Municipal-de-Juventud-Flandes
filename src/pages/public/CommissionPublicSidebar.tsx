import { Calendar, MapPin } from 'lucide-react';
import { CalendarEventItem, Commission, PublicDirectoryMember } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';

interface CommissionPublicSidebarProps {
  commission: Commission;
  publishedMembers: PublicDirectoryMember[];
  upcomingEvents: CalendarEventItem[];
  onNavigate: (path: AppRoute) => void;
}

export function CommissionPublicSidebar({
  commission,
  publishedMembers,
  upcomingEvents,
  onNavigate,
}: CommissionPublicSidebarProps) {
  return (
    <aside className="space-y-5">
      <Card>
        <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Lugar y horario de reunión
        </h3>
        <div className="mt-3 space-y-2.5 text-sm text-stone-600 dark:text-slate-300">
          <p className="flex items-start gap-2">
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]"
              aria-hidden="true"
            />
            <span>{commission.meetingPlace || 'Por confirmar según agenda'}</span>
          </p>
          <p className="flex items-start gap-2">
            <Calendar
              className="mt-0.5 h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]"
              aria-hidden="true"
            />
            <span>{commission.meetingSchedule || 'Según convocatoria del CMJ'}</span>
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Consejeros integrantes ({publishedMembers.length})
        </h3>
        {publishedMembers.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
            {commission.leaderName
              ? `Líder: ${commission.leaderName}`
              : 'Los perfiles públicos de los consejeros aparecerán tras su aprobación.'}
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {publishedMembers.map((member) => (
              <button
                key={member.uid}
                type="button"
                onClick={() =>
                  onNavigate(
                    `/consejeros/${member.slug || slugifyCouncilorName(member.displayName, member.uid)}`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-lg border border-stone-200 p-2 text-left transition-colors hover:bg-stone-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
              >
                <Avatar name={member.displayName} src={member.photoUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-950 dark:text-white">
                    {member.displayName}
                  </p>
                  <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                    {commission.leaderUid === member.uid
                      ? 'Líder de comisión'
                      : member.positionTitle || 'Consejero integrante'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {upcomingEvents.length > 0 && (
        <Card>
          <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Próximos eventos
          </h3>
          <div className="mt-3 space-y-2.5">
            {upcomingEvents.map((ev) => (
              <div
                key={ev.id}
                className="border-b border-stone-200 pb-2 text-xs last:border-0 dark:border-slate-800"
              >
                <p className="font-semibold text-stone-900 dark:text-white">{ev.title}</p>
                <p className="text-stone-500 dark:text-slate-400">
                  {ev.startIso} · {ev.location}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </aside>
  );
}
