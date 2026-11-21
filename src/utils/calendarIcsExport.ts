import { CalendarEventItem } from '../types/models';

function toIcsTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso.replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15);
  }
  return parsed.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildCalendarIcsContent(events: CalendarEventItem[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CMJ Flandes Tolima//Agenda Institucional//ES',
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@cmjflandes.gov.co`);
    lines.push(`DTSTAMP:${toIcsTimestamp(new Date().toISOString())}`);
    lines.push(`DTSTART:${toIcsTimestamp(ev.startIso)}`);
    lines.push(`DTEND:${toIcsTimestamp(ev.endIso || ev.startIso)}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    lines.push(`LOCATION:${escapeIcsText(ev.location || 'Flandes, Tolima')}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadCalendarIcs(events: CalendarEventItem[], fileName = 'agenda-cmj-flandes.ics'): void {
  const content = buildCalendarIcsContent(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
