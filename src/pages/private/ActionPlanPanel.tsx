import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckSquare, LayoutGrid, List, Plus, Trash2 } from 'lucide-react';
import {
  ACTION_PLAN_AXES,
  deleteActionPlanItem,
  fetchAnnualActionPlan,
  saveActionPlanItem,
} from '../../services/actionPlanService';
import { ActionPlanAxis, AnnualActionPlanItem, Commission, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

interface ActionPlanPanelProps {
  actor: UserProfile;
  isBoard: boolean;
  commissions: Commission[];
}

export function ActionPlanPanel({ actor, isBoard, commissions }: ActionPlanPanelProps) {
  const { showToast } = useToast();
  const [items, setItems] = useState<AnnualActionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [axis, setAxis] = useState<ActionPlanAxis>(ACTION_PLAN_AXES[0]);
  const [title, setTitle] = useState('');
  const [commissionId, setCommissionId] = useState('');
  const [indicator, setIndicator] = useState('');
  const [targetValue, setTargetValue] = useState(4);
  const [goalDescription, setGoalDescription] = useState('');
  const [responsibleName, setResponsibleName] = useState(actor.displayName);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [deleteTarget, setDeleteTarget] = useState<AnnualActionPlanItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      setItems(await fetchAnnualActionPlan());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (yearFilter && String(item.year) !== yearFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.axis.toLowerCase().includes(q) ||
        item.responsibleName.toLowerCase().includes(q)
      );
    });
  }, [items, search, yearFilter, statusFilter]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveActionPlanItem(actor, {
        year,
        axis,
        title,
        commissionId: commissionId || undefined,
        goalDescription,
        indicator,
        targetValue,
        executedValue: 0,
        status: 'pendiente',
        responsibleName,
      });
      setTitle('');
      setIndicator('');
      setGoalDescription('');
      showToast('Meta del Plan de Acción Anual registrada.', 'success');
      await loadItems();
    } finally {
      setSaving(false);
    }
  };

  const handleIncrement = async (item: AnnualActionPlanItem) => {
    const nextExecuted = Math.min(item.targetValue, item.executedValue + 1);
    const nextStatus =
      nextExecuted >= item.targetValue ? 'cumplido' : nextExecuted > 0 ? 'en_curso' : 'pendiente';
    await saveActionPlanItem(actor, { ...item, executedValue: nextExecuted, status: nextStatus });
    await loadItems();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteActionPlanItem(actor, deleteTarget.id);
      showToast('Meta eliminada del Plan Anual.', 'info');
      setDeleteTarget(null);
      await loadItems();
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<AnnualActionPlanItem>[] = [
    { key: 'year', header: 'Año', sortValue: (i) => i.year, render: (i) => <span className="font-mono-tabular font-semibold">{i.year}</span> },
    { key: 'axis', header: 'Eje', sortValue: (i) => i.axis, render: (i) => <span>{i.axis}</span> },
    { key: 'title', header: 'Meta estratégica', sortValue: (i) => i.title, render: (i) => <span className="font-semibold">{i.title}</span> },
    { key: 'progress', header: 'Ejecución', sortValue: (i) => i.executedValue, render: (i) => <span className="font-mono-tabular">{i.executedValue} / {i.targetValue}</span> },
    { key: 'status', header: 'Estado', sortValue: (i) => i.status, render: (i) => <StatusText label={i.status.replace('_', ' ')} tone={i.status === 'cumplido' ? 'success' : 'info'} /> },
  ];

  return (
    <div className="space-y-6">
      {isBoard && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Plan de Acción Anual · Registrar meta
          </h2>
          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Año" type="number" min={2026} max={2029} required value={year} onChange={(e) => setYear(Number(e.target.value))} />
              <Select label="Eje estratégico" value={axis} onChange={(e) => setAxis(e.target.value as ActionPlanAxis)}>
                {ACTION_PLAN_AXES.map((ax) => <option key={ax} value={ax}>{ax}</option>)}
              </Select>
              <Select label="Comisión responsable" value={commissionId} onChange={(e) => setCommissionId(e.target.value)}>
                <option value="">General del Pleno</option>
                {commissions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Responsable" required value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Input label="Meta / acción estratégica" required minLength={4} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} className="sm:col-span-2" />
              <Input label="Indicador medible" required value={indicator} onChange={(e) => setIndicator(e.target.value)} placeholder="Ej. Mesas realizadas" />
              <Input label="Meta numérica" type="number" min={1} max={1000} required value={targetValue} onChange={(e) => setTargetValue(Number(e.target.value))} />
            </div>
            <Textarea label="Descripción operativa" required minLength={5} rows={2} value={goalDescription} onChange={(e) => setGoalDescription(e.target.value)} />
            <Button type="submit" loading={saving}><Plus className="h-4 w-4" aria-hidden="true" /><span>Agregar meta al Plan Anual</span></Button>
          </form>
        </Card>
      )}

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Metas del Plan de Acción ({filtered.length})
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
          <Input label="Buscar meta" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, eje o responsable..." />
          <Select label="Año" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">Todos los años</option>
            {[2026, 2027, 2028, 2029].map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </Select>
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="cumplido">Cumplido</option>
          </Select>
        </div>
      </Card>

      {!loading && filtered.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Aún no hay metas que coincidan" description="Ajusta los filtros o registra metas anuales con su indicador cuantitativo." />
      ) : viewMode === 'table' ? (
        <Card><DataTable rows={filtered} columns={columns} rowKey={(i) => i.id} exportFileName="cmj-flandes-plan-accion" exportTitle="Plan de Acción Anual — CMJ Flandes" /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const pct = Math.min(100, Math.round((item.executedValue / Math.max(1, item.targetValue)) * 100));
            return (
              <Card key={item.id} padding="sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span className="font-mono-tabular font-semibold text-[#7B1832] dark:text-[#D9B245]">{item.year}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.axis}</span>
                      <StatusText label={item.status.replace('_', ' ')} tone={item.status === 'cumplido' ? 'success' : 'info'} />
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-stone-600 dark:text-slate-300">
                      {item.indicator}: <span className="font-mono-tabular font-semibold">{item.executedValue} / {item.targetValue}</span> ({pct}%) · {item.responsibleName}
                    </p>
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct >= 100
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : 'bg-[#7B1832] dark:bg-[#C59B27]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  {isBoard && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => void handleIncrement(item)}>+1 ejecución</Button>
                      <button
                        type="button"
                        aria-label={`Eliminar ${item.title}`}
                        onClick={() => setDeleteTarget(item)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-red-50 hover:text-red-700 dark:border-slate-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        destructive
        loading={deleting}
        title="¿Eliminar meta del Plan Anual?"
        description={`Se eliminará "${deleteTarget?.title || ''}" de forma permanente.`}
        confirmLabel="Sí, eliminar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
