import { CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';
import {
  AttendanceRecord,
  CommitmentItem,
  PlenarySession,
  UserProfile,
} from '../../types/models';
import { Card } from '../../components/ui/Card';
import { PrivateSection } from './PortalSidebar';

interface DashboardMyDayAndChecklistProps {
  profile: UserProfile;
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  commitments: CommitmentItem[];
  onNavigateSection: (section: PrivateSection) => void;
}

export function DashboardMyDayAndChecklist({
  profile,
  sessions,
  attendance,
  commitments,
  onNavigateSection,
}: DashboardMyDayAndChecklistProps) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const upcomingSessions = sessions
    .filter((s) => s.status === 'programada' && s.dateIso.slice(0, 10) >= todayIso)
    .slice(0, 3);

  const myOpenCommitments = commitments
    .filter((c) => c.assigneeUid === profile.uid && c.status !== 'cumplido')
    .slice(0, 3);

  const hasPhoto = Boolean(profile.photoUrl);
  const hasBioAndProposals = Boolean(
    profile.shortBio?.trim() && profile.proposals?.trim(),
  );
  const hasPublicRequest =
    profile.profileReviewStatus === 'revision' ||
    profile.profileReviewStatus === 'publicada';
  const hasAttendance = attendance.some((a) => a.userUid === profile.uid);

  const checklist = [
    {
      label: 'Subir foto institucional en WebP',
      done: hasPhoto,
      hint: 'Ficha pública',
    },
    {
      label: 'Completar biografía corta y propuestas',
      done: hasBioAndProposals,
      hint: 'Ficha pública',
    },
    {
      label: 'Aceptar Habeas Data y enviar ficha a revisión',
      done: Boolean(profile.habeasDataAccepted) && hasPublicRequest,
      hint: 'Privacidad',
    },
    {
      label: 'Registrar asistencia en sesión o comisión',
      done: hasAttendance,
      hint: 'Sesiones QR',
    },
  ];

  const completedSteps = checklist.filter((step) => step.done).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
              Agenda personal · Mi día
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-stone-950 dark:text-white">
              Tus próximos compromisos y sesiones
            </h2>
          </div>
          <Clock className="h-4 w-4 text-stone-400" aria-hidden="true" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 border-t border-stone-200/80 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold text-stone-700 dark:text-slate-200">
              Sesiones próximas ({upcomingSessions.length})
            </p>
            {upcomingSessions.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400">
                No hay sesiones programadas próximas en el calendario.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcomingSessions.map((s) => (
                  <li key={s.id} className="text-xs">
                    <button
                      type="button"
                      onClick={() => onNavigateSection('sesiones')}
                      className="text-left font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
                    >
                      {s.title}
                    </button>
                    <p className="font-mono-tabular text-[11px] text-stone-500 dark:text-slate-400">
                      {s.dateIso} · {s.location}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t border-stone-200/80 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold text-stone-700 dark:text-slate-200">
              Mis compromisos activos ({myOpenCommitments.length})
            </p>
            {myOpenCommitments.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Estás al día con todos tus compromisos asignados.
              </p>
            ) : (
              <ul className="space-y-2">
                {myOpenCommitments.map((c) => (
                  <li key={c.id} className="text-xs">
                    <button
                      type="button"
                      onClick={() => onNavigateSection('votaciones')}
                      className="text-left font-medium text-stone-900 hover:text-[#7B1832] hover:underline dark:text-slate-100 dark:hover:text-[#D9B245]"
                    >
                      {c.title}
                    </button>
                    <p className="font-mono-tabular text-[11px] text-stone-500 dark:text-slate-400">
                      Vence: {c.dueDate} · Avance {c.progressPercent}%
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card className="lg:col-span-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
              Primeros pasos del consejero
            </p>
            <h2 className="mt-0.5 font-display text-lg font-semibold text-stone-950 dark:text-white">
              Avance de activación ({completedSteps}/{checklist.length})
            </h2>
          </div>
          <Sparkles className="h-4 w-4 text-[#C59B27]" aria-hidden="true" />
        </div>

        <ul className="mt-3 divide-y divide-stone-200/70 text-xs dark:divide-slate-800">
          {checklist.map((step) => (
            <li key={step.label} className="flex items-center justify-between gap-2 py-2.5">
              <span
                className={`flex items-center gap-2 ${
                  step.done
                    ? 'text-stone-500 line-through dark:text-slate-400'
                    : 'font-medium text-stone-800 dark:text-slate-200'
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
                )}
                <span>{step.label}</span>
              </span>
              <span className="shrink-0 text-[11px] text-stone-400">{step.hint}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
