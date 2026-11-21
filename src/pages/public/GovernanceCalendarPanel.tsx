import { Calendar, Download, ExternalLink } from 'lucide-react';
import { CalendarEventItem } from '../../types/models';
import { buildGoogleCalendarUrl, downloadEventIcs } from '../../utils/icsExport';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

export function GovernanceCalendarPanel({ events }: { events: CalendarEventItem[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Aún no hay eventos en el calendario público"
        description="Cuando existan actividades programadas podrás agregarlas a Google Calendar o descargarlas en formato .ics."
      />
    );
  }

  return (
    <div className="space-y-4">
      {events.map((ev) => (
        <Card key={ev.id} variant="interactive">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                <span className="font-mono-tabular">
                  {new Date(ev.startIso).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                <span aria-hidden="true">·</span>
                <span>{ev.location}</span>
              </div>
              <h2 className="mt-1.5 font-display text-lg font-semibold text-stone-950 dark:text-white">
                {ev.title}
              </h2>
              {ev.description && (
                <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">{ev.description}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={buildGoogleCalendarUrl(ev)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
                <span>Google Calendar</span>
              </a>
              <Button variant="outline" size="sm" onClick={() => downloadEventIcs(ev)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>.ics</span>
              </Button>
              <WhatsAppShareButton text={`Evento CMJ Flandes: ${ev.title} (${ev.location})`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
