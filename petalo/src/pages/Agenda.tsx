import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, ChevronLeft, ChevronRight, Download, MapPin, Plus, Repeat, Settings2, Tags, Trash2 } from 'lucide-react';
import { db, uid } from '../db/db';
import { useSettings } from '../db/settings';
import type { CalEvent, Category } from '../db/types';
import {
  addDays, addMonths, expand, fmtMonth, fromISO, isSameDay, minutesOf, monthMatrix, pad, startOfWeek, timeLabel, toISO, weekdayNames,
  type Occurrence,
} from '../lib/dates';
import { toICS } from '../lib/ics';
import { download } from '../lib/files';
import { blankEvent, EventEditor } from '../components/EventEditor';
import { Empty, Modal, Swatches, useUI } from '../components/ui';

type View = 'day' | 'week' | 'month' | 'list';
const HOUR = 52;

export default function Agenda() {
  const [params, setParams] = useSearchParams();
  const s = useSettings();
  const view = (params.get('v') as View) || 'month';
  const cursor = params.get('d') ? fromISO(params.get('d')!) : new Date();
  const setView = (v: View) => setParams({ v, d: toISO(cursor) });
  const setCursor = (d: Date) => setParams({ v: view, d: toISO(d) });

  const [edit, setEdit] = useState<CalEvent | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [filter, setFilter] = useState<string[]>([]);

  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const visible = filter.length ? events.filter((e) => filter.includes(e.categoryId ?? 'none')) : events;

  const range = useMemo((): [Date, Date] => {
    if (view === 'day') return [cursor, cursor];
    if (view === 'week') {
      const st = startOfWeek(cursor, s.weekStartsMonday);
      return [st, addDays(st, 6)];
    }
    if (view === 'list') return [cursor, addDays(cursor, 60)];
    const m = monthMatrix(cursor, s.weekStartsMonday);
    return [m[0], m[41]];
  }, [view, cursor.getTime(), s.weekStartsMonday]); // eslint-disable-line react-hooks/exhaustive-deps

  const occ = useMemo(() => expand(visible, range[0], range[1]), [visible, range]);

  const step = (dir: number) => {
    if (view === 'day') setCursor(addDays(cursor, dir));
    else if (view === 'week') setCursor(addDays(cursor, dir * 7));
    else if (view === 'list') setCursor(addDays(cursor, dir * 30));
    else setCursor(addMonths(cursor, dir));
  };

  const title = view === 'day'
    ? cursor.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${range[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${range[1].toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : fmtMonth(cursor);

  const newAt = (date: string, time?: string) => setEdit(blankEvent(date, time, s.defaultReminder));
  const color = (o: Occurrence) => catMap.get(o.event.categoryId ?? '')?.color ?? '#e46f8e';

  const exportAll = () => {
    const name = (id: string | null) => catMap.get(id ?? '')?.name ?? '';
    download(new Blob([toICS(events, name)], { type: 'text/calendar' }), 'agenda-petalo.ics');
  };

  return (
    <div className="page">
      <div className="cal-toolbar">
        <button className="btn btn-primary" onClick={() => newAt(toISO(view === 'month' ? new Date() : cursor))}><Plus size={18} />Nuovo</button>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Precedente"><ChevronLeft /></button>
          <button className="btn btn-sm" onClick={() => setCursor(new Date())}>Oggi</button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Successivo"><ChevronRight /></button>
        </div>
        <h2 style={{ textTransform: 'capitalize', flex: 1, minWidth: 180 }}>{title}</h2>
        <div className="seg">
          {(['day', 'week', 'month', 'list'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {{ day: 'Giorno', week: 'Settimana', month: 'Mese', list: 'Elenco' }[v]}
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setCatsOpen(true)} title="Categorie"><Tags size={20} /></button>
        <button className="icon-btn" onClick={exportAll} title="Esporta tutto per Calendario Apple / Google (.ics)"><Download size={20} /></button>
      </div>

      <div className="chips scroll" style={{ marginBottom: 14 }}>
        <button className={'chip' + (filter.length === 0 ? ' active' : '')} onClick={() => setFilter([])}>Tutte</button>
        {categories.map((c) => {
          const on = filter.includes(c.id);
          return (
            <button key={c.id} className="chip" style={on ? { background: c.color + '33', borderColor: c.color } : undefined}
              onClick={() => setFilter(on ? filter.filter((x) => x !== c.id) : [...filter, c.id])}>
              <span className="dot" style={{ background: c.color }} />{c.name}
            </button>
          );
        })}
      </div>

      {view === 'month' && (
        <MonthView cursor={cursor} occ={occ} monday={s.weekStartsMonday} color={color}
          onDay={(d) => setParams({ v: 'day', d: toISO(d) })} onNew={(d) => newAt(toISO(d))} onOpen={setEdit} />
      )}
      {(view === 'week' || view === 'day') && (
        <TimeGrid days={view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(range[0], i))}
          occ={occ} color={color} onOpen={setEdit} onNew={newAt} onDay={(d) => setParams({ v: 'day', d: toISO(d) })} />
      )}
      {view === 'list' && <ListView occ={occ} color={color} catMap={catMap} onOpen={setEdit} />}

      {edit && <EventEditor event={edit} onClose={() => setEdit(null)} />}
      {catsOpen && <CategoryManager categories={categories} onClose={() => setCatsOpen(false)} />}
    </div>
  );
}

function MonthView({ cursor, occ, monday, color, onDay, onNew, onOpen }: {
  cursor: Date; occ: Occurrence[]; monday: boolean; color: (o: Occurrence) => string;
  onDay: (d: Date) => void; onNew: (d: Date) => void; onOpen: (e: CalEvent) => void;
}) {
  const days = monthMatrix(cursor, monday);
  const byDay = new Map<string, Occurrence[]>();
  for (const o of occ) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);
  const today = new Date();
  return (
    <div className="month-grid">
      {weekdayNames(monday).map((w) => <div key={w} className="dow">{w}</div>)}
      {days.map((d) => {
        const iso = toISO(d);
        const list = byDay.get(iso) ?? [];
        return (
          <div key={iso} className={'month-cell' + (d.getMonth() !== cursor.getMonth() ? ' out' : '') + (isSameDay(d, today) ? ' today' : '')}
            onClick={() => onNew(d)} role="button" tabIndex={0} aria-label={`Aggiungi il ${d.toLocaleDateString('it-IT')}`}>
            <button className="num" style={{ border: 0, background: isSameDay(d, today) ? undefined : 'none', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onDay(d); }}>{d.getDate()}</button>
            {list.slice(0, 3).map((o) => (
              <button key={o.event.id} className="ev-pill" style={{ background: color(o) + '26', borderLeftColor: color(o), color: 'var(--text)' }}
                onClick={(e) => { e.stopPropagation(); onOpen(o.event); }} title={o.event.title}>
                {!o.event.allDay && <span style={{ opacity: 0.7 }}>{o.event.startTime} </span>}{o.event.title}
              </button>
            ))}
            {list.length > 3 && <button className="more" style={{ border: 0, background: 'none', textAlign: 'left' }} onClick={(e) => { e.stopPropagation(); onDay(d); }}>+{list.length - 3} altri</button>}
          </div>
        );
      })}
    </div>
  );
}

function TimeGrid({ days, occ, color, onOpen, onNew, onDay }: {
  days: Date[]; occ: Occurrence[]; color: (o: Occurrence) => string;
  onOpen: (e: CalEvent) => void; onNew: (date: string, time: string) => void; onDay: (d: Date) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    bodyRef.current?.scrollTo({ top: HOUR * 7.5 });
    return () => clearInterval(t);
  }, []);
  const today = new Date();
  const cls = 'week' + (days.length === 1 ? ' day' : '');

  /** side-by-side layout for overlapping events */
  const layout = (list: Occurrence[]) => {
    const cols: Occurrence[][] = [];
    const pos = new Map<Occurrence, { col: number; cols: number }>();
    const sorted = [...list].sort((a, b) => a.start - b.start);
    let group: Occurrence[] = [];
    let groupEnd = 0;
    const flush = () => {
      const n = cols.length;
      for (const o of group) pos.set(o, { col: pos.get(o)!.col, cols: n });
      cols.length = 0;
      group = [];
    };
    for (const o of sorted) {
      if (group.length && o.start >= groupEnd) flush();
      let placed = false;
      for (let i = 0; i < cols.length; i++) {
        if (cols[i][cols[i].length - 1].end <= o.start) { cols[i].push(o); pos.set(o, { col: i, cols: 0 }); placed = true; break; }
      }
      if (!placed) { cols.push([o]); pos.set(o, { col: cols.length - 1, cols: 0 }); }
      group.push(o);
      groupEnd = Math.max(groupEnd, o.end);
    }
    flush();
    return pos;
  };

  return (
    <div className={cls}>
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }} />
      {days.map((d) => (
        <div key={d.toISOString()} className={'week-head' + (isSameDay(d, today) ? ' today' : '')} onClick={() => onDay(d)}>
          <div className="w">{d.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
          <div className="d">{d.getDate()}</div>
        </div>
      ))}
      <div className="tiny muted" style={{ borderBottom: '1px solid var(--border)', padding: 4, textAlign: 'right' }}>giorno</div>
      {days.map((d) => (
        <div key={'ad' + d.toISOString()} className="week-allday">
          {occ.filter((o) => o.date === toISO(d) && o.event.allDay).map((o) => (
            <button key={o.event.id} className="ev-pill" style={{ background: color(o) + '30', borderLeftColor: color(o), color: 'var(--text)' }} onClick={() => onOpen(o.event)}>{o.event.title}</button>
          ))}
        </div>
      ))}
      <div className="week-body" ref={bodyRef}>
        <div className="week-times">{Array.from({ length: 24 }, (_, h) => <div key={h}>{h ? `${pad(h)}:00` : ''}</div>)}</div>
        {days.map((d) => {
          const iso = toISO(d);
          const list = occ.filter((o) => o.date === iso && !o.event.allDay);
          const pos = layout(list);
          return (
            <div key={iso} className="week-col" style={{ height: HOUR * 24 }}
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const mins = Math.floor(((e.clientY - r.top) / HOUR) * 2) * 30;
                onNew(iso, `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
              }}>
              {isSameDay(d, now) && <div className="now-line" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR }} />}
              {list.map((o) => {
                const s = minutesOf(o.event.startTime);
                const e = Math.max(s + 30, o.event.endTime ? minutesOf(o.event.endTime) : s + 60);
                const p = pos.get(o) ?? { col: 0, cols: 1 };
                const w = 100 / Math.max(1, p.cols);
                return (
                  <button key={o.event.id} className="week-ev"
                    style={{ top: (s / 60) * HOUR + 1, height: ((e - s) / 60) * HOUR - 2, left: `calc(${p.col * w}% + 3px)`, width: `calc(${w}% - 6px)`, right: 'auto', background: color(o) + '2e', borderLeftColor: color(o), color: 'var(--text)', borderTop: 0, borderRight: 0, borderBottom: 0, textAlign: 'left' }}
                    onClick={(ev) => { ev.stopPropagation(); onOpen(o.event); }}>
                    {o.event.title}
                    <small>{timeLabel(o.event)}{o.event.location ? ' · ' + o.event.location : ''}</small>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ occ, color, catMap, onOpen }: { occ: Occurrence[]; color: (o: Occurrence) => string; catMap: Map<string, Category>; onOpen: (e: CalEvent) => void }) {
  if (!occ.length) return <div className="card"><Empty title="Nessun appuntamento" text="Nei prossimi due mesi non ci sono impegni. Premi “Nuovo” per aggiungerne uno." /></div>;
  const groups = new Map<string, Occurrence[]>();
  for (const o of occ) groups.set(o.date, [...(groups.get(o.date) ?? []), o]);
  return (
    <div className="stack">
      {[...groups.entries()].map(([date, list]) => (
        <div key={date} className="card">
          <h3 style={{ textTransform: 'capitalize', marginBottom: 8 }}>{fromISO(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          {list.map((o) => (
            <button key={o.event.id} className="list-row" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px dashed var(--border)', textAlign: 'left' }} onClick={() => onOpen(o.event)}>
              <span className="when">{o.event.allDay ? 'Giorno' : o.event.startTime}</span>
              <span className="dot" style={{ background: color(o), width: 12, height: 12 }} />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{o.event.title}</div>
                <div className="small muted row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  {catMap.get(o.event.categoryId ?? '')?.name}
                  {o.event.location && <span className="row" style={{ gap: 3 }}><MapPin size={12} />{o.event.location}</span>}
                  {o.event.repeat !== 'none' && <Repeat size={12} />}
                  {o.event.reminder !== null && <Bell size={12} />}
                </div>
                {o.event.notes && <div className="small" style={{ marginTop: 4, color: 'var(--text-2)' }}>{o.event.notes}</div>}
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function CategoryManager({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const ui = useUI();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7fbfe8');
  const add = async () => {
    if (!name.trim()) return;
    await db.categories.add({ id: uid(), name: name.trim(), color, order: categories.length });
    setName('');
  };
  const remove = async (c: Category) => {
    const n = await db.events.where('categoryId').equals(c.id).count();
    if (await ui.confirm({ title: `Eliminare “${c.name}”?`, message: n ? `${n} appuntamenti resteranno senza categoria.` : undefined, ok: 'Elimina', danger: true })) {
      await db.transaction('rw', db.categories, db.events, async () => {
        await db.events.where('categoryId').equals(c.id).modify({ categoryId: null });
        await db.categories.delete(c.id);
      });
    }
  };
  return (
    <Modal title="Categorie" icon={<Settings2 size={22} color="var(--primary)" />} onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Fatto</button>}>
      <div className="stack">
        {categories.map((c) => (
          <div key={c.id} className="row">
            <input type="color" value={c.color} onChange={(e) => db.categories.update(c.id, { color: e.target.value })} style={{ width: 40, height: 40, border: 0, background: 'none', padding: 0 }} aria-label="Colore" />
            <input className="input" defaultValue={c.name} onBlur={(e) => e.target.value.trim() && db.categories.update(c.id, { name: e.target.value.trim() })} />
            <button className="icon-btn danger" onClick={() => remove(c)} aria-label="Elimina"><Trash2 size={18} /></button>
          </div>
        ))}
        <div className="divider" />
        <b>Nuova categoria</b>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Palestra" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Swatches value={color} onChange={setColor} />
        <button className="btn btn-soft" onClick={add}><Plus size={16} />Aggiungi categoria</button>
      </div>
    </Modal>
  );
}
