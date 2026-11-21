import { CalendarEventItem } from '../types/models';

function formatIcsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function downloadEventIcs(event: CalendarEventItem): void {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CMJ Flandes Tolima//Portal Institucional//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@cmjflandes.gov.co`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART:${formatIcsDate(event.startIso)}`,
    `DTEND:${formatIcsDate(event.endIso)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(event.description || 'Actividad institucional del CMJ Flandes')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `evento-cmj-flandes-${event.id}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildGoogleCalendarUrl(event: CalendarEventItem): string {
  const start = formatIcsDate(event.startIso);
  const end = formatIcsDate(event.endIso);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${event.title} · CMJ Flandes`,
    dates: `${start}/${end}`,
    details: event.description || 'Actividad oficial del Consejo Municipal de Juventud de Flandes, Tolima.',
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
