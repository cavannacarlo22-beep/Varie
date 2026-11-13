import type { CalEvent } from '../db/types';

export const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(): string {
  return toISO(new Date());
}
export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return x;
}
export function startOfWeek(d: Date, monday = true): Date {
  const day = d.getDay();
  const diff = monday ? (day + 6) % 7 : day;
  const x = addDays(d, -diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function monthMatrix(d: Date, monday = true): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = startOfWeek(first, monday);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export function weekdayNames(monday = true, style: 'short' | 'narrow' | 'long' = 'short'): string[] {
  const base = startOfWeek(new Date(2024, 0, 10), monday);
  return Array.from({ length: 7 }, (_, i) => addDays(base, i).toLocaleDateString('it-IT', { weekday: style }));
}
export function fmtLong(d: Date): string {
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function fmtDay(d: Date): string {
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function fmtMonth(d: Date): string {
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}
export function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'adesso';
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} ${d === 1 ? 'giorno' : 'giorni'} fa`;
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function minutesOf(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export interface Occurrence {
  event: CalEvent;
  date: string;
  /** epoch ms of start */
  start: number;
  end: number;
}

function occursOn(ev: CalEvent, day: Date): boolean {
  const base = fromISO(ev.date);
  if (day < base && !isSameDay(day, base)) return false;
  switch (ev.repeat) {
    case 'none': return isSameDay(day, base);
    case 'daily': return true;
    case 'weekly': return day.getDay() === base.getDay();
    case 'monthly': return day.getDate() === base.getDate();
    case 'yearly': return day.getDate() === base.getDate() && day.getMonth() === base.getMonth();
  }
}

export function occurrence(ev: CalEvent, date: string): Occurrence {
  const d = fromISO(date);
  const s = ev.allDay ? 0 : minutesOf(ev.startTime);
  let e = ev.allDay ? 24 * 60 : ev.endTime ? minutesOf(ev.endTime) : s + 60;
  if (e <= s) e = s + 30;
  return { event: ev, date, start: d.getTime() + s * 60000, end: d.getTime() + e * 60000 };
}

/** Expands (repeating) events into concrete occurrences within [from, to] inclusive. */
export function expand(events: CalEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  const days: Date[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) days.push(new Date(d));
  for (const ev of events) {
    if (ev.repeat === 'none') {
      const d = fromISO(ev.date);
      if (d >= addDays(from, -1) && d <= to && days.some((x) => isSameDay(x, d))) out.push(occurrence(ev, ev.date));
      continue;
    }
    for (const d of days) if (occursOn(ev, d)) out.push(occurrence(ev, toISO(d)));
  }
  return out.sort((a, b) => a.start - b.start);
}

export function timeLabel(ev: CalEvent): string {
  if (ev.allDay) return 'Tutto il giorno';
  return ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime;
}
