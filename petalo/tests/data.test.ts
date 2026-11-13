// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { db, uid } from '../src/db/db';
import { getSettings, setSettings } from '../src/db/settings';
import { createBackupZip, restoreBackup, restoreSnapshot, takeSnapshot } from '../src/lib/backup';
import { decryptBytes, encryptBytes, hashPin } from '../src/lib/crypto';
import { addDays, expand, toISO } from '../src/lib/dates';
import { toICS } from '../src/lib/ics';
import { examStats } from '../src/lib/exams';
import { cycleInfo } from '../src/pages/Benessere';
import type { CalEvent } from '../src/db/types';

const ev = (p: Partial<CalEvent>): CalEvent => ({
  id: uid(), title: 'Lezione', description: '', notes: '', location: '', date: '2026-11-10', startTime: '10:00', endTime: '12:00', allDay: false,
  categoryId: null, reminder: 30, repeat: 'none', notified: [], createdAt: 0, updatedAt: 0, ...p,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('salvataggio persistente', () => {
  it('impostazioni con valori predefiniti e salvataggio', async () => {
    expect((await getSettings()).theme).toBe('rosa');
    await setSettings({ name: 'Giulia', theme: 'lavanda' });
    const s = await getSettings();
    expect(s.name).toBe('Giulia');
    expect(s.theme).toBe('lavanda');
  });

  it('backup completo con file e ripristino', async () => {
    await db.events.add(ev({ title: 'Esame di Statistica' }));
    await db.lists.add({ id: 'l1', title: 'Spesa', kind: 'spesa', color: '#fff', emoji: '🛒', order: 0, pinned: false, createdAt: 1, updatedAt: 1 });
    await db.items.add({ id: 'i1', listId: 'l1', text: 'Latte', note: '', done: false, order: 0, dueDate: '', priority: 0, createdAt: 1, completedAt: null });
    await db.files.add({ id: 'f1', name: 'slide.pdf', folderId: null, mime: 'application/pdf', size: 5, category: 'pdf', blob: new Blob(['%PDF-'], { type: 'application/pdf' }), favorite: false, tags: [], createdAt: 1, updatedAt: 1 });
    const zip = await createBackupZip();
    const parsed = await JSZip.loadAsync(await zip.arrayBuffer());
    expect(parsed.file('files/f1')).toBeTruthy();

    await db.events.clear();
    await db.items.clear();
    await db.files.clear();
    await restoreBackup(zip);
    expect((await db.events.toArray())[0].title).toBe('Esame di Statistica');
    expect((await db.items.get('i1'))?.text).toBe('Latte');
    const f = await db.files.get('f1');
    expect(f?.name).toBe('slide.pdf');
    expect(f?.size).toBe(5);
  });

  it('backup cifrato richiede la password giusta', async () => {
    await db.memos.add({ id: 'm1', text: 'Chiamare la segreteria', color: '', dueAt: '', done: false, createdAt: 1 });
    const zip = new Uint8Array(await (await createBackupZip()).arrayBuffer());
    const enc = await encryptBytes(zip, 'segreta123');
    await expect(decryptBytes(enc, 'sbagliata')).rejects.toThrow('Password errata');
    await db.memos.clear();
    await restoreBackup(new Blob([enc]), 'segreta123');
    expect((await db.memos.get('m1'))?.text).toBe('Chiamare la segreteria');
  });

  it('copie automatiche e ripristino', async () => {
    await db.notebooks.add({ id: 'n1', title: 'Diritto', subject: '', professor: '', cover: { color: '#f00', pattern: 'hearts', emoji: '📒' }, paper: 'lines', order: 0, archived: false, createdAt: 1, updatedAt: 1 });
    await takeSnapshot();
    await db.notebooks.update('n1', { title: 'Cambiato' });
    const [snap] = await db.snapshots.toArray();
    await restoreSnapshot(snap.id!);
    expect((await db.notebooks.get('n1'))?.title).toBe('Diritto');
  });

  it('hash del PIN stabile e diverso per sale diverso', async () => {
    expect(await hashPin('1234', 'a')).toBe(await hashPin('1234', 'a'));
    expect(await hashPin('1234', 'a')).not.toBe(await hashPin('1234', 'b'));
  });
});

describe('agenda', () => {
  it('ripetizioni settimanali', () => {
    const occ = expand([ev({ date: '2026-11-02', repeat: 'weekly' })], new Date(2026, 10, 1), new Date(2026, 10, 30));
    expect(occ.map((o) => o.date)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  });
  it('eventi singoli nell’intervallo', () => {
    const today = new Date(2026, 10, 13);
    const occ = expand([ev({ date: toISO(today) }), ev({ date: toISO(addDays(today, 40)) })], today, addDays(today, 7));
    expect(occ).toHaveLength(1);
  });
  it('esportazione .ics per il Calendario Apple', () => {
    const ics = toICS([ev({ title: 'Ricevimento, prof', repeat: 'monthly' })]);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Ricevimento\\, prof');
    expect(ics).toContain('DTSTART:20261110T100000');
    expect(ics).toContain('RRULE:FREQ=MONTHLY');
    expect(ics).toContain('TRIGGER:-PT30M');
  });
});

describe('studio e benessere', () => {
  it('medie del libretto', () => {
    const base = { id: '', date: '', notebookId: null, notes: '', createdAt: 0 };
    const st = examStats([
      { ...base, name: 'A', cfu: 12, grade: 30, status: 'superato' },
      { ...base, name: 'B', cfu: 6, grade: 24, status: 'superato' },
      { ...base, name: 'C', cfu: 6, grade: 31, status: 'superato' },
      { ...base, name: 'D', cfu: 3, grade: 0, status: 'superato' },
      { ...base, name: 'E', cfu: 9, grade: 0, status: 'da-sostenere' },
    ]);
    expect(st.cfu).toBe(27);
    expect(st.weighted).toBe(28.5);
    expect(st.arithmetic).toBe(28);
    expect(st.base).toBeCloseTo(104.5);
    expect(st.lodi).toBe(1);
  });
  it('previsione del ciclo', () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-29', '2026-08-30', '2026-09-26', '2026-09-27'];
    const info = cycleInfo(days);
    expect(info.starts).toEqual(['2026-08-01', '2026-08-29', '2026-09-26']);
    expect(info.avg).toBe(28);
    expect(info.next).toBe('2026-10-24');
  });
});
