import React from 'react';
import type { MajorityType, VoteMode, VoteStatus } from '../../../types/cmj';

export const VOTE_COLORS = ['#047857', '#2563EB', '#F59E0B', '#E11D48', '#7C3AED', '#0D9488'];

export const VOTE_STATUS_META: Record<
  VoteStatus,
  { label: string; badgeClass: string }
> = {
  abierta: {
    label: 'Abierta',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  cerrada: {
    label: 'Cerrada',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  empate: {
    label: 'Empate',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  sin_resultado: {
    label: 'Sin resultado',
    badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  },
};

export const MAJORITY_LABELS: Record<MajorityType, string> = {
  simple: 'Mayoría simple',
  absoluta: 'Mayoría absoluta (50% + 1)',
  dos_tercios: 'Mayoría calificada (2/3)',
  unanimidad: 'Unanimidad (100%)',
};

export const MODE_LABELS: Record<VoteMode, string> = {
  nominal: 'Nominal (voto público)',
  secreto: 'Secreta (anónima)',
  mano_alzada: 'Mano alzada (plenario)',
};

export function VoteDonutChart({
  options,
  tallies,
}: {
  options: string[];
  tallies?: Record<string, number>;
}) {
  const total = options.reduce((acc, opt) => acc + (tallies?.[opt] || 0), 0);
  if (total === 0) {
    return (
      <div className="h-24 w-24 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
        0 votos
      </div>
    );
  }

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg
      viewBox="0 0 90 90"
      className="h-24 w-24 shrink-0 -rotate-90"
      aria-label="Distribución de votos"
    >
      {options.map((opt, idx) => {
        const count = tallies?.[opt] || 0;
        const frac = count / total;
        const dash = frac * circumference;
        const currentOffset = offset;
        offset += dash;
        if (count === 0) return null;
        return (
          <circle
            key={opt}
            cx="45"
            cy="45"
            r={radius}
            fill="transparent"
            stroke={VOTE_COLORS[idx % VOTE_COLORS.length]}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-currentOffset}
          />
        );
      })}
      <text
        x="45"
        y="48"
        textAnchor="middle"
        className="rotate-90 origin-center fill-slate-800 dark:fill-white text-[14px] font-extrabold font-mono-num"
      >
        {total}
      </text>
    </svg>
  );
}
