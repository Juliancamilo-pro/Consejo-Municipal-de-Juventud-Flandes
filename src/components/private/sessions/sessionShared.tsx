import React, { useMemo } from 'react';
import type { AttendanceStatus } from '../../../types/cmj';

export function generateSessionCode(): string {
  return `CMJ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function DeterministicQrSvg({ code }: { code: string }) {
  const cells = useMemo(() => {
    const size = 11;
    const grid: boolean[] = [];
    let seed = 0;
    for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i) * (i + 7);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const corner =
          (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
        const val = corner || ((seed + r * 17 + c * 31 + r * c) % 3 !== 0);
        grid.push(val);
      }
    }
    return grid;
  }, [code]);

  return (
    <svg
      viewBox="0 0 110 110"
      className="h-24 w-24 rounded-xl bg-white p-2 border border-slate-200 shrink-0"
      aria-label={`Código QR visual ${code}`}
    >
      {cells.map((filled, idx) => {
        if (!filled) return null;
        const r = Math.floor(idx / 11);
        const c = idx % 11;
        return (
          <rect
            key={idx}
            x={c * 10 + 1}
            y={r * 10 + 1}
            width="8"
            height="8"
            rx="1.5"
            fill="#0f172a"
          />
        );
      })}
    </svg>
  );
}

export const ATT_LABELS: Record<
  AttendanceStatus,
  { label: string; short: string; cls: string; cellCls: string }
> = {
  presente: {
    label: 'Presente',
    short: 'P',
    cls: 'bg-emerald-700 text-white border-emerald-700 shadow-sm',
    cellCls: 'bg-emerald-600 text-white',
  },
  tarde: {
    label: 'Tarde',
    short: 'T',
    cls: 'bg-amber-500 text-white border-amber-500 shadow-sm',
    cellCls: 'bg-amber-400 text-slate-950',
  },
  excusa: {
    label: 'Excusa',
    short: 'E',
    cls: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    cellCls: 'bg-blue-500 text-white',
  },
  ausente: {
    label: 'Ausente',
    short: 'A',
    cls: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    cellCls: 'bg-rose-500 text-white',
  },
};
