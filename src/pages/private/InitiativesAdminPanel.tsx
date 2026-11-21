import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Lightbulb, List } from 'lucide-react';
import {
  fetchYouthInitiatives,
  updateInitiativeStatus,
} from '../../services/initiativesService';
import { Commission, InitiativeStatus, UserProfile, YouthInitiative } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

export function InitiativesAdminPanel({
  actor,
  commissions,
}: {
  actor: UserProfile;
  commissions: Commission[];
}) {
  const { showToast } = useToast();
  const [items, setItems] = useState<YouthInitiative[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [commMap, setCommMap] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [archiveTarget, setArchiveTarget] = useState<YouthInitiative | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = async () => {
    setItems(await fetchYouthInitiatives().catch(() => []));
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.neighborhood.toLowerCase().includes(q) ||
        i.thematicArea.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  const applyStatus = async (item: YouthInitiative, next: InitiativeStatus) => {
    await updateInitiativeStatus(actor, item.id, next, responses[item.id], commMap[item.id]);
    showToast('Iniciativa actualizada.', 'success');
    await load();
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await applyStatus(archiveTarget, 'archivada');
      setArchiveTarget(null);
    } finally {
      setArchiving(false);
    }
  };

  const columns: TableColumn<YouthInitiative>[] = [
    { key: 'title', header: 'Iniciativa', sortValue: (i) => i.title, render: (i) => <span className="font-semibold">{i.title}</span> },
    { key: 'neighborhood', header: 'Barrio/Vereda', sortValue: (i) => i.neighborhood, render: (i) => <span>{i.neighborhood}</span> },
    { key: 'thematicArea', header: 'Eje', sortValue: (i) => i.thematicArea, render: (i) => <span>{i.thematicArea}</span> },
    { key: 'supportCount', header: 'Apoyos', sortValue: (i) => i.supportCount, render: (i) => <span className="font-mono-tabular">{i.supportCount}</span> },
    { key: 'status', header: 'Estado', sortValue: (i) => i.status, render: (i) => <StatusText label={i.status.replace('_', ' ')} tone="info" /> },
  ];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Sin iniciativas juveniles radicadas"
        description="Las propuestas ciudadanas del Banco de Iniciativas aparecerán aquí para priorización."
      />
    );
  }

  const pendingReviewCount = items.filter((i) => i.status === 'recibida' || i.status === 'en_evaluacion').length;
  const approvedCount = items.filter((i) => i.status === 'aprobada' || i.status === 'en_comision').length;
  const totalSupports = items.reduce((sum, i) => sum + (i.supportCount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card padding="sm">
          <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">Pendientes de revisión</p>
          <p className="mt-1 font-display text-2xl font-semibold font-mono-tabular text-[#7B1832] dark:text-[#D9B245]">
            {pendingReviewCount}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">En comisión o aprobadas</p>
          <p className="mt-1 font-display text-2xl font-semibold font-mono-tabular text-stone-950 dark:text-white">
            {approvedCount}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">Respaldos ciudadanos acumulados</p>
          <p className="mt-1 font-display text-2xl font-semibold font-mono-tabular text-[#1E3A8A] dark:text-[#60A5FA]">
            {totalSupports}
          </p>
        </Card>
      </div>

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Banco de Iniciativas Ciudadanas ({filtered.length})
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Buscar iniciativa" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, barrio o eje..." />
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="recibida">Recibida</option>
            <option value="en_evaluacion">En evaluación</option>
            <option value="en_comision">En comisión</option>
            <option value="aprobada">Aprobada</option>
            <option value="archivada">Archivada</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Sin iniciativas que coincidan" description="Prueba ajustando los filtros." />
      ) : viewMode === 'table' ? (
        <Card><DataTable rows={filtered} columns={columns} rowKey={(i) => i.id} exportFileName="cmj-flandes-iniciativas" exportTitle="Banco de Iniciativas — CMJ Flandes" /></Card>
      ) : (
        filtered.map((item) => (
          <Card key={item.id} padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
              <span>{item.thematicArea} · {item.neighborhood} · {item.supportCount} apoyos</span>
              <StatusText label={item.status.replace('_', ' ')} tone="info" />
            </div>
            <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{item.title}</h3>
            <p className="mt-1 text-xs text-stone-600 dark:text-slate-300">{item.summary}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Respuesta oficial (opcional)" value={responses[item.id] ?? item.boardResponse ?? ''} onChange={(e) => setResponses((p) => ({ ...p, [item.id]: e.target.value }))} />
              <Select label="Asignar a comisión" value={commMap[item.id] ?? item.assignedCommissionId ?? ''} onChange={(e) => setCommMap((p) => ({ ...p, [item.id]: e.target.value }))}>
                <option value="">Sin asignar</option>
                {commissions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['en_evaluacion', 'en_comision', 'aprobada', 'archivada'] as InitiativeStatus[]).map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant={next === 'aprobada' ? 'primary' : next === 'archivada' ? 'danger' : 'outline'}
                  onClick={() => (next === 'archivada' ? setArchiveTarget(item) : void applyStatus(item, next))}
                >
                  {next.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </Card>
        ))
      )}

      <Dialog
        open={Boolean(archiveTarget)}
        destructive
        loading={archiving}
        title="¿Archivar iniciativa ciudadana?"
        description={`La iniciativa "${archiveTarget?.title || ''}" pasará a estado archivado.`}
        confirmLabel="Sí, archivar"
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
