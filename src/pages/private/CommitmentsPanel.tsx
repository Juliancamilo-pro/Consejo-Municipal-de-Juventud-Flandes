import { FormEvent, useMemo, useState } from 'react';
import { CheckSquare, Download, LayoutGrid, List } from 'lucide-react';
import {
  createCommitment,
  updateCommitmentProgress,
} from '../../services/electionsCommitmentsMailboxService';
import { CommitmentItem, UserProfile } from '../../types/models';
import { exportCommitmentsExcel, exportCommitmentsPdf } from '../../utils/reportExport';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { CommitmentDetailsModal } from './CommitmentDetailsModal';
import { CommitmentsKanban } from './CommitmentsKanban';

interface CommitmentsPanelProps {
  actor: UserProfile;
  isLeaderOrBoard: boolean;
  activeUsers: UserProfile[];
  commitments: CommitmentItem[];
  onReload: () => Promise<void>;
}

export function CommitmentsPanel({
  actor,
  isLeaderOrBoard,
  activeUsers,
  commitments,
  onReload,
}: CommitmentsPanelProps) {
  const { showToast } = useToast();
  const [compTitle, setCompTitle] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compAssigneeUid, setCompAssigneeUid] = useState('');
  const [compDueDate, setCompDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban');
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commitments.filter((c) => {
      if (assigneeFilter && c.assigneeUid !== assigneeFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (dueFrom && c.dueDate < dueFrom) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.assigneeName.toLowerCase().includes(q)
      );
    });
  }, [commitments, search, assigneeFilter, statusFilter, dueFrom]);

  const selectedCommitment = useMemo(
    () => commitments.find((c) => c.id === selectedCommitmentId) || null,
    [commitments, selectedCommitmentId],
  );

  const handleCreateCommitment = async (e: FormEvent) => {
    e.preventDefault();
    const assignee = activeUsers.find((u) => u.uid === compAssigneeUid);
    if (!assignee) return;
    setSaving(true);
    try {
      await createCommitment(actor, {
        title: compTitle,
        description: compDesc,
        assigneeUid: assignee.uid,
        assigneeName: assignee.displayName,
        dueDate: compDueDate,
      });
      setCompTitle('');
      setCompDesc('');
      setCompDueDate('');
      showToast('Compromiso asignado correctamente.', 'success');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<CommitmentItem>[] = [
    {
      key: 'title',
      header: 'Compromiso',
      sortValue: (c) => c.title,
      render: (c) => (
        <button
          type="button"
          onClick={() => setSelectedCommitmentId(c.id)}
          className="text-left font-semibold text-stone-900 hover:text-[#7B1832] dark:text-white dark:hover:text-[#D9B245]"
        >
          {c.title}
        </button>
      ),
    },
    { key: 'assignee', header: 'Responsable', sortValue: (c) => c.assigneeName, render: (c) => <span>{c.assigneeName}</span> },
    {
      key: 'dueDate',
      header: 'Fecha límite',
      sortValue: (c) => c.dueDate,
      render: (c) => {
        const overdue = c.status !== 'cumplido' && c.dueDate < todayIso;
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono-tabular">{c.dueDate}</span>
            {overdue && <Badge tone="danger">Vencido</Badge>}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      sortValue: (c) => c.status,
      render: (c) => (
        <StatusText
          label={`${c.status} (${c.progressPercent}%)`}
          tone={c.status === 'cumplido' ? 'success' : c.status === 'vencido' ? 'danger' : 'info'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Acción rápida',
      render: (c) => {
        const canUpdate = isLeaderOrBoard || c.assigneeUid === actor.uid;
        return canUpdate && c.status !== 'cumplido' ? (
          <Button size="sm" variant="outline" onClick={() => void updateCommitmentProgress(c.id, 100, 'cumplido').then(onReload)}>
            Cumplido
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setSelectedCommitmentId(c.id)}>
            Detalle
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {isLeaderOrBoard && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Asignar compromiso
          </h2>
          <form onSubmit={handleCreateCommitment} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Título del compromiso" required minLength={3} maxLength={180} value={compTitle} onChange={(e) => setCompTitle(e.target.value)} />
              <Select label="Responsable" required value={compAssigneeUid} onChange={(e) => setCompAssigneeUid(e.target.value)}>
                <option value="">Selecciona consejero</option>
                {activeUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>{u.displayName}</option>
                ))}
              </Select>
              <Input label="Fecha límite" type="date" required value={compDueDate} onChange={(e) => setCompDueDate(e.target.value)} />
            </div>
            <Textarea label="Descripción" required minLength={3} maxLength={2000} rows={2} value={compDesc} onChange={(e) => setCompDesc(e.target.value)} />
            <Button type="submit" loading={saving}>Asignar compromiso</Button>
          </form>
        </Card>
      )}

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
            Seguimiento de compromisos ({filtered.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={viewMode === 'kanban' ? 'primary' : 'outline'} onClick={() => setViewMode('kanban')}>
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /><span>Kanban</span>
            </Button>
            <Button size="sm" variant={viewMode === 'lista' ? 'primary' : 'outline'} onClick={() => setViewMode('lista')}>
              <List className="h-3.5 w-3.5" aria-hidden="true" /><span>Tabla</span>
            </Button>
            <Button size="sm" variant="outline" disabled={filtered.length === 0} onClick={() => exportCommitmentsPdf(filtered)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>PDF</span>
            </Button>
            <Button size="sm" variant="outline" disabled={filtered.length === 0} onClick={() => void exportCommitmentsExcel(filtered)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>Excel</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Buscar" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Compromiso o responsable..." />
          <Select label="Responsable" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="">Todos</option>
            {activeUsers.map((u) => (
              <option key={u.uid} value={u.uid}>{u.displayName}</option>
            ))}
          </Select>
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_progreso">En progreso</option>
            <option value="cumplido">Cumplido</option>
            <option value="vencido">Vencido</option>
          </Select>
          <Input label="Fecha límite desde" type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Sin compromisos que coincidan" description="Asigna tareas y metas por consejero o ajusta los filtros." />
      ) : viewMode === 'kanban' ? (
        <CommitmentsKanban
          actor={actor}
          isLeaderOrBoard={isLeaderOrBoard}
          commitments={filtered}
          onOpenDetails={(item) => setSelectedCommitmentId(item.id)}
          onReload={onReload}
        />
      ) : (
        <Card>
          <DataTable rows={filtered} columns={columns} rowKey={(c) => c.id} exportFileName="cmj-flandes-compromisos" exportTitle="Compromisos del Consejo — CMJ Flandes" />
        </Card>
      )}

      <CommitmentDetailsModal
        commitment={selectedCommitment}
        actor={actor}
        isLeaderOrBoard={isLeaderOrBoard}
        activeUsers={activeUsers}
        onClose={() => setSelectedCommitmentId(null)}
        onReload={onReload}
      />
    </div>
  );
}
