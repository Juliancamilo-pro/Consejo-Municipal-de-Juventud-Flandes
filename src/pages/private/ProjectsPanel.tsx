import { FormEvent, useMemo, useState } from 'react';
import { Archive, Edit3, FileText, FolderKanban, LayoutGrid, List } from 'lucide-react';
import { saveProjectItem } from '../../services/privateContentService';
import {
  Commission,
  InstitutionalDocument,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { StorageDownloadButton } from '../../components/ui/StorageFileActions';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

interface ProjectsPanelProps {
  actor: UserProfile;
  isLeaderOrBoard: boolean;
  projects: ProjectItem[];
  commissions?: Commission[];
  documents?: InstitutionalDocument[];
  onReload: () => Promise<void>;
}

export function ProjectsPanel({
  actor,
  isLeaderOrBoard,
  projects,
  commissions = [],
  documents = [],
  onReload,
}: ProjectsPanelProps) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projTitle, setProjTitle] = useState('');
  const [projCommissionId, setProjCommissionId] = useState('');
  const [projSummary, setProjSummary] = useState('');
  const [projObjective, setProjObjective] = useState('');
  const [projProgress, setProjProgress] = useState(0);
  const [projStatus, setProjStatus] = useState<'borrador' | 'publicada' | 'archivada'>('borrador');
  const [savingProj, setSavingProj] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [comFilter, setComFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [archiveTarget, setArchiveTarget] = useState<ProjectItem | null>(null);
  const [archiving, setArchiving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (comFilter && p.commissionId !== comFilter) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.summary.toLowerCase().includes(q);
    });
  }, [projects, search, statusFilter, comFilter]);

  const resetForm = () => {
    setEditingId(null);
    setProjTitle('');
    setProjCommissionId('');
    setProjSummary('');
    setProjObjective('');
    setProjProgress(0);
    setProjStatus('borrador');
  };

  const startEdit = (p: ProjectItem) => {
    setEditingId(p.id);
    setProjTitle(p.title);
    setProjCommissionId(p.commissionId || '');
    setProjSummary(p.summary);
    setProjObjective(p.objective);
    setProjProgress(p.progressPercent);
    setProjStatus(p.status);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProj(true);
    try {
      await saveProjectItem(actor, {
        ...(editingId ? { id: editingId } : {}),
        title: projTitle,
        summary: projSummary,
        objective: projObjective,
        commissionId: projCommissionId || undefined,
        progressPercent: Number(projProgress),
        status: projStatus,
      });
      showToast(editingId ? 'Proyecto actualizado.' : 'Proyecto guardado correctamente.', 'success');
      resetForm();
      await onReload();
    } finally {
      setSavingProj(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await saveProjectItem(actor, { ...archiveTarget, status: 'archivada' });
      showToast('Proyecto archivado.', 'info');
      setArchiveTarget(null);
      await onReload();
    } finally {
      setArchiving(false);
    }
  };

  const columns: TableColumn<ProjectItem>[] = [
    { key: 'title', header: 'Proyecto', sortValue: (p) => p.title, render: (p) => <span className="font-semibold">{p.title}</span> },
    {
      key: 'commission',
      header: 'Comisión',
      sortValue: (p) => commissions.find((c) => c.id === p.commissionId)?.name || 'General',
      render: (p) => <span>{commissions.find((c) => c.id === p.commissionId)?.name || 'General del CMJ'}</span>,
    },
    { key: 'progress', header: 'Avance', sortValue: (p) => p.progressPercent, align: 'right', render: (p) => <span className="font-mono-tabular">{p.progressPercent}%</span> },
    { key: 'status', header: 'Estado', sortValue: (p) => p.status, render: (p) => <StatusText label={p.status} tone={p.status === 'publicada' ? 'success' : 'neutral'} /> },
  ];

  return (
    <div className="space-y-6">
      {isLeaderOrBoard && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
              {editingId ? 'Editar proyecto juvenil' : 'Registrar proyecto juvenil'}
            </h2>
            {editingId && (
              <Button size="sm" variant="outline" onClick={resetForm}>Cancelar edición</Button>
            )}
          </div>
          <form onSubmit={handleSaveProject} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Título del proyecto" required minLength={3} maxLength={180} value={projTitle} onChange={(e) => setProjTitle(e.target.value)} />
              <Select label="Comisión responsable" value={projCommissionId} onChange={(e) => setProjCommissionId(e.target.value)}>
                <option value="">General del CMJ</option>
                {commissions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Input label="Avance (%)" type="number" min={0} max={100} value={projProgress} onChange={(e) => setProjProgress(Number(e.target.value))} />
              <Select label="Estado" value={projStatus} onChange={(e) => setProjStatus(e.target.value as 'borrador' | 'publicada' | 'archivada')}>
                <option value="borrador">Borrador</option>
                <option value="publicada">Publicada</option>
                <option value="archivada">Archivada</option>
              </Select>
            </div>
            <Input label="Resumen" required minLength={5} maxLength={500} value={projSummary} onChange={(e) => setProjSummary(e.target.value)} />
            <Textarea label="Objetivo e impacto territorial" required minLength={5} maxLength={4000} rows={3} value={projObjective} onChange={(e) => setProjObjective(e.target.value)} />
            <Button type="submit" loading={savingProj}>{editingId ? 'Actualizar proyecto' : 'Guardar proyecto'}</Button>
          </form>
        </Card>
      )}

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Proyectos ({filtered.length})
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant={viewMode === 'cards' ? 'primary' : 'outline'} onClick={() => setViewMode('cards')}>
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /><span>Tarjetas</span>
            </Button>
            <Button size="sm" variant={viewMode === 'table' ? 'primary' : 'outline'} onClick={() => setViewMode('table')}>
              <List className="h-3.5 w-3.5" aria-hidden="true" /><span>Tabla y Exportar</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Buscar" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título o resumen..." />
          <Select label="Comisión" value={comFilter} onChange={(e) => setComFilter(e.target.value)}>
            <option value="">Todas</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="publicada">Publicada</option>
            <option value="borrador">Borrador</option>
            <option value="archivada">Archivada</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Sin proyectos registrados" description="Registra iniciativas y su porcentaje real de cumplimiento." />
      ) : viewMode === 'table' ? (
        <Card>
          <DataTable rows={filtered} columns={columns} rowKey={(p) => p.id} exportFileName="cmj-flandes-proyectos" exportTitle="Proyectos Juveniles — CMJ Flandes" />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const linkedDocs = documents.filter((d) => d.projectId === p.id);
            const commissionName = commissions.find((c) => c.id === p.commissionId)?.name;
            return (
              <Card key={p.id} padding="sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                      <StatusText label={p.status} tone={p.status === 'publicada' ? 'success' : 'neutral'} />
                      <span className="font-mono-tabular">{p.progressPercent}%</span>
                      {commissionName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{commissionName}</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{p.title}</h3>
                  </div>
                  {isLeaderOrBoard && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(p)}>
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /><span>Editar</span>
                      </Button>
                      {p.status !== 'publicada' && (
                        <Button size="sm" onClick={() => void saveProjectItem(actor, { ...p, status: 'publicada' }).then(onReload)}>Publicar</Button>
                      )}
                      {p.status !== 'archivada' && (
                        <Button size="sm" variant="outline" onClick={() => setArchiveTarget(p)}>
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" /><span>Archivar</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {linkedDocs.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2.5 text-xs dark:border-slate-800">
                    <span className="inline-flex items-center gap-1 font-medium text-stone-600 dark:text-slate-300">
                      <FileText className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                      Documentos vinculados ({linkedDocs.length}):
                    </span>
                    {linkedDocs.map((docItem) => (
                      <span key={docItem.id} className="inline-flex items-center gap-1.5">
                        <span className="text-stone-700 dark:text-slate-200">{docItem.title}</span>
                        <StorageDownloadButton compact item={docItem} />
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(archiveTarget)}
        destructive
        loading={archiving}
        title="¿Archivar proyecto?"
        description={`El proyecto "${archiveTarget?.title || ''}" cambiará a estado archivado y no será visible en el portal ciudadano.`}
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
