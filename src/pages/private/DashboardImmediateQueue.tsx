import { AlertCircle, ArrowRight } from 'lucide-react';
import {
  CommitmentItem,
  InstitutionalDocument,
  MailboxEntry,
  PlenarySession,
  ROLE_LABELS,
  UserRole,
} from '../../types/models';
import { Card } from '../../components/ui/Card';
import { StatusText } from '../../components/ui/StatusText';
import { PrivateSection } from './PortalSidebar';

export function DashboardImmediateQueue({
  role,
  isBoard,
  pendingUsers,
  commitments,
  sessions,
  mailbox,
  documents = [],
  onNavigateSection,
}: {
  role: UserRole;
  isBoard: boolean;
  pendingUsers: number;
  commitments: CommitmentItem[];
  sessions: PlenarySession[];
  mailbox: MailboxEntry[];
  documents?: InstitutionalDocument[];
  onNavigateSection: (section: PrivateSection) => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueCommitments = commitments.filter(
    (c) => c.status !== 'cumplido' && (c.status === 'vencido' || (c.dueDate && c.dueDate < todayIso)),
  );
  const upcomingSessions = sessions.filter((s) => s.status === 'programada' && s.dateIso >= todayIso);
  const unansweredMailbox = mailbox.filter((m) => m.status === 'radicado' || m.status === 'en_revision');
  const docsInReview = documents.filter((d) => d.status === 'revision');

  const items: {
    label: string;
    count: number;
    tone: 'danger' | 'warning' | 'info' | 'success';
    target: PrivateSection;
    actionLabel: string;
  }[] = [
    ...(isBoard
      ? [
          {
            label: 'Cuentas por aprobar',
            count: pendingUsers,
            tone: (pendingUsers > 0 ? 'warning' : 'success') as 'warning' | 'success',
            target: 'usuarios' as PrivateSection,
            actionLabel: 'Revisar cuentas',
          },
          {
            label: 'Documentos pendientes de revisión',
            count: docsInReview.length,
            tone: (docsInReview.length > 0 ? 'warning' : 'success') as 'warning' | 'success',
            target: 'documentos' as PrivateSection,
            actionLabel: 'Revisar documentos',
          },
        ]
      : []),
    {
      label: 'Compromisos vencidos o retrasados',
      count: overdueCommitments.length,
      tone: overdueCommitments.length > 0 ? 'danger' : 'success',
      target: 'votaciones',
      actionLabel: 'Gestionar tablero',
    },
    {
      label: 'Sesiones próximas programadas',
      count: upcomingSessions.length,
      tone: 'info',
      target: 'sesiones',
      actionLabel: 'Ver sesiones',
    },
    {
      label: 'Radicados ciudadanos sin respuesta',
      count: unansweredMailbox.length,
      tone: unansweredMailbox.length > 0 ? 'warning' : 'success',
      target: 'agenda',
      actionLabel: 'Atender buzón',
    },
  ];

  return (
    <Card padding="sm" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Atención inmediata · Pendientes operativos
          </h2>
        </div>
        <span className="text-xs text-stone-500 dark:text-slate-400">Rol: {ROLE_LABELS[role]}</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigateSection(item.target)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-[#FAF8F4] px-3.5 py-2.5 text-left transition-colors hover:border-[#7B1832]/50 dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div>
              <StatusText
                tone={item.tone}
                label={`${item.count} ${item.count === 1 ? 'pendiente' : 'pendientes'}`}
              />
              <p className="mt-1.5 text-xs font-semibold text-stone-900 dark:text-white">
                {item.label}
              </p>
              <p className="text-[11px] text-[#7B1832] dark:text-[#D9B245]">{item.actionLabel}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-stone-400 group-hover:text-[#7B1832]" aria-hidden="true" />
          </button>
        ))}
      </div>
    </Card>
  );
}
