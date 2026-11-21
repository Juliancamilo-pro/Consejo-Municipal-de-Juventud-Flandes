import { FormEvent, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { updateCommissionGoals } from '../../services/commissionsService';
import { Commission, CommissionGoal, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';

interface CommissionGoalsTabProps {
  actor: UserProfile;
  commission: Commission;
  canManage: boolean;
  onReload: () => Promise<void>;
}

export function CommissionGoalsTab({
  actor,
  commission,
  canManage,
  onReload,
}: CommissionGoalsTabProps) {
  const [title, setTitle] = useState('');
  const [indicator, setIndicator] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [currentValue, setCurrentValue] = useState('0');
  const [busy, setBusy] = useState(false);

  const goals = commission.goals || [];

  const handleAddGoal = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next: CommissionGoal[] = [
        ...goals,
        {
          id: crypto.randomUUID(),
          title: title.trim(),
          indicator: indicator.trim(),
          targetValue: targetValue.trim(),
          currentValue: currentValue.trim() || '0',
          progressPercent: 0,
          status: 'pendiente',
        },
      ];
      await updateCommissionGoals(actor, commission, next);
      setTitle('');
      setIndicator('');
      setTargetValue('');
      setCurrentValue('0');
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateProgress = async (goalId: string, progress: number) => {
    setBusy(true);
    try {
      const clamped = Math.min(100, Math.max(0, progress));
      const status: CommissionGoal['status'] =
        clamped >= 100 ? 'cumplida' : clamped > 0 ? 'en_progreso' : 'pendiente';
      const next = goals.map((g) =>
        g.id === goalId ? { ...g, progressPercent: clamped, status } : g,
      );
      await updateCommissionGoals(actor, commission, next);
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    setBusy(true);
    try {
      const next = goals.filter((g) => g.id !== goalId);
      await updateCommissionGoals(actor, commission, next);
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Agregar meta al plan de trabajo
          </h3>
          <form onSubmit={handleAddGoal} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Meta estratégica"
              required
              minLength={3}
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Realizar 4 mesas juveniles en barrios"
            />
            <Input
              label="Indicador medible"
              required
              minLength={3}
              maxLength={160}
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              placeholder="Ej. Número de encuentros ejecutados"
            />
            <Input
              label="Meta esperada"
              required
              maxLength={60}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Ej. 4 encuentros"
            />
            <Input
              label="Avance actual"
              maxLength={60}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="Ej. 1 encuentro"
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={busy}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Guardar meta</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {goals.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Sin metas registradas"
          description="El plan de trabajo de esta comisión iniciará al registrar su primera meta medible."
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <Card key={goal.id} padding="sm" className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-display text-base font-semibold text-stone-950 dark:text-white">
                    {goal.title}
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Indicador: {goal.indicator} · Meta: {goal.targetValue} (Actual: {goal.currentValue})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-sm font-semibold text-[#7B1832] dark:text-[#D9B245]">
                    {goal.progressPercent}%
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeleteGoal(goal.id)}
                      aria-label={`Eliminar meta ${goal.title}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:text-slate-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#7B1832] transition-all dark:bg-[#D9B245]"
                  style={{ width: `${goal.progressPercent}%` }}
                />
              </div>
              {canManage && (
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  aria-label={`Avance de ${goal.title}`}
                  value={goal.progressPercent}
                  disabled={busy}
                  onChange={(e) => void handleUpdateProgress(goal.id, Number(e.target.value))}
                  className="w-full accent-[#7B1832]"
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
