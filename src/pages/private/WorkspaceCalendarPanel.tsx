import { FormEvent, useState } from 'react';
import { Calendar, CalendarPlus, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { CalendarEventItem } from '../../types/models';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  GoogleCalendarEventSummary,
  listGoogleCalendarEvents,
  saveWorkspaceLinkToServer,
} from '../../services/workspaceApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Textarea } from '../../components/ui/Input';
import {
  PendingCalendarAction,
  WorkspaceCalendarSyncAndModal,
} from './WorkspaceCalendarSyncCard';

interface WorkspaceCalendarPanelProps {
  accessToken: string | null;
  cmjEvents: CalendarEventItem[];
  onRefreshLinks: () => Promise<void>;
}

export function WorkspaceCalendarPanel({
  accessToken,
  cmjEvents,
  onRefreshLinks,
}: WorkspaceCalendarPanelProps) {
  const [gEvents, setGEvents] = useState<GoogleCalendarEventSummary[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [summary, setSummary] = useState('');
  const [location, setLocation] = useState('Recinto CMJ, Flandes, Tolima');
  const [startIso, setStartIso] = useState('');
  const [endIso, setEndIso] = useState('');
  const [description, setDescription] = useState('');

  const [pendingAction, setPendingAction] = useState<PendingCalendarAction>(null);
  const [executing, setExecuting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoadEvents = async () => {
    if (!accessToken) return;
    setLoadingEvents(true);
    setErrorMsg(null);
    try {
      const items = await listGoogleCalendarEvents(accessToken);
      setGEvents(items);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error consultando Google Calendar.');
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleRequestCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || !startIso || !endIso) return;
    setPendingAction({
      kind: 'create',
      summary: summary.trim(),
      description: description.trim(),
      location: location.trim(),
      startIso,
      endIso,
    });
  };

  const handlePushCmjEvent = (ev: CalendarEventItem) => {
    setPendingAction({
      kind: 'create',
      summary: `[CMJ Flandes] ${ev.title}`,
      description: ev.description || 'Evento sincronizado desde el portal del CMJ Flandes.',
      location: ev.location,
      startIso: ev.startIso,
      endIso: ev.endIso,
    });
  };

  const executeConfirmedAction = async () => {
    if (!accessToken || !pendingAction) return;
    setExecuting(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      if (pendingAction.kind === 'create') {
        const created = await createGoogleCalendarEvent(accessToken, {
          summary: pendingAction.summary,
          description: pendingAction.description,
          location: pendingAction.location,
          startIso: pendingAction.startIso,
          endIso: pendingAction.endIso,
        });
        if (created.htmlLink) {
          await saveWorkspaceLinkToServer({
            resourceType: 'calendar_event',
            externalId: created.id,
            title: created.summary || pendingAction.summary,
            url: created.htmlLink,
            notes: `Inicio: ${pendingAction.startIso}`,
          });
        }
        setSummary('');
        setDescription('');
        setNotice(`Evento "${pendingAction.summary}" agendado en Google Calendar.`);
        await Promise.all([handleLoadEvents(), onRefreshLinks()]);
      } else if (pendingAction.kind === 'delete') {
        await deleteGoogleCalendarEvent(accessToken, pendingAction.event.id);
        setNotice(`Evento "${pendingAction.event.summary}" eliminado de Google Calendar.`);
        await handleLoadEvents();
      }
      setPendingAction(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error ejecutando operación en Google Calendar.',
      );
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                Próximos eventos en Google Calendar
              </h3>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Calendario principal asociado a tu sesión Google Workspace.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!accessToken}
              loading={loadingEvents}
              onClick={() => void handleLoadEvents()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cargar agenda</span>
            </Button>
          </div>

          {!accessToken ? (
            <p className="mt-4 text-xs text-stone-600 dark:text-slate-300">
              Conecta tu cuenta Google arriba para consultar y programar sesiones en Google Calendar.
            </p>
          ) : gEvents.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={Calendar}
                title="Haz clic en 'Cargar agenda' para ver tu calendario"
                description="Se consultarán tus próximos eventos sin realizar cambios."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-stone-200 dark:divide-slate-800">
              {gEvents.map((ev) => {
                const startVal = ev.start?.dateTime || ev.start?.date || '';
                return (
                  <li key={ev.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-stone-900 dark:text-slate-100">
                        {ev.summary || '(Sin título)'}
                      </p>
                      {startVal && (
                        <p className="font-mono-tabular text-xs text-stone-500 dark:text-slate-400">
                          {new Date(startVal).toLocaleString('es-CO', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ev.htmlLink && (
                        <a
                          href={ev.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingAction({ kind: 'delete', event: ev })}
                        title="Eliminar evento"
                        className="text-xs text-red-700 hover:text-red-900 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-stone-950 dark:text-white">
            <CalendarPlus className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <span>Agendar sesión o actividad en Google Calendar</span>
          </h3>
          <form onSubmit={handleRequestCreate} className="mt-4 space-y-3">
            <Input
              label="Título del evento"
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ej. Sesión Ordinaria Plenaria CMJ"
            />
            <Input
              label="Lugar"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Fecha y hora de inicio"
                type="datetime-local"
                required
                value={startIso}
                onChange={(e) => setStartIso(e.target.value)}
              />
              <Input
                label="Fecha y hora de cierre"
                type="datetime-local"
                required
                value={endIso}
                onChange={(e) => setEndIso(e.target.value)}
              />
            </div>
            <Textarea
              label="Descripción / Orden del día"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" disabled={!accessToken}>
              Crear en Google Calendar
            </Button>
          </form>
        </Card>
      </div>

      {notice && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {errorMsg && <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMsg}</p>}

      <WorkspaceCalendarSyncAndModal
        accessToken={accessToken}
        cmjEvents={cmjEvents}
        onPushEvent={handlePushCmjEvent}
        pendingAction={pendingAction}
        executing={executing}
        onCloseModal={() => setPendingAction(null)}
        onConfirmModal={executeConfirmedAction}
      />
    </div>
  );
}
