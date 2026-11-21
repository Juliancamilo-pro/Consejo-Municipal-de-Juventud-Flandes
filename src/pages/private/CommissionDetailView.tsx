import { useState } from 'react';
import {
  Archive,
  ArrowLeft,
  Edit3,
  RotateCcw,
  UserPlus,
} from 'lucide-react';
import { requestJoinCommission } from '../../services/commissionRequestsService';
import { updateCommissionStatus } from '../../services/commissionsService';
import {
  AuditLogEntry,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  InstitutionalDocument,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import {
  computeCommissionGoalsProgress,
  getCommissionAccent,
  getCommissionIcon,
  getCommissionSlug,
} from '../../utils/commissionUtils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusText } from '../../components/ui/StatusText';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { CommissionGoalsTab, CommissionMembersTab } from './CommissionMembersAndGoalsTab';
import { CommissionSecondaryTabs } from './CommissionSecondaryTabs';
import { CommissionSummaryTab } from './CommissionSummaryTab';

type DetailTab =
  | 'resumen'
  | 'integrantes'
  | 'metas'
  | 'compromisos'
  | 'documentos'
  | 'sesiones'
  | 'proyectos'
  | 'actividad';

interface CommissionDetailViewProps {
  actor: UserProfile;
  isBoard: boolean;
  commission: Commission;
  users: UserProfile[];
  documents: InstitutionalDocument[];
  sessions: PlenarySession[];
  commitments: CommitmentItem[];
  projects: ProjectItem[];
  events: CalendarEventItem[];
  auditLogs: AuditLogEntry[];
  onBack: () => void;
  onEdit: () => void;
  onReload: () => Promise<void>;
}

export function CommissionDetailView({
  actor,
  isBoard,
  commission,
  users,
  documents,
  sessions,
  commitments,
  projects,
  events,
  auditLogs,
  onBack,
  onEdit,
  onReload,
}: CommissionDetailViewProps) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<DetailTab>('resumen');
  const [busy, setBusy] = useState(false);

  const isCommissionLeader = commission.leaderUid === actor.uid;
  const canManage = isBoard || isCommissionLeader;
  const isMember =
    (commission.memberUids || []).includes(actor.uid) ||
    (commission.members || []).some((m) => m.uid === actor.uid);

  const accent = getCommissionAccent(commission.accentColor);
  const Icon = getCommissionIcon(commission.iconName);
  const slug = getCommissionSlug(commission);

  const scopedCommitments = commitments.filter((c) => c.commissionId === commission.id);
  const scopedDocuments = documents.filter((d) => d.commissionId === commission.id);
  const scopedProjects = projects.filter((p) => p.commissionId === commission.id);
  const scopedSessions = sessions.filter(
    (s) =>
      s.sessionType === 'comision' &&
      (s.title.toLowerCase().includes(commission.name.toLowerCase()) ||
        s.agenda.toLowerCase().includes(commission.name.toLowerCase())),
  );
  const scopedEvents = events.filter(
    (ev) =>
      ev.title.toLowerCase().includes(commission.name.toLowerCase()) ||
      (ev.description || '').toLowerCase().includes(commission.name.toLowerCase()),
  );
  const scopedLogs = auditLogs.filter(
    (l) =>
      l.targetId === commission.id ||
      l.summary.toLowerCase().includes(commission.name.toLowerCase()),
  );

  const avgCommitments =
    scopedCommitments.length > 0
      ? Math.round(
          scopedCommitments.reduce((sum, c) => sum + c.progressPercent, 0) /
            scopedCommitments.length,
        )
      : 0;
  const avgGoals = computeCommissionGoalsProgress(commission);

  const handleToggleArchive = async () => {
    setBusy(true);
    try {
      const nextStatus = commission.status === 'archivada' ? 'activa' : 'archivada';
      await updateCommissionStatus(actor, commission, nextStatus);
      showToast(`Comisión marcada como ${nextStatus}.`, 'success');
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const handleRequestJoin = async () => {
    setBusy(true);
    try {
      await requestJoinCommission(actor, commission);
      showToast('Solicitud enviada a la Mesa Directiva y al líder de la comisión.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'No se pudo enviar la solicitud.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div
          className="relative h-32 w-full sm:h-40"
          style={
            commission.coverImageUrl
              ? undefined
              : { background: `linear-gradient(120deg, ${accent}, #0F172A)` }
          }
        >
          {commission.coverImageUrl && (
            <img
              src={commission.coverImageUrl}
              alt={commission.name}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-950/25 to-transparent" />
          <div className="absolute top-3 left-3">
            <Button size="sm" variant="outline" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Comisiones</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: accent }}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <StatusText
                label={commission.status}
                tone={commission.status === 'activa' ? 'success' : 'neutral'}
              />
              <h2 className="mt-1 font-display text-2xl font-semibold text-stone-950 dark:text-white">
                {commission.name}
              </h2>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Ruta pública: /comisiones/{slug}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isMember && commission.status === 'activa' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void handleRequestJoin()}>
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Solicitar unirme</span>
              </Button>
            )}
            {canManage && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Editar</span>
              </Button>
            )}
            {isBoard && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleToggleArchive()}>
                {commission.status === 'archivada' ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reactivar</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Archivar</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Tabs
        ariaLabel="Detalle de comisión"
        activeId={tab}
        onChange={setTab}
        options={[
          { id: 'resumen', label: 'Resumen' },
          { id: 'integrantes', label: `Integrantes (${commission.members?.length ?? commission.memberUids?.length ?? 0})` },
          { id: 'metas', label: `Plan de trabajo (${commission.goals?.length ?? 0})` },
          { id: 'compromisos', label: `Compromisos (${scopedCommitments.length})` },
          { id: 'documentos', label: `Documentos (${scopedDocuments.length})` },
          { id: 'sesiones', label: `Sesiones (${scopedSessions.length + scopedEvents.length})` },
          { id: 'proyectos', label: `Proyectos (${scopedProjects.length})` },
          { id: 'actividad', label: 'Actividad reciente' },
        ]}
      />

      {tab === 'resumen' && (
        <CommissionSummaryTab
          commission={commission}
          avgGoals={avgGoals}
          avgCommitments={avgCommitments}
        />
      )}

      {tab === 'integrantes' && (
        <CommissionMembersTab
          actor={actor}
          commission={commission}
          users={users}
          canManage={canManage}
          isBoard={isBoard}
          onReload={onReload}
        />
      )}

      {tab === 'metas' && (
        <CommissionGoalsTab
          actor={actor}
          commission={commission}
          canManage={canManage}
          onReload={onReload}
        />
      )}

      {tab !== 'resumen' && tab !== 'integrantes' && tab !== 'metas' && (
        <CommissionSecondaryTabs
          tab={tab}
          actor={actor}
          commission={commission}
          canManage={canManage}
          documents={scopedDocuments}
          sessions={scopedSessions}
          commitments={scopedCommitments}
          projects={scopedProjects}
          events={scopedEvents}
          auditLogs={scopedLogs}
          onReload={onReload}
        />
      )}
    </div>
  );
}
