import { CalendarCheck, CheckSquare, FileCheck2, Mail } from 'lucide-react';
import {
  AttendanceRecord,
  Commission,
  CommitmentItem,
  ROLE_LABELS,
  UserProfile,
} from '../../types/models';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Drawer } from '../../components/ui/Drawer';

interface UserActivityDrawerProps {
  user: UserProfile | null;
  commissions: Commission[];
  attendance: AttendanceRecord[];
  commitments: CommitmentItem[];
  onClose: () => void;
}

export function UserActivityDrawer({
  user,
  commissions,
  attendance,
  commitments,
  onClose,
}: UserActivityDrawerProps) {
  if (!user) {
    return (
      <Drawer open={false} title="Historial de actividad" onClose={onClose}>
        {null}
      </Drawer>
    );
  }

  const userAttendance = attendance.filter((a) => a.userUid === user.uid);
  const presentCount = userAttendance.filter((a) => a.status === 'presente').length;
  const attPct =
    userAttendance.length > 0 ? Math.round((presentCount / userAttendance.length) * 100) : 0;

  const userCommitments = commitments.filter((c) => c.assigneeUid === user.uid);
  const doneCommitments = userCommitments.filter((c) => c.status === 'cumplido').length;

  const userCommissions = commissions.filter(
    (c) =>
      c.leaderUid === user.uid ||
      c.secretaryUid === user.uid ||
      (c.memberUids || []).includes(user.uid),
  );

  return (
    <Drawer
      open={Boolean(user)}
      title={user.displayName}
      subtitle={`${ROLE_LABELS[user.role]} · Periodo ${user.period || '2026-2029'}`}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
          <Avatar src={user.photoUrl} name={user.displayName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={user.status === 'activo' ? 'success' : user.status === 'pendiente' ? 'warning' : 'danger'}>
                {user.status.toUpperCase()}
              </Badge>
              <Badge tone={user.profileReviewStatus === 'publicada' ? 'info' : 'neutral'}>
                Ficha: {user.profileReviewStatus || 'borrador'}
              </Badge>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-stone-600 dark:text-slate-300">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{user.email}</span>
            </p>
            {user.sector && (
              <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">Sector: {user.sector}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">
              <CalendarCheck className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
              <span>Asistencia</span>
            </div>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-stone-950 dark:text-white">
              {presentCount} / {userAttendance.length}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-slate-400">{attPct}% de presencialidad</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-slate-400">
              <CheckSquare className="h-3.5 w-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
              <span>Compromisos</span>
            </div>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-stone-950 dark:text-white">
              {doneCommitments} / {userCommitments.length}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-slate-400">Cumplidos a la fecha</p>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
            Comisiones vinculadas ({userCommissions.length})
          </p>
          {userCommissions.length === 0 ? (
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
              Aún no registra pertenencia a una comisión.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs text-stone-700 dark:text-slate-200">
              {userCommissions.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[11px] text-stone-500">
                    {c.leaderUid === user.uid ? 'Líder' : c.secretaryUid === user.uid ? 'Secretario(a)' : 'Integrante'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex items-center gap-1.5 font-semibold text-stone-900 dark:text-white">
            <FileCheck2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>Cumplimiento Habeas Data</span>
          </div>
          <p className="mt-1 text-stone-600 dark:text-slate-300">
            {user.habeasDataAccepted
              ? `Aceptado (${user.habeasDataAcceptedAt || 'registrado'}).`
              : 'Pendiente de aceptación explícita en su ficha.'}
          </p>
          {user.isMinor && (
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Consejero menor de edad · Acudiente:{' '}
              {user.guardianAuthorizationNote || 'Sin nota de autorización registrada'}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
