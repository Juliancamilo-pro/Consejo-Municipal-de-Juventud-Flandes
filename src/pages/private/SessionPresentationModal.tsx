import { useEffect, useState } from 'react';
import { Maximize2, Pause, Play, RotateCcw, Users, Vote, X } from 'lucide-react';
import { AttendanceRecord, ElectionItem, PlenarySession } from '../../types/models';
import { Button } from '../../components/ui/Button';

interface SessionPresentationModalProps {
  session: PlenarySession | null;
  attendance: AttendanceRecord[];
  activeCounselorsCount: number;
  elections?: ElectionItem[];
  onClose: () => void;
}

export function SessionPresentationModal({
  session,
  attendance,
  activeCounselorsCount,
  elections = [],
  onClose,
}: SessionPresentationModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    setSecondsLeft(180);
    setRunning(false);
  }, [session?.id]);

  if (!session) return null;

  const sessionAtt = attendance.filter((a) => a.sessionId === session.id);
  const presentCount = sessionAtt.filter((a) => a.status === 'presente').length;
  const totalBase = Math.max(activeCounselorsCount, sessionAtt.length, 1);
  const quorumPct = Math.round((presentCount / totalBase) * 100);
  const openElections = elections.filter((e) => e.status === 'abierta');
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Modo presentación: ${session.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
    >
      <div className="cmj-tricolor-rule h-1.5" />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#D9B245] uppercase">
            Modo Presentación · CMJ Flandes, Tolima · {session.sessionType}
          </p>
          <h2 className="font-display text-2xl font-bold">{session.title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm">
            {session.dateIso} · {session.location}
          </span>
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
            <span>Salir</span>
          </Button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 lg:col-span-7">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D9B245] uppercase">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
            <span>Orden del día en proyección</span>
          </div>
          <div className="mt-4 space-y-2 text-lg leading-relaxed whitespace-pre-line text-slate-100">
            {session.agenda || 'Sin orden del día redactado.'}
          </div>
        </section>

        <aside className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D9B245] uppercase">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Quórum en tiempo real</span>
            </div>
            <p className="mt-3 font-display text-4xl font-bold tabular-nums text-white">
              {presentCount} / {totalBase}{' '}
              <span className="text-lg font-medium text-emerald-400">({quorumPct}%)</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {presentCount >= Math.ceil(totalBase / 2)
                ? 'Quórum deliberatorio y decisorio alcanzado.'
                : 'Aún no se alcanza la mitad más uno.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-xs font-semibold tracking-wider text-[#60A5FA] uppercase">
              Cronómetro de intervenciones
            </p>
            <p className="mt-2 font-mono-tabular text-5xl font-bold text-white">
              {mins}:{secs}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setRunning((r) => !r)}>
                {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{running ? 'Pausar' : 'Iniciar'}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(180);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>3 min</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(300);
                }}
              >
                5 min
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#D9B245] uppercase">
              <Vote className="h-4 w-4" aria-hidden="true" />
              <span>Votaciones en curso ({openElections.length})</span>
            </div>
            {openElections.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">
                No hay votaciones abiertas en este momento.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {openElections.map((el) => (
                  <li key={el.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                    <p className="font-semibold text-white">{el.title}</p>
                    <p className="text-xs text-slate-400">{el.options.length} opciones activas</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
