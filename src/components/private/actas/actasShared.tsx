import React, { useMemo } from 'react';
import type { ActaStatus } from '../../../types/cmj';

export const STATUS_STEPS: { id: ActaStatus; label: string; badgeCls: string }[] = [
  { id: 'borrador', label: 'Borrador', badgeCls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { id: 'revision', label: 'En revisión', badgeCls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: 'aprobada', label: 'Aprobada', badgeCls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { id: 'firmada', label: 'Firmada', badgeCls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-cyan-300' },
  { id: 'archivada', label: 'Archivada', badgeCls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
];

export const ACTA_TEMPLATES: {
  id: string;
  label: string;
  titlePrefix: string;
  agenda: string;
  developmentIntro: string;
}[] = [
  {
    id: 'plenaria_ordinaria',
    label: 'Plenaria Ordinaria',
    titlePrefix: 'Sesión Plenaria Ordinaria CMJ Flandes',
    agenda:
      '1. Llamado a lista y verificación de quórum.\n2. Lectura y aprobación del orden del día.\n3. Lectura y aprobación del acta anterior.\n4. Informes de comisiones permanentes.\n5. Proposiciones, votaciones y varios.\n6. Cierre de la sesión.',
    developmentIntro:
      'En el municipio de Flandes, Tolima, siendo la hora señalada, se reunieron los consejeros y consejeras municipales de juventud en sesión plenaria ordinaria conforme a la Ley Estatutaria 1622 de 2013 y la Ley 1885 de 2018.',
  },
  {
    id: 'extraordinaria',
    label: 'Sesión Extraordinaria',
    titlePrefix: 'Sesión Plenaria Extraordinaria CMJ Flandes',
    agenda:
      '1. Verificación de quórum.\n2. Lectura del decreto o convocatoria extraordinaria.\n3. Punto único de deliberación y votación.\n4. Asignación de compromisos y cierre.',
    developmentIntro:
      'Previa convocatoria formal de la Mesa Directiva del Consejo Municipal de Juventudes de Flandes, Tolima, se instaló sesión extraordinaria para atender los asuntos urgentes del orden del día.',
  },
  {
    id: 'comision',
    label: 'Sesión de Comisión',
    titlePrefix: 'Mesa de Trabajo de Comisión CMJ',
    agenda:
      '1. Verificación de integrantes de la comisión.\n2. Seguimiento al plan de trabajo y tareas asignadas.\n3. Formulación de propuestas e iniciativas territoriales.\n4. Compromisos y fecha de próxima mesa.',
    developmentIntro:
      'Los integrantes de la comisión permanente del CMJ Flandes se reunieron con el propósito de avanzar en las metas estratégicas de su eje temático juvenil.',
  },
];

export function ActaQrSvg({ code }: { code: string }) {
  const cells = useMemo(() => {
    const size = 11;
    const grid: boolean[] = [];
    let seed = 13;
    for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i) * (i + 5);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const corner =
          (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
        const val = corner || ((seed + r * 19 + c * 29 + r * c) % 3 !== 0);
        grid.push(val);
      }
    }
    return grid;
  }, [code]);

  return (
    <svg
      viewBox="0 0 110 110"
      className="h-20 w-20 rounded-xl bg-white p-1.5 border border-slate-300 shrink-0"
      aria-label={`Sello QR de verificación ${code}`}
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
            rx="1.2"
            fill="#0f172a"
          />
        );
      })}
    </svg>
  );
}
