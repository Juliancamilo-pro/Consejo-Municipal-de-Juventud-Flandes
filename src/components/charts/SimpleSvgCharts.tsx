interface BarDatum {
  label: string;
  value: number;
  max?: number;
  color?: string;
  hint?: string;
}

export function HorizontalBarChart({
  data,
  emptyLabel = 'Sin datos registrados aún.',
}: {
  data: BarDatum[];
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-xs text-stone-500 dark:text-slate-400">{emptyLabel}</p>;
  }

  const maxOverall = Math.max(...data.map((d) => d.max ?? d.value), 1);

  return (
    <div className="space-y-3" role="list">
      {data.map((item) => {
        const cap = item.max ?? maxOverall;
        const pct = Math.max(0, Math.min(100, Math.round((item.value / Math.max(cap, 1)) * 100)));
        const fill = item.color || '#7B1832';
        return (
          <div key={item.label} role="listitem" className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-stone-800 dark:text-slate-200">
                {item.label}
              </span>
              <span className="font-mono-tabular shrink-0 font-semibold text-stone-600 dark:text-slate-300">
                {item.hint ?? `${item.value}`}
              </span>
            </div>
            <svg
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              className="h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800"
              aria-label={`${item.label}: ${pct}%`}
            >
              <rect x="0" y="0" width={pct} height="6" rx="3" fill={fill} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutBreakdownChart({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string | number;
}) {
  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-stone-200 dark:text-slate-800"
          />
          {total > 0 &&
            slices.map((slice) => {
              const fraction = Math.max(0, slice.value) / total;
              const dash = fraction * circumference;
              const offset = -accumulated * circumference;
              accumulated += fraction;
              if (dash <= 0) return null;
              return (
                <circle
                  key={slice.label}
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="12"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-xl font-semibold tabular-nums text-stone-950 dark:text-white">
            {centerValue}
          </span>
          <span className="text-[10px] font-medium text-stone-500 uppercase dark:text-slate-400">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className="flex-1 space-y-1.5 text-xs">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-stone-700 dark:text-slate-300">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />
              <span>{slice.label}</span>
            </span>
            <span className="font-mono-tabular font-semibold text-stone-900 dark:text-white">
              {slice.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
