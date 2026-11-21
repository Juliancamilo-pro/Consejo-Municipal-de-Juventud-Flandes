import { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { fetchAnnualActionPlan } from '../../services/actionPlanService';
import { AnnualActionPlanItem } from '../../types/models';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Input';
import { SkeletonBlock } from '../../components/ui/MotionPrimitives';
import { StatusText } from '../../components/ui/StatusText';

export function ActionPlanPublicPanel() {
  const [items, setItems] = useState<AnnualActionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('');

  useEffect(() => {
    fetchAnnualActionPlan()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(
    () => Array.from(new Set(items.map((i) => i.year))).sort((a, b) => b - a),
    [items],
  );

  const visible = useMemo(
    () => (yearFilter ? items.filter((i) => String(i.year) === yearFilter) : items),
    [items, yearFilter],
  );

  if (loading) return <SkeletonBlock className="h-44 w-full rounded-xl" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Aún no se ha publicado el Plan de Acción Anual"
        description="Las metas anuales por eje estratégico aparecerán aquí con su ejecución en tiempo real en cuanto sean aprobadas."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-stone-600 dark:text-slate-300">
          Seguimiento público a las metas anuales aprobadas por el Consejo Municipal de Juventud.
        </p>
        <div className="w-44">
          <Select label="Filtrar por vigencia" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="">Todas ({items.length})</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                Vigencia {y}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visible.map((item) => {
          const pct = Math.min(
            100,
            Math.round((item.executedValue / Math.max(1, item.targetValue)) * 100),
          );
          return (
            <Card key={item.id}>
              <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                <span>
                  {item.year} · {item.axis}
                </span>
                <StatusText
                  label={item.status === 'cumplido' ? 'Cumplida' : item.status === 'en_curso' ? 'En curso' : 'Pendiente'}
                  tone={item.status === 'cumplido' ? 'success' : 'info'}
                />
              </div>
              <h3 className="mt-2 font-display text-lg font-semibold text-stone-950 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-300">
                {item.goalDescription}
              </p>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-600 dark:text-slate-400">{item.indicator}</span>
                  <span className="font-mono-tabular font-semibold text-[#7B1832] dark:text-[#D9B245]">
                    {item.executedValue} / {item.targetValue} ({pct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                  <div
                    className="h-full bg-[#7B1832] dark:bg-[#D9B245]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
