import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import {
  CompletenessCheckItem,
  ProfileCompletenessResult,
  ProfileEditorTabId,
} from '../../utils/profileCompleteness';
import { Button } from '../../components/ui/Button';

interface ProfileChecklistBannerProps {
  completeness: ProfileCompletenessResult;
  onJumpToField: (tab: ProfileEditorTabId, fieldId: string) => void;
}

export function ProfileChecklistBanner({
  completeness,
  onJumpToField,
}: ProfileChecklistBannerProps) {
  const { percent, completedCount, totalCount, items, firstMissing } = completeness;

  const handleItemClick = (item: CompletenessCheckItem) => {
    onJumpToField(item.targetTab, item.targetFieldId);
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold tracking-wider text-stone-700 uppercase dark:text-slate-300">
              Completitud de ficha pública
            </p>
            <span className="font-display text-sm font-bold tabular-nums text-[#7B1832] dark:text-[#E5C158]">
              {percent}%
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
            {completedCount} de {totalCount} requisitos completados para presentar una ficha sólida al municipio.
          </p>
        </div>

        {firstMissing && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => handleItemClick(firstMissing)}
          >
            <span>Completar lo que falta</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-[4px] bg-stone-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso de perfil: ${percent}%`}
      >
        <div
          className="h-full bg-[#7B1832] transition-[width] duration-300 dark:bg-[#C59B27]"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => handleItemClick(item)}
              className={`flex w-full items-center gap-1.5 rounded-[4px] px-2 py-1 text-left transition-colors ${
                item.done
                  ? 'text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30'
                  : 'text-stone-600 hover:bg-stone-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-slate-500" aria-hidden="true" />
              )}
              <span className="truncate">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
