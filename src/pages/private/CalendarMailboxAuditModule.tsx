import { FormEvent, useMemo, useState } from 'react';
import { Calendar, CalendarDays, Download, LayoutGrid, List } from 'lucide-react';
import { createCalendarEvent } from '../../services/privateContentService';
import {
  AuditLogEntry,
  CalendarEventItem,
  MailboxEntry,
  UserProfile,
} from '../../types/models';
import { downloadCalendarIcs } from '../../utils/calendarIcsExport';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { AuditAndBackupPanel, FullBackupPayload } from './AuditAndBackupPanel';
import { MailboxInboxPanel } from './MailboxInboxPanel';

interface CalendarMailboxAuditModuleProps {
  actor: UserProfile;
  users?: UserProfile[];
  events: CalendarEventItem[];
  mailbox: MailboxEntry[];
  auditLogs: AuditLogEntry[];
  backupData: FullBackupPayload;
  onReload: () => Promise<void>;
}

export function CalendarMailboxAuditModule({
  actor,
  users = [],
  events,
  mailbox,
  auditLogs,
  backupData,
  onReload,
}: CalendarMailboxAuditModuleProps) {
  const { showToast } = useToast();
  const isBoard = ['secretario_admin', 'presidente', 'vicepresidente'].includes(actor.role);
  const isLeaderOrBoard = isBoard || actor.role === 'lider_comision';
  const activeUsers = useMemo(() => users.filter((u) => u.status === 'activo'), [users]);

  const [tab, setTab] = useState<'calendario' | 'buzon' | 'auditoria'>('calendario');
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState<'sesion' | 'reunion' | 'actividad'>('reunion');
  const [evStart, setEvStart] = useState('');
  const [evEnd, setEvEnd] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evVis, setEvVis] = useState<'publico' | 'interno'>('publico');
  const [evDesc, setEvDesc] = useState('');
  const [evReminder, setEvReminder] = useState('');
  const [saving, setSaving] = useState(false);

  const [evSearch, setEvSearch] = useState('');
  const [evTypeFilter, setEvTypeFilter] = useState('');
  const [evView, setEvView] = useState<'cards' | 'week' | 'table'>('cards');

  const filteredEvents = useMemo(() => {
    const q = evSearch.trim().toLowerCase();
    return events.filter((ev) => {
      if (evTypeFilter && ev.eventType !== evTypeFilter) return false;
      if (!q) return true;
      return ev.title.toLowerCase().includes(q) || ev.location.toLowerCase().includes(q);
    });
  }, [events, evSearch, evTypeFilter]);

  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createCalendarEvent(actor, {
        title: evTitle,
        eventType: evType,
        startIso: evStart,
        endIso: evEnd,
        location: evLocation,
        visibility: evVis,
        description: evDesc,
        reminderNote: evReminder,
      });
      setEvTitle('');
      setEvStart('');
      setEvEnd('');
      setEvLocation('');
      setEvDesc('');
      setEvReminder('');
      showToast('Evento guardado en el calendario.', 'success');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const eventColumns: TableColumn<CalendarEventItem>[] = [
    { key: 'title', header: 'Evento', sortValue: (ev) => ev.title, render: (ev) => <span className="font-semibold">{ev.title}</span> },
    { key: 'type', header: 'Tipo', sortValue: (ev) => ev.eventType, render: (ev) => <span className="capitalize">{ev.eventType}</span> },
    { key: 'startIso', header: 'Inicio', sortValue: (ev) => ev.startIso, render: (ev) => <span className="font-mono-tabular">{ev.startIso}</span> },
    { key: 'location', header: 'Lugar', sortValue: (ev) => ev.location, render: (ev) => <span>{ev.location}</span> },
    { key: 'visibility', header: 'Visibilidad', sortValue: (ev) => ev.visibility, render: (ev) => <StatusText label={ev.visibility} tone="info" /> },
  ];

  const tabOptions: { id: 'calendario' | 'buzon' | 'auditoria'; label: string }[] = [
    { id: 'calendario', label: `Calendario (${events.length})` },
    { id: 'buzon', label: `Buzón juvenil (${mailbox.length})` },
    ...(isBoard ? [{ id: 'auditoria' as const, label: 'Bitácora de auditoría' }] : []),
  ];

  return (
    <div className="space-y-6">
      <Tabs ariaLabel="Submódulos de agenda, buzón y auditoría" activeId={tab} onChange={setTab} options={tabOptions} />

      {tab === 'calendario' && (
        <div className="space-y-6">
          {isLeaderOrBoard && (
            <Card>
              <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                Agendar evento o recordatorio
              </h2>
              <form onSubmit={handleCreateEvent} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="Título" required minLength={3} maxLength={180} value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
                  <Select label="Tipo" value={evType} onChange={(e) => setEvType(e.target.value as 'sesion' | 'reunion' | 'actividad')}>
                    <option value="reunion">Reunión</option>
                    <option value="sesion">Sesión</option>
                    <option value="actividad">Actividad territorial</option>
                  </Select>
                  <Select label="Visibilidad" value={evVis} onChange={(e) => setEvVis(e.target.value as 'publico' | 'interno')}>
                    <option value="publico">Público</option>
                    <option value="interno">Interno</option>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="Inicio" type="datetime-local" required value={evStart} onChange={(e) => setEvStart(e.target.value)} />
                  <Input label="Fin" type="datetime-local" required value={evEnd} onChange={(e) => setEvEnd(e.target.value)} />
                  <Input label="Lugar" required value={evLocation} onChange={(e) => setEvLocation(e.target.value)} />
                </div>
                <Input label="Recordatorio (opcional)" maxLength={400} value={evReminder} onChange={(e) => setEvReminder(e.target.value)} placeholder="Ej. Llevar propuestas impresas 24h antes" />
                <Textarea label="Descripción" rows={2} maxLength={1500} value={evDesc} onChange={(e) => setEvDesc(e.target.value)} />
                <Button type="submit" loading={saving}>Guardar evento</Button>
              </form>
            </Card>
          )}

          <Card padding="sm" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
                Agenda registrada ({filteredEvents.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={evView === 'cards' ? 'primary' : 'outline'} onClick={() => setEvView('cards')}>
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /><span>Tarjetas</span>
                </Button>
                <Button size="sm" variant={evView === 'week' ? 'primary' : 'outline'} onClick={() => setEvView('week')}>
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /><span>Por fecha</span>
                </Button>
                <Button size="sm" variant={evView === 'table' ? 'primary' : 'outline'} onClick={() => setEvView('table')}>
                  <List className="h-3.5 w-3.5" aria-hidden="true" /><span>Tabla y Exportar</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filteredEvents.length === 0}
                  onClick={() => downloadCalendarIcs(filteredEvents)}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>Exportar .ics</span>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Buscar evento" type="search" value={evSearch} onChange={(e) => setEvSearch(e.target.value)} placeholder="Título o lugar..." />
              <Select label="Tipo" value={evTypeFilter} onChange={(e) => setEvTypeFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="sesion">Sesión</option>
                <option value="reunion">Reunión</option>
                <option value="actividad">Actividad territorial</option>
              </Select>
            </div>
          </Card>

          {filteredEvents.length === 0 ? (
            <EmptyState icon={Calendar} title="Calendario sin eventos" description="Agenda reuniones, sesiones o actividades juveniles." />
          ) : evView === 'table' ? (
            <Card>
              <DataTable rows={filteredEvents} columns={eventColumns} rowKey={(ev) => ev.id} exportFileName="cmj-flandes-calendario" exportTitle="Agenda Institucional — CMJ Flandes" />
            </Card>
          ) : evView === 'week' ? (
            <div className="space-y-3">
              {Object.entries(
                filteredEvents.reduce<Record<string, CalendarEventItem[]>>((acc, ev) => {
                  const day = ev.startIso.slice(0, 10) || 'Sin fecha';
                  (acc[day] ||= []).push(ev);
                  return acc;
                }, {}),
              ).map(([day, list]) => (
                <Card key={day} padding="sm">
                  <p className="font-mono-tabular text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                    {day} ({list.length})
                  </p>
                  <ul className="mt-2 divide-y divide-stone-200/70 text-xs dark:divide-slate-800">
                    {list.map((ev) => (
                      <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="font-medium text-stone-900 dark:text-white">{ev.title}</span>
                        <span className="text-stone-500 dark:text-slate-400">
                          {ev.startIso.slice(11, 16) || 'Todo el día'} · {ev.location}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((ev) => (
                <Card key={ev.id} padding="sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="font-mono-tabular">{ev.startIso}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ev.location}</span>
                    <StatusText label={ev.visibility} tone="info" />
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{ev.title}</h3>
                  {ev.reminderNote && (
                    <p className="mt-1 text-xs text-[#7B1832] dark:text-[#D9B245]">Recordatorio: {ev.reminderNote}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'buzon' && (
        <MailboxInboxPanel actor={actor} isBoard={isBoard} activeUsers={activeUsers} mailbox={mailbox} onReload={onReload} />
      )}

      {tab === 'auditoria' && isBoard && (
        <AuditAndBackupPanel actor={actor} auditLogs={auditLogs} backupData={backupData} />
      )}
    </div>
  );
}
