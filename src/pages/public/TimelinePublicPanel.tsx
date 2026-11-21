import { useMemo } from 'react';
import { Calendar, Clock, FolderKanban, Newspaper, Users } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';

interface TimelineMilestone {
  id: string;
  dateLabel: string;
  sortKey: string;
  kind: 'sesion' | 'proyecto' | 'evento' | 'noticia';
  title: string;
  detail: string;
}

const KIND_LABELS: Record<TimelineMilestone['kind'], string> = {
  sesion: 'Sesión plenaria',
  proyecto: 'Proyecto juvenil',
  evento: 'Agenda pública',
  noticia: 'Publicación oficial',
};

function toDateSortKey(raw: unknown, fallback = '2026-01-01'): string {
  if (typeof raw === 'string' && raw.length >= 8) return raw.slice(0, 10);
  if (
    raw &&
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate: () => Date }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return fallback;
}

export function TimelinePublicPanel({ portal }: { portal: PublicPortalState }) {
  const milestones = useMemo<TimelineMilestone[]>(() => {
    const list: TimelineMilestone[] = [];
    portal.sessions.forEach((s) => {
      const dateKey = toDateSortKey(s.dateIso);
      list.push({
        id: `ses-${s.id}`,
        dateLabel: dateKey,
        sortKey: dateKey,
        kind: 'sesion',
        title: s.title,
        detail: `${s.location} · Estado: ${s.status}`,
      });
    });
    portal.projects.forEach((p) => {
      const dateKey = toDateSortKey(p.createdAt);
      list.push({
        id: `pro-${p.id}`,
        dateLabel: dateKey,
        sortKey: dateKey,
        kind: 'proyecto',
        title: p.title,
        detail: `${p.progressPercent}% avance · ${p.summary}`,
      });
    });
    portal.events.forEach((e) => {
      const dateKey = toDateSortKey(e.startIso);
      list.push({
        id: `eve-${e.id}`,
        dateLabel: dateKey,
        sortKey: dateKey,
        kind: 'evento',
        title: e.title,
        detail: e.location,
      });
    });
    portal.news.slice(0, 10).forEach((n) => {
      const dateKey = toDateSortKey(n.createdAt);
      list.push({
        id: `new-${n.id}`,
        dateLabel: dateKey,
        sortKey: dateKey,
        kind: 'noticia',
        title: n.title,
        detail: n.summary,
      });
    });
    return list.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [portal.sessions, portal.projects, portal.events, portal.news]);

  if (milestones.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Línea de tiempo 2026–2029 en construcción"
        description="A medida que se registren sesiones, proyectos y eventos públicos, la cronología oficial del periodo se actualizará automáticamente."
      />
    );
  }

  return (
    <div className="relative space-y-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5 before:bg-stone-200 dark:before:bg-slate-800">
      {milestones.map((m) => {
        const Icon =
          m.kind === 'sesion'
            ? Users
            : m.kind === 'proyecto'
              ? FolderKanban
              : m.kind === 'evento'
                ? Calendar
                : Newspaper;
        return (
          <div key={m.id} className="relative">
            <span className="absolute top-4 -left-6 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#7B1832] bg-white dark:border-[#D9B245] dark:bg-slate-950" />
            <Card padding="sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                <Icon className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                <span className="font-mono-tabular font-semibold">{m.dateLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{KIND_LABELS[m.kind]}</span>
              </div>
              <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">
                {m.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
                {m.detail}
              </p>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
