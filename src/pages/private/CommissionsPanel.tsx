import { useMemo, useState } from 'react';
import { Building2, Calendar, Edit3, Plus, Search, Users } from 'lucide-react';
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
} from '../../utils/commissionUtils';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { Tabs } from '../../components/ui/Tabs';
import { CommissionDetailView } from './CommissionDetailView';
import { CommissionFormModal } from './CommissionFormModal';

type FilterMode = 'todas' | 'mias' | 'activas' | 'inactivas' | 'archivadas';

interface CommissionsPanelProps {
  actor: UserProfile;
  isBoard: boolean;
  users: UserProfile[];
  commissions: Commission[];
  documents: InstitutionalDocument[];
  sessions: PlenarySession[];
  commitments: CommitmentItem[];
  projects: ProjectItem[];
  events: CalendarEventItem[];
  auditLogs: AuditLogEntry[];
  onReload: () => Promise<void>;
}

export function CommissionsPanel({
  actor,
  isBoard,
  users,
  commissions,
  documents,
  sessions,
  commitments,
  projects,
  events,
  auditLogs,
  onReload,
}: CommissionsPanelProps) {
  const [filter, setFilter] = useState<FilterMode>('todas');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);

  const selectedCommission = useMemo(
    () => commissions.find((c) => c.id === selectedId) || null,
    [commissions, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commissions.filter((c) => {
      if (filter === 'mias') {
        const isMine =
          c.leaderUid === actor.uid ||
          c.secretaryUid === actor.uid ||
          (c.memberUids || []).includes(actor.uid);
        if (!isMine) return false;
      } else if (filter === 'activas' && c.status !== 'activa') return false;
      else if (filter === 'inactivas' && c.status !== 'inactiva') return false;
      else if (filter === 'archivadas' && c.status !== 'archivada') return false;

      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.leaderName || '').toLowerCase().includes(q)
      );
    });
  }, [commissions, filter, search, actor.uid]);

  if (selectedCommission) {
    return (
      <>
        <CommissionDetailView
          actor={actor}
          isBoard={isBoard}
          commission={selectedCommission}
          users={users}
          documents={documents}
          sessions={sessions}
          commitments={commitments}
          projects={projects}
          events={events}
          auditLogs={auditLogs}
          onBack={() => setSelectedId(null)}
          onEdit={() => {
            setEditingCommission(selectedCommission);
            setModalOpen(true);
          }}
          onReload={onReload}
        />
        <CommissionFormModal
          open={modalOpen}
          actor={actor}
          isBoard={isBoard}
          users={users}
          initial={editingCommission}
          onClose={() => setModalOpen(false)}
          onSaved={onReload}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <Input
            label="Buscar comisión"
            placeholder="Nombre, líder o alcance..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isBoard && (
          <Button
            onClick={() => {
              setEditingCommission(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Nueva comisión</span>
          </Button>
        )}
      </div>

      <Tabs
        ariaLabel="Filtrar comisiones"
        activeId={filter}
        onChange={setFilter}
        options={[
          { id: 'todas', label: `Todas (${commissions.length})` },
          { id: 'mias', label: 'Mis comisiones' },
          { id: 'activas', label: 'Activas' },
          { id: 'inactivas', label: 'Inactivas' },
          { id: 'archivadas', label: 'Archivadas' },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hay comisiones para mostrar"
          description="Crea una comisión nueva o ajusta el filtro seleccionado."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filtered.map((com) => {
            const accent = getCommissionAccent(com.accentColor);
            const Icon = getCommissionIcon(com.iconName);
            const members = com.members || [];
            const memberCount = Math.max(members.length, com.memberUids?.length || 0);
            const scopedCommits = commitments.filter((c) => c.commissionId === com.id);
            const commitAvg =
              scopedCommits.length > 0
                ? Math.round(
                    scopedCommits.reduce((s, c) => s + c.progressPercent, 0) /
                      scopedCommits.length,
                  )
                : computeCommissionGoalsProgress(com);
            const canEdit = isBoard || com.leaderUid === actor.uid;

            return (
              <Card key={com.id} padding="none" className="overflow-hidden transition-shadow hover:shadow-md">
                <div
                  className="relative h-24 w-full"
                  style={
                    com.coverImageUrl
                      ? undefined
                      : { background: `linear-gradient(125deg, ${accent}, #0F172A)` }
                  }
                >
                  {com.coverImageUrl && (
                    <img
                      src={com.coverImageUrl}
                      alt={com.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-950/65 to-transparent" />
                  <div
                    className="absolute bottom-3 left-4 flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm"
                    style={{ backgroundColor: accent }}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <StatusText
                      label={com.status}
                      tone={com.status === 'activa' ? 'success' : 'neutral'}
                    />
                    <span className="font-mono-tabular text-xs font-semibold text-stone-500 dark:text-slate-400">
                      Avance {commitAvg}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedId(com.id)}
                    className="mt-2 block text-left font-display text-lg font-semibold text-stone-950 hover:text-[#7B1832] dark:text-white dark:hover:text-[#D9B245]"
                  >
                    {com.name}
                  </button>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-slate-300">
                    {com.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3 text-xs text-stone-500 dark:border-slate-800 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      {members.slice(0, 3).map((m) => (
                        <Avatar key={m.uid} name={m.displayName} src={m.photoUrl} size="sm" />
                      ))}
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        {memberCount} integrantes
                      </span>
                    </div>

                    {com.meetingSchedule && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        {com.meetingSchedule}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(com.id)}>
                      <span>Abrir ficha</span>
                    </Button>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingCommission(com);
                          setModalOpen(true);
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Editar</span>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CommissionFormModal
        open={modalOpen}
        actor={actor}
        isBoard={isBoard}
        users={users}
        initial={editingCommission}
        onClose={() => setModalOpen(false)}
        onSaved={onReload}
      />
    </div>
  );
}
