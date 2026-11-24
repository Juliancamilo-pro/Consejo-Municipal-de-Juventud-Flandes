import React, { useMemo, useState } from 'react';
import { BellRing, Calendar, CalendarDays, List } from 'lucide-react';
import type { Commitment, CouncilSession, NewsEvent } from '../../types/cmj';

interface AgendaEntry {
  id: string;
  dateIso: string;
  title: string;
  kind: string;
  sub: string;
  tone: 'blue' | 'emerald' | 'amber';
}

export function AgendaCalendarModule({
  sessions,
  newsEvents,
  commitments = [],
}: {
  sessions: CouncilSession[];
  newsEvents: NewsEvent[];
  commitments?: Commitment[];
}) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const [yearMonth, setYearMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );

  const items = useMemo<AgendaEntry[]>(() => {
    const combined: AgendaEntry[] = [];
    sessions.forEach((s) =>
      combined.push({
        id: `s-${s.id}`,
        dateIso: s.dateIso,
        title: s.title,
        kind: `Sesión ${s.sessionType}`,
        sub: `${s.timeRange || ''} · ${s.location}`,
        tone: 'blue',
      })
    );
    newsEvents
      .filter((n) => n.type === 'evento' && n.eventDate)
      .forEach((n) =>
        combined.push({
          id: `e-${n.id}`,
          dateIso: n.eventDate || '',
          title: n.title,
          kind: 'Evento Público',
          sub: n.location || 'Flandes',
          tone: 'emerald',
        })
      );
    commitments
      .filter((c) => c.dueDate && c.status !== 'cumplido')
      .forEach((c) =>
        combined.push({
          id: `c-${c.id}`,
          dateIso: c.dueDate || '',
          title: `Vence: ${c.title}`,
          kind: 'Compromiso',
          sub: `Responsable: ${c.responsibleName}`,
          tone: 'amber',
        })
      );
    return combined.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  }, [sessions, newsEvents, commitments]);

  const upcoming7Days = useMemo(() => {
    const limitDate = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    return items.filter((it) => it.dateIso >= todayIso && it.dateIso <= limitDate);
  }, [items, today, todayIso]);

  const weekDays = useMemo(() => {
    const dayOfWeek = (today.getDay() + 6) % 7; // Lunes = 0
    const monday = new Date(today.getTime() - dayOfWeek * 86400000);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday.getTime() + i * 86400000);
      return {
        iso: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }),
      };
    });
  }, [today]);

  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7;

  const badgeTone = (tone: AgendaEntry['tone']) => {
    if (tone === 'emerald') return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
    if (tone === 'amber') return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300';
    return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300';
  };

  return (
    <div className="space-y-4">
      {upcoming7Days.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
            <BellRing className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Próximos 7 días: tienes {upcoming7Days.length} actividad
              {upcoming7Days.length === 1 ? '' : 'es'} en agenda ({upcoming7Days[0].title}).
            </span>
          </div>
          <span className="font-mono-num text-[11px] font-bold text-amber-700 dark:text-amber-300">
            {upcoming7Days[0].dateIso}
          </span>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" /> Agenda y Cronograma CMJ
            </h2>
            <p className="text-xs text-slate-500">
              Sesiones programadas, eventos territoriales y vencimientos de compromisos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'month' && (
              <input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
            )}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold cursor-pointer ${
                  viewMode === 'month' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''
                }`}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                  viewMode === 'week' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Semana
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                  viewMode === 'list' ? 'bg-white dark:bg-slate-900 shadow-sm' : ''
                }`}
              >
                <List className="h-3.5 w-3.5" /> Lista
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'month' ? (
          <div className="grid grid-cols-7 gap-1.5 text-xs">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="p-2 text-center font-bold text-slate-500">
                {d}
              </div>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[76px] rounded-xl bg-slate-50/40 dark:bg-slate-950/30" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${yearMonth}-${String(dayNum).padStart(2, '0')}`;
              const dayItems = items.filter((it) => it.dateIso === dateStr);
              const isToday = dateStr === todayIso;
              return (
                <div
                  key={dayNum}
                  className={`min-h-[84px] rounded-xl border p-1.5 space-y-1 ${
                    isToday
                      ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
                      : 'border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <span
                    className={`font-mono-num text-[11px] font-bold ${
                      isToday ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-500'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayItems.map((it) => (
                    <div
                      key={it.id}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold truncate ${badgeTone(it.tone)}`}
                      title={`${it.kind}: ${it.title} (${it.sub})`}
                    >
                      {it.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : viewMode === 'week' ? (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5 text-xs">
            {weekDays.map((day) => {
              const dayItems = items.filter((it) => it.dateIso === day.iso);
              const isToday = day.iso === todayIso;
              return (
                <div
                  key={day.iso}
                  className={`rounded-2xl border p-3 min-h-[140px] space-y-2 ${
                    isToday
                      ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-300 capitalize">
                    {day.label}
                  </p>
                  {dayItems.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Sin agenda</p>
                  ) : (
                    dayItems.map((it) => (
                      <div key={it.id} className={`rounded-xl p-2 space-y-0.5 ${badgeTone(it.tone)}`}>
                        <p className="text-[10px] font-bold uppercase">{it.kind}</p>
                        <p className="text-xs font-bold leading-snug">{it.title}</p>
                        <p className="text-[10px] opacity-80">{it.sub}</p>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">No hay actividades programadas.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((it) => (
              <div key={it.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400">
                    {it.kind} · <span className="font-mono-num">{it.dateIso}</span>
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{it.title}</p>
                  <p className="text-xs text-slate-500">{it.sub}</p>
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${badgeTone(it.tone)}`}>
                  {it.kind}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default AgendaCalendarModule;
