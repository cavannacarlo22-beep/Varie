import { db } from '../db/db';
import { getSettings } from '../db/settings';
import { addDays, expand, todayISO } from './dates';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function askNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export async function showSystemNotification(title: string, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', tag: title + body });
    } else {
      new Notification(title, { body, icon: './icon-192.png' });
    }
    return true;
  } catch {
    return false;
  }
}

export interface DueReminder {
  key: string;
  title: string;
  body: string;
}

/**
 * Finds event reminders that are due now and not yet notified,
 * marks them as notified and returns them.
 */
export async function collectDueReminders(now = Date.now()): Promise<DueReminder[]> {
  const settings = await getSettings();
  if (!settings.notifications) return [];
  const events = await db.events.toArray();
  const from = addDays(new Date(now), -1);
  const to = addDays(new Date(now), 2);
  const due: DueReminder[] = [];
  for (const occ of expand(events, from, to)) {
    const ev = occ.event;
    if (ev.reminder === null) continue;
    const fireAt = occ.start - ev.reminder * 60000;
    // fire if within the window [fireAt, start + 5 min] and not yet notified
    if (now >= fireAt && now <= occ.end && !ev.notified.includes(occ.date)) {
      const mins = Math.round((occ.start - now) / 60000);
      const when = ev.allDay ? 'oggi' : mins > 0 ? `tra ${mins} min (${ev.startTime})` : `adesso (${ev.startTime})`;
      due.push({ key: ev.id + occ.date, title: ev.title, body: `${when}${ev.location ? ' · ' + ev.location : ''}` });
      const notified = [...ev.notified.filter((d) => d >= todayISO().slice(0, 8)), occ.date].slice(-30);
      await db.events.update(ev.id, { notified });
      ev.notified = notified;
    }
  }
  return due;
}
