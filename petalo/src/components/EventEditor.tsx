import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarPlus, Download, Trash2 } from 'lucide-react';
import { db, uid } from '../db/db';
import type { CalEvent, Repeat } from '../db/types';
import { useSettings } from '../db/settings';
import { pad, todayISO } from '../lib/dates';
import { toICS } from '../lib/ics';
import { download } from '../lib/files';
import { askNotificationPermission } from '../lib/notify';
import { Modal, Switch, useUI } from './ui';

const REMINDERS: [number | null, string][] = [
  [null, 'Nessun promemoria'], [0, 'All’orario dell’evento'], [5, '5 minuti prima'], [10, '10 minuti prima'],
  [15, '15 minuti prima'], [30, '30 minuti prima'], [60, '1 ora prima'], [120, '2 ore prima'],
  [1440, '1 giorno prima'], [2880, '2 giorni prima'], [10080, '1 settimana prima'],
];
const REPEATS: [Repeat, string][] = [
  ['none', 'Non si ripete'], ['daily', 'Ogni giorno'], ['weekly', 'Ogni settimana'], ['monthly', 'Ogni mese'], ['yearly', 'Ogni anno'],
];

export function blankEvent(date = todayISO(), time?: string, reminder = 30): CalEvent {
  const now = new Date();
  const start = time ?? `${pad(Math.min(23, now.getHours() + 1))}:00`;
  const [h, m] = start.split(':').map(Number);
  const endMin = Math.min(23 * 60 + 59, h * 60 + m + 60);
  return {
    id: '', title: '', description: '', notes: '', location: '', date, startTime: start,
    endTime: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`, allDay: false, categoryId: null, reminder,
    repeat: 'none', notified: [], createdAt: 0, updatedAt: 0,
  };
}

export function EventEditor({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const ui = useUI();
  const settings = useSettings();
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const [ev, setEv] = useState<CalEvent>(() => ({
    ...event,
    categoryId: event.categoryId ?? null,
  }));
  const isNew = !event.id;
  const set = <K extends keyof CalEvent>(k: K, v: CalEvent[K]) => setEv((e) => ({ ...e, [k]: v }));

  const save = async () => {
    if (!ev.title.trim()) {
      ui.toast('Scrivi un titolo per l’appuntamento', true);
      return;
    }
    if (!ev.allDay && ev.endTime && ev.endTime <= ev.startTime) {
      ui.toast('L’orario di fine deve essere dopo l’inizio', true);
      return;
    }
    const now = Date.now();
    const changedTiming = ev.date !== event.date || ev.startTime !== event.startTime || ev.reminder !== event.reminder;
    const rec: CalEvent = {
      ...ev,
      title: ev.title.trim(),
      id: ev.id || uid(),
      createdAt: ev.createdAt || now,
      updatedAt: now,
      notified: changedTiming ? [] : ev.notified,
    };
    await db.events.put(rec);
    if (rec.reminder !== null && settings.notifications) void askNotificationPermission();
    ui.toast(isNew ? 'Appuntamento aggiunto' : 'Modifiche salvate');
    onClose();
  };

  const remove = async () => {
    if (await ui.confirm({ title: 'Eliminare l’appuntamento?', message: `“${event.title}” verrà eliminato definitivamente.`, ok: 'Elimina', danger: true })) {
      await db.events.delete(event.id);
      ui.toast('Appuntamento eliminato');
      onClose();
    }
  };

  const exportIcs = () => {
    const cat = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '';
    download(new Blob([toICS([ev], cat)], { type: 'text/calendar' }), `${ev.title || 'evento'}.ics`);
  };

  return (
    <Modal
      title={isNew ? 'Nuovo appuntamento' : 'Modifica appuntamento'}
      icon={<CalendarPlus size={22} color="var(--primary)" />}
      onClose={onClose}
      footer={<>
        {!isNew && <button className="btn btn-danger" onClick={remove}><Trash2 size={16} />Elimina</button>}
        {!isNew && <button className="btn" onClick={exportIcs} title="Aggiungi al Calendario di iPad/iPhone"><Download size={16} />Calendario Apple</button>}
        <span className="grow" />
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={save}>Salva</button>
      </>}
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="field"><span>Titolo</span>
          <input className="input" autoFocus value={ev.title} onChange={(e) => set('title', e.target.value)} placeholder="Es. Lezione di Diritto privato" />
        </label>
        <div className="field-row">
          <label className="field"><span>Giorno</span>
            <input className="input" type="date" value={ev.date} onChange={(e) => set('date', e.target.value)} required />
          </label>
          {!ev.allDay && <>
            <label className="field"><span>Dalle</span>
              <input className="input" type="time" value={ev.startTime} onChange={(e) => set('startTime', e.target.value)} />
            </label>
            <label className="field"><span>Alle</span>
              <input className="input" type="time" value={ev.endTime} onChange={(e) => set('endTime', e.target.value)} />
            </label>
          </>}
        </div>
        <div className="row"><Switch checked={ev.allDay} onChange={(v) => set('allDay', v)} label="Tutto il giorno" /><span>Tutto il giorno</span></div>
        <div className="field">
          <span>Categoria</span>
          <div className="chips">
            <button type="button" className={'chip' + (ev.categoryId === null ? ' active' : '')} onClick={() => set('categoryId', null)}>Nessuna</button>
            {categories.map((c) => (
              <button type="button" key={c.id} className={'chip' + (ev.categoryId === c.id ? ' active' : '')}
                style={ev.categoryId === c.id ? { background: c.color, borderColor: c.color } : undefined}
                onClick={() => set('categoryId', c.id)}>
                <span className="dot" style={{ background: ev.categoryId === c.id ? '#fff' : c.color }} />{c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <label className="field"><span>Promemoria</span>
            <select className="select" value={ev.reminder ?? 'none'} onChange={(e) => set('reminder', e.target.value === 'none' ? null : Number(e.target.value))}>
              {REMINDERS.map(([v, l]) => <option key={String(v)} value={v ?? 'none'}>{l}</option>)}
            </select>
          </label>
          <label className="field"><span>Ripetizione</span>
            <select className="select" value={ev.repeat} onChange={(e) => set('repeat', e.target.value as Repeat)}>
              {REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>Luogo</span>
          <input className="input" value={ev.location} onChange={(e) => set('location', e.target.value)} placeholder="Aula, indirizzo o link" />
        </label>
        <label className="field"><span>Descrizione</span>
          <textarea className="textarea" value={ev.description} onChange={(e) => set('description', e.target.value)} rows={3} />
        </label>
        <label className="field"><span>Note</span>
          <textarea className="textarea" value={ev.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Cose da portare, domande, appunti…" />
        </label>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
