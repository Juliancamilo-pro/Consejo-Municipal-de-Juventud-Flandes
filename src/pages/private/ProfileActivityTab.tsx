import { useEffect, useState } from 'react';
import { ArrowUpRight, Calendar, CalendarCheck, CheckSquare, Users, Vote } from 'lucide-react';
import { checkHasVoted } from '../../services/electionsCommitmentsMailboxService';
import {
  AttendanceRecord,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  ElectionItem,
  PlenarySession,
  UserProfile,
} from '../../types/models';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PrivateSection } from './PortalSidebar';

interface ProfileActivityTabProps {
  profile: UserProfile;
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  commitments: CommitmentItem[];
  commissions: Commission[];
  elections: ElectionItem[];
  events: CalendarEventItem[];
  onNavigateSection: (section: PrivateSection) => void;
}

export function ProfileActivityTab({
  profile,
  sessions,
  attendance,
  commitments,
  commissions,
  elections,
  events,
  onNavigateSection,
}: ProfileActivityTabProps) {
  const [votedIds, setVotedIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (elections.length === 0) {
      setVotedIds([]);
      return;
    }
    void Promise.all(
      elections.map(async (el) => ({
        id: el.id,
        voted: await checkHasVoted(el.id, profile.uid),
      })),
    ).then((results) => {
      if (active) {
        setVotedIds(results.filter((r) => r.voted).map((r) => r.id));
      }
    });
    return () => {
      active = false;
    };
  }, [elections, profile.uid]);

  const myAttendance = attendance.filter((a) => a.userUid === profile.uid);
  const presentCount = myAttendance.filter((a) => a.status === 'presente').length;
  const attRate =
    myAttendance.length > 0 ? Math.round((presentCount / myAttendance.length) * 100) : 0;

  const myCommitments = commitments.filter((c) => c.assigneeUid === profile.uid);
  const doneCommitments = myCommitments.filter((c) => c.status === 'cumplido').length;
  const inProgressCommitments = myCommitments.filter(
    (c) => c.status === 'en_progreso' || c.status === 'pendiente',
  ).length;
  const overdueCommitments = myCommitments.filter((c) => c.status === 'vencido').length;

  const myCommissions = commissions.filter(
    (c) =>
      c.leaderUid === profile.uid ||
      c.secretaryUid === profile.uid ||
      (c.memberUids || []).includes(profile.uid),
  );

  const nowIso = new Date().toISOString();
  const upcomingEvents = events
    .filter((ev) => ev.startIso >= nowIso)
    .sort((a, b) => a.startIso.localeCompare(b.startIso))
    .slice(0, 4);

  const votedElections = elections.filter((e) => votedIds.includes(e.id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-slate-300">
              <CalendarCheck className="h-4 w-4 text-[#7B1832] dark:text-[#E5C158]" aria-hidden="true" />
              <span>Asistencia a sesiones</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onNavigateSection('sesiones')}>
              <span>Ir a Sesiones</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-stone-950 dark:text-white">
            {presentCount} / {myAttendance.length}
          </p>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            {attRate}% de presencialidad · {sessions.length} sesión(es) registradas en el pleno
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-slate-300">
              <CheckSquare className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" aria-hidden="true" />
              <span>Mis compromisos</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onNavigateSection('votaciones')}>
              <span>Ver compromisos</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-stone-950 dark:text-white">
            {doneCommitments} cumplidos
          </p>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            {inProgressCommitments} en curso o pendientes · {overdueCommitments} vencidos
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-stone-600 uppercase dark:text-slate-300">
            <Users className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#E5C158]" aria-hidden="true" />
            <span>Comisiones vinculadas ({myCommissions.length})</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => onNavigateSection('comisiones')}>
            <span>Comisiones</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
        {myCommissions.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
            Aún no estás asignado a una comisión de trabajo. Puedes solicitar ingreso desde el módulo de Comisiones.
          </p>
        ) : (
          <ul className="mt-2.5 space-y-1.5 text-xs">
            {myCommissions.map((c) => {
              const myRole =
                c.leaderUid === profile.uid
                  ? 'Líder'
                  : c.secretaryUid === profile.uid
                    ? 'Secretario(a)'
                    : 'Integrante';
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <span className="font-medium text-stone-900 dark:text-white">{c.name}</span>
                  <Badge tone={myRole === 'Líder' ? 'brand' : 'info'}>{myRole}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300">
              <Vote className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#E5C158]" aria-hidden="true" />
              <span>Votaciones en las que participé ({votedElections.length})</span>
            </span>
          </div>
          {votedElections.length === 0 ? (
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
              No registras participación en votaciones internas cerradas o abiertas aún.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {votedElections.map((el) => (
                <li key={el.id} className="flex items-center justify-between gap-2 text-stone-700 dark:text-slate-200">
                  <span className="truncate">{el.title}</span>
                  <Badge tone="success">Voto emitido</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-[#1E3A8A] dark:text-blue-400" aria-hidden="true" />
              <span>Próximos eventos del calendario</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => onNavigateSection('agenda')}>
              <span>Agenda</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
              No hay eventos próximos programados en este momento.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {upcomingEvents.map((ev) => (
                <li key={ev.id} className="text-stone-700 dark:text-slate-200">
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    {ev.startIso.slice(0, 10)} · {ev.location}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
