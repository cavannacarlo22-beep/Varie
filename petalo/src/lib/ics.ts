import type { CalEvent } from '../db/types';
import { addDays, fromISO, minutesOf, pad, toISO } from './dates';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function local(date: string, time: string): string {
  const m = minutesOf(time);
  return date.replace(/-/g, '') + 'T' + pad(Math.floor(m / 60)) + pad(m % 60) + '00';
}
function fold(line: string): string {
  const out: string[] = [];
  let s = line;
  while (s.length > 74) {
    out.push(s.slice(0, 74));
    s = ' ' + s.slice(74);
  }
  out.push(s);
  return out.join('\r\n');
}

const RRULE: Record<string, string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

/** Builds an iCalendar file that Apple Calendar, Google and Outlook can import. */
export function toICS(events: CalEvent[], categoryName: (id: string | null) => string = () => ''): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Petalo//Agenda//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const ev of events) {
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@petalo`, `DTSTAMP:${now}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${ev.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${toISO(addDays(fromISO(ev.date), 1)).replace(/-/g, '')}`);
    } else {
      lines.push(`DTSTART:${local(ev.date, ev.startTime)}`);
      const end = ev.endTime || `${pad(Math.min(23, Math.floor(minutesOf(ev.startTime) / 60) + 1))}:${pad(minutesOf(ev.startTime) % 60)}`;
      lines.push(`DTEND:${local(ev.date, end)}`);
    }
    lines.push(`SUMMARY:${esc(ev.title)}`);
    const desc = [ev.description, ev.notes].filter(Boolean).join('\n\n');
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    const cat = categoryName(ev.categoryId);
    if (cat) lines.push(`CATEGORIES:${esc(cat)}`);
    if (ev.repeat !== 'none') lines.push(`RRULE:FREQ=${RRULE[ev.repeat]}`);
    if (ev.reminder !== null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)}`, `TRIGGER:-PT${ev.reminder}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
