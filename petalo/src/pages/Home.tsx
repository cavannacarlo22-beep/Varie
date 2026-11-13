import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown, ArrowUp, Bell, BookHeart, Calculator, CalendarHeart, Check, Clock, Droplet, Eye, EyeOff, FileText,
  FolderHeart, GraduationCap, ListChecks, Minus, Pencil, Plus, StickyNote, Type, X,
} from 'lucide-react';
import { db, uid } from '../db/db';
import { setSettings, useSettings, type Settings } from '../db/settings';
import type { CalEvent } from '../db/types';
import { addDays, expand, fmtLong, fmtRelative, fromISO, isSameDay, timeLabel, toISO, todayISO } from '../lib/dates';
import { calc, formatValue } from '../lib/formula';
import { CATEGORY_COLOR, fmtSize, openBlob } from '../lib/files';
import { greetingFor, quoteOfDay } from '../lib/quotes';
import { MiniCalendar } from '../components/MiniCalendar';
import { blankEvent, EventEditor } from '../components/EventEditor';
import { Empty, Modal, Swatches, useUI } from '../components/ui';
import { TinyHeart } from '../components/Hearts';
import { examStats } from '../lib/exams';

const WIDGETS: Record<string, string> = {
  today: 'Accesso rapido', calendar: 'Calendario', events: 'Prossimi appuntamenti', tasks: 'Attività da completare',
  notes: 'Ultimi appunti', memos: 'Promemoria', files: 'Documenti', calc: 'Calcolo veloce', study: 'Studio', wellness: 'Benessere di oggi',
};
const SPAN: Record<string, string> = {
  today: 'span-12', calendar: 'span-4', events: 'span-8', tasks: 'span-6', notes: 'span-6', memos: 'span-4',
  files: 'span-8', calc: 'span-4', study: 'span-4', wellness: 'span-4',
};

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Home() {
  const s = useSettings();
  const now = useClock();
  const [editing, setEditing] = useState(false);
  const [editHero, setEditHero] = useState(false);
  const greeting = s.greeting === 'auto' || !s.greeting ? greetingFor(now) : s.greeting;
  const quote = s.rotateQuotes ? quoteOfDay(now) : s.quote;

  const widgets = s.dashboardWidgets;
  const hidden = Object.keys(WIDGETS).filter((w) => !widgets.includes(w));
  const move = (i: number, d: number) => {
    const arr = [...widgets];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    void setSettings({ dashboardWidgets: arr });
  };

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>{greeting}{s.name ? `, ${s.name}` : ''} <TinyHeart size={22} /></h1>
          <div className="date">{fmtLong(now)}</div>
          <div className="quote">“{quote}”{!s.rotateQuotes && s.quoteAuthor ? <span className="small"> — {s.quoteAuthor}</span> : null}</div>
        </div>
        <div className="clock">
          {now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          <small>Settimana {isoWeek(now)} · {now.toLocaleTimeString('it-IT', { second: '2-digit' }).padStart(2, '0')}″</small>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
          <button className="icon-btn sm" onClick={() => setEditHero(true)} title="Personalizza saluto e frase"><Pencil size={16} /></button>
          <button className={'icon-btn sm' + (editing ? ' active' : '')} onClick={() => setEditing(!editing)} title="Modifica la dashboard">
            {editing ? <Check size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </section>

      {editing && (
        <div className="card soft" style={{ marginTop: 16 }}>
          <div className="row between wrap">
            <b>Modifica la dashboard: nascondi, mostra e riordina i riquadri.</b>
            <button className="btn btn-sm btn-primary" onClick={() => setEditing(false)}>Fatto</button>
          </div>
          {hidden.length > 0 && (
            <div className="chips" style={{ marginTop: 12 }}>
              {hidden.map((w) => (
                <button key={w} className="chip" onClick={() => setSettings({ dashboardWidgets: [...widgets, w] })}><Plus size={14} />{WIDGETS[w]}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="dash-grid">
        {widgets.filter((w) => WIDGETS[w]).map((w, i) => (
          <div key={w} className={SPAN[w]} style={{ position: 'relative', minWidth: 0 }}>
            {editing && (
              <div className="row" style={{ position: 'absolute', top: -10, right: 10, zIndex: 2, background: 'var(--surface)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 2, gap: 0 }}>
                <button className="icon-btn sm" onClick={() => move(i, -1)} aria-label="Sposta prima"><ArrowUp size={16} /></button>
                <button className="icon-btn sm" onClick={() => move(i, 1)} aria-label="Sposta dopo"><ArrowDown size={16} /></button>
                <button className="icon-btn sm danger" onClick={() => setSettings({ dashboardWidgets: widgets.filter((x) => x !== w) })} aria-label="Nascondi"><EyeOff size={16} /></button>
              </div>
            )}
            <Widget id={w} settings={s} />
          </div>
        ))}
      </div>
      {editHero && <HeroEditor s={s} onClose={() => setEditHero(false)} />}
    </div>
  );
}

function Widget({ id, settings }: { id: string; settings: Settings }) {
  switch (id) {
    case 'today': return <QuickAccess />;
    case 'calendar': return <CalendarWidget monday={settings.weekStartsMonday} />;
    case 'events': return <EventsWidget />;
    case 'tasks': return <TasksWidget />;
    case 'notes': return <NotesWidget />;
    case 'memos': return <MemosWidget />;
    case 'files': return <FilesWidget />;
    case 'calc': return <CalcWidget />;
    case 'study': return <StudyWidget scale={settings.graduationScale} />;
    case 'wellness': return <WellnessWidget goal={settings.waterGoal} />;
  }
  return null;
}

function QuickAccess() {
  const [newEvent, setNewEvent] = useState(false);
  const s = useSettings();
  const items = [
    { to: '/agenda', label: 'Agenda', icon: CalendarHeart, color: '#e46f8e' },
    { to: '/quaderni', label: 'Quaderni', icon: BookHeart, color: '#b49be0' },
    { to: '/liste', label: 'Liste', icon: ListChecks, color: '#7fbfe8' },
    { to: '/calcoli', label: 'Calcolatrice', icon: Calculator, color: '#f2a35e' },
    { to: '/archivio', label: 'Documenti', icon: FolderHeart, color: '#4caf84' },
    { to: '/font', label: 'Font', icon: Type, color: '#f39cc0' },
    { to: '/studio', label: 'Studio', icon: GraduationCap, color: '#5fa8dc' },
  ];
  return (
    <div className="quick">
      <button onClick={() => setNewEvent(true)} style={{ background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'var(--primary)' }}>
        <span className="q-ico" style={{ background: 'rgba(255,255,255,.22)' }}><Plus size={20} /></span>Nuovo impegno
      </button>
      {items.map(({ to, label, icon: Icon, color }) => (
        <Link key={to} to={to}>
          <span className="q-ico" style={{ background: color + '22', color }}><Icon size={20} /></span>{label}
        </Link>
      ))}
      {newEvent && <EventEditor event={blankEvent(todayISO(), undefined, s.defaultReminder)} onClose={() => setNewEvent(false)} />}
    </div>
  );
}

function useEventsRange(days: number) {
  return useLiveQuery(async () => {
    const all = await db.events.toArray();
    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { occ: expand(all, from, addDays(from, days)), cats };
  }, [days]);
}

function CalendarWidget({ monday }: { monday: boolean }) {
  const nav = useNavigate();
  const data = useLiveQuery(async () => {
    const all = await db.events.toArray();
    const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c.color]));
    const from = addDays(new Date(), -45);
    const map = new Map<string, string[]>();
    for (const o of expand(all, from, addDays(from, 120))) {
      const arr = map.get(o.date) ?? [];
      arr.push(cats.get(o.event.categoryId ?? '') ?? 'var(--primary)');
      map.set(o.date, arr);
    }
    return map;
  }, []);
  return (
    <div className="card">
      <MiniCalendar dots={data} monday={monday} onSelect={(d) => nav(`/agenda?d=${toISO(d)}&v=day`)} />
    </div>
  );
}

function EventsWidget() {
  const data = useEventsRange(14);
  const [edit, setEdit] = useState<CalEvent | null>(null);
  const now = Date.now();
  const upcoming = (data?.occ ?? []).filter((o) => o.end >= now).slice(0, 7);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><CalendarHeart size={18} />Prossimi appuntamenti</h3>
        <Link to="/agenda" className="btn btn-sm btn-ghost">Agenda</Link>
      </div>
      {upcoming.length === 0 ? (
        <Empty title="Nessun impegno in vista" text="Le prossime due settimane sono libere. Aggiungi un appuntamento dall’agenda." />
      ) : upcoming.map((o) => {
        const cat = data?.cats.get(o.event.categoryId ?? '');
        const d = fromISO(o.date);
        const label = isSameDay(d, new Date()) ? 'Oggi' : isSameDay(d, addDays(new Date(), 1)) ? 'Domani' : d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
        const soon = o.start - now < 3600000 && o.start > now;
        return (
          <button key={o.event.id + o.date} className="list-row" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px dashed var(--border)', textAlign: 'left' }} onClick={() => setEdit(o.event)}>
            <span className="dot" style={{ background: cat?.color ?? 'var(--primary)', width: 12, height: 12 }} />
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 600 }}>{o.event.title}</div>
              <div className="small muted ellipsis">{label} · {timeLabel(o.event)}{o.event.location ? ' · ' + o.event.location : ''}</div>
            </div>
            {soon && <span className="badge"><Clock size={12} />&nbsp;a breve</span>}
            {o.event.reminder !== null && <Bell size={15} color="var(--muted)" />}
          </button>
        );
      })}
      {edit && <EventEditor event={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function TasksWidget() {
  const data = useLiveQuery(async () => {
    const items = await db.items.filter((i) => !i.done).toArray();
    const lists = new Map((await db.lists.toArray()).map((l) => [l.id, l]));
    const today = todayISO();
    items.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || b.priority - a.priority);
    return { items: items.slice(0, 8), lists, total: items.length, overdue: items.filter((i) => i.dueDate && i.dueDate < today).length };
  }, []);
  const toggle = (id: string) => db.items.update(id, { done: true, completedAt: Date.now() });
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><ListChecks size={18} />Da completare {data?.total ? <span className="badge soft">{data.total}</span> : null}</h3>
        <Link to="/liste" className="btn btn-sm btn-ghost">Liste</Link>
      </div>
      {!data?.items.length ? (
        <Empty title="Tutto fatto!" text="Non hai attività in sospeso. Goditi il momento." />
      ) : data.items.map((it) => {
        const list = data.lists.get(it.listId);
        const late = it.dueDate && it.dueDate < todayISO();
        return (
          <div key={it.id} className="list-row">
            <input type="checkbox" className="checkbox" onChange={() => toggle(it.id)} aria-label="Completa" />
            <Link to={`/liste/${it.listId}`} className="grow" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="ellipsis" style={{ fontWeight: 500 }}>{it.text}</div>
              <div className="tiny muted">{list?.emoji} {list?.title}{it.dueDate ? ` · ${late ? 'scaduta il ' : 'entro il '}${fromISO(it.dueDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}` : ''}</div>
            </Link>
            {late && <span className="badge" style={{ background: 'var(--danger)' }}>!</span>}
          </div>
        );
      })}
    </div>
  );
}

function NotesWidget() {
  const data = useLiveQuery(async () => {
    const notes = await db.notes.orderBy('openedAt').reverse().limit(6).toArray();
    const nbs = new Map((await db.notebooks.toArray()).map((n) => [n.id, n]));
    return { notes, nbs };
  }, []);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><BookHeart size={18} />Ultimi appunti aperti</h3>
        <Link to="/quaderni" className="btn btn-sm btn-ghost">Quaderni</Link>
      </div>
      {!data?.notes.length ? (
        <Empty title="Nessun appunto ancora" text="Crea il tuo primo quaderno e inizia a scrivere." action={<Link className="btn btn-soft" to="/quaderni">Vai ai quaderni</Link>} />
      ) : data.notes.map((n) => {
        const nb = data.nbs.get(n.notebookId);
        return (
          <Link key={n.id} to={`/quaderni/${n.notebookId}/${n.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="list-emoji" style={{ background: (nb?.cover.color ?? '#f6b3c4') + '55', width: 36, height: 36 }}>{nb?.cover.emoji ?? '📒'}</span>
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 600 }}>{n.title || 'Senza titolo'}</div>
              <div className="tiny muted ellipsis">{nb?.title} · {fmtRelative(n.openedAt || n.updatedAt)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function MemosWidget() {
  const memos = useLiveQuery(() => db.memos.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const add = async () => {
    if (!text.trim()) return;
    await db.memos.add({ id: uid(), text: text.trim(), color: '#fbdbe4', dueAt: due, done: false, createdAt: Date.now() });
    setText('');
    setDue('');
  };
  const today = todayISO();
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><StickyNote size={18} />Promemoria</h3></div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ricordami di…" />
        <button className="icon-btn" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }} aria-label="Aggiungi"><Plus size={20} /></button>
      </form>
      <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ marginTop: 8, minHeight: 38 }} aria-label="Scadenza (facoltativa)" />
      <div style={{ marginTop: 10 }}>
        {memos.map((m) => (
          <div key={m.id} className="list-row" style={{ minHeight: 44 }}>
            <input type="checkbox" className="checkbox" checked={m.done} onChange={(e) => db.memos.update(m.id, { done: e.target.checked })} />
            <div className="grow">
              <div style={{ textDecoration: m.done ? 'line-through' : undefined, color: m.done ? 'var(--muted)' : undefined }}>{m.text}</div>
              {m.dueAt && <div className="tiny" style={{ color: !m.done && m.dueAt <= today ? 'var(--danger)' : 'var(--muted)' }}><Bell size={10} /> {fromISO(m.dueAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>}
            </div>
            <button className="icon-btn sm danger" onClick={() => db.memos.delete(m.id)} aria-label="Elimina"><X size={16} /></button>
          </div>
        ))}
        {memos.length === 0 && <p className="small muted" style={{ textAlign: 'center' }}>Le piccole cose da non dimenticare vanno qui.</p>}
      </div>
    </div>
  );
}

function FilesWidget() {
  const files = useLiveQuery(async () => {
    const fav = await db.files.filter((f) => f.favorite).toArray();
    const recent = await db.files.orderBy('createdAt').reverse().limit(8).toArray();
    const seen = new Set<string>();
    return [...fav, ...recent].filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true))).slice(0, 8);
  }, []);
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><FolderHeart size={18} />Accesso rapido ai documenti</h3>
        <Link to="/archivio" className="btn btn-sm btn-ghost">Archivio</Link>
      </div>
      {!files?.length ? (
        <Empty title="Archivio vuoto" text="Carica PDF, documenti Word, fogli Excel e immagini: restano salvati qui." action={<Link className="btn btn-soft" to="/archivio">Carica file</Link>} />
      ) : (
        <div className="file-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {files.map((f) => (
            <button key={f.id} className="file-tile" onClick={() => openBlob(f.blob)} style={{ padding: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="q-ico" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: CATEGORY_COLOR[f.category] + '22', color: CATEGORY_COLOR[f.category] }}><FileText size={18} /></span>
                <div className="grow">
                  <div className="file-name">{f.name}</div>
                  <div className="file-meta">{fmtSize(f.size)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CalcWidget() {
  const [expr, setExpr] = useState('');
  const result = useMemo(() => {
    if (!expr.trim()) return '';
    try {
      return '= ' + formatValue(calc(expr));
    } catch {
      return '…';
    }
  }, [expr]);
  const save = async () => {
    try {
      const v = calc(expr);
      await db.calcHistory.add({ expression: expr, result: formatValue(v), source: 'calcolatrice', createdAt: Date.now() });
      setExpr(String(typeof v === 'number' ? v : v));
    } catch { /* ignore */ }
  };
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><Calculator size={18} />Calcolo veloce</h3>
        <Link to="/calcoli" className="btn btn-sm btn-ghost">Apri</Link>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <input className="input" inputMode="decimal" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="Es. 1250 * 22% oppure √144 + 2^3" />
      </form>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginTop: 12, minHeight: 48, color: 'var(--primary-strong)', wordBreak: 'break-all' }}>{result}</div>
      <p className="tiny muted">Premi Invio per salvare il calcolo nello storico.</p>
    </div>
  );
}

function StudyWidget({ scale }: { scale: number }) {
  const data = useLiveQuery(async () => {
    const exams = await db.exams.toArray();
    const next = exams.filter((e) => e.status === 'da-sostenere' && e.date && e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date))[0];
    const today = todayISO();
    const focus = (await db.focus.where('date').equals(today).toArray()).reduce((s, f) => s + f.minutes, 0);
    return { stats: examStats(exams, scale), next, focus };
  }, [scale]);
  const days = data?.next ? Math.round((fromISO(data.next.date).getTime() - fromISO(todayISO()).getTime()) / 86400000) : null;
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><GraduationCap size={18} />Studio</h3>
        <Link to="/studio" className="btn btn-sm btn-ghost">Apri</Link>
      </div>
      <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
        <div className="stat"><b>{data?.stats.weighted ? data.stats.weighted.toFixed(2).replace('.', ',') : '—'}</b><span>media ponderata</span></div>
        <div className="stat"><b>{data?.stats.cfu ?? 0}</b><span>CFU</span></div>
        <div className="stat"><b>{data?.focus ?? 0}′</b><span>focus oggi</span></div>
      </div>
      <div className="divider" />
      {data?.next ? (
        <div><div className="small muted">Prossimo esame</div><b>{data.next.name}</b><div className="small">{days === 0 ? 'Oggi! In bocca al lupo 🍀' : `tra ${days} giorn${days === 1 ? 'o' : 'i'}`}</div></div>
      ) : <div className="small muted">Aggiungi gli esami nel libretto per vedere il conto alla rovescia.</div>}
    </div>
  );
}

function WellnessWidget({ goal }: { goal: number }) {
  const today = todayISO();
  const log = useLiveQuery(() => db.dayLogs.get(today), [today]);
  const water = log?.water ?? 0;
  const setWater = async (n: number) => {
    const cur = (await db.dayLogs.get(today)) ?? { date: today, mood: 0, water: 0, sleep: 0, period: false, journal: '', gratitude: '' };
    await db.dayLogs.put({ ...cur, water: Math.max(0, n) });
  };
  const setMood = async (m: number) => {
    const cur = (await db.dayLogs.get(today)) ?? { date: today, mood: 0, water: 0, sleep: 0, period: false, journal: '', gratitude: '' };
    await db.dayLogs.put({ ...cur, mood: m });
  };
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><Droplet size={18} />Benessere di oggi</h3>
        <Link to="/benessere" className="btn btn-sm btn-ghost">Apri</Link>
      </div>
      <div className="small muted" style={{ marginBottom: 6 }}>Come ti senti?</div>
      <div className="mood-row">
        {['😣', '😕', '😐', '🙂', '🥰'].map((e, i) => (
          <button key={i} className={'mood-btn' + (log?.mood === i + 1 ? ' active' : '')} style={{ width: 44, height: 44, fontSize: '1.3rem' }} onClick={() => setMood(i + 1)}>{e}</button>
        ))}
      </div>
      <div className="small muted" style={{ margin: '12px 0 6px' }}>Acqua: {water}/{goal} bicchieri</div>
      <div className="row">
        <button className="icon-btn sm" onClick={() => setWater(water - 1)} aria-label="Meno"><Minus size={14} /></button>
        <div className="grow"><div className="progress"><div style={{ width: `${Math.min(100, (water / goal) * 100)}%`, background: 'linear-gradient(90deg, var(--blue), var(--lilac))' }} /></div></div>
        <button className="icon-btn sm" style={{ background: 'var(--blue-soft)', color: 'var(--blue-strong)' }} onClick={() => setWater(water + 1)} aria-label="Più"><Plus size={16} /></button>
      </div>
    </div>
  );
}

function HeroEditor({ s, onClose }: { s: Settings; onClose: () => void }) {
  const ui = useUI();
  const [name, setName] = useState(s.name);
  const [greeting, setGreeting] = useState(s.greeting === 'auto' ? '' : s.greeting);
  const [quote, setQuote] = useState(s.quote);
  const [author, setAuthor] = useState(s.quoteAuthor);
  const [rotate, setRotate] = useState(s.rotateQuotes);
  const [accent, setAccent] = useState(s.accent);
  const save = async () => {
    await setSettings({ name: name.trim(), greeting: greeting.trim() || 'auto', quote: quote.trim() || s.quote, quoteAuthor: author.trim(), rotateQuotes: rotate, accent });
    ui.toast('Dashboard aggiornata');
    onClose();
  };
  return (
    <Modal title="Personalizza la tua home" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button></>}>
      <div className="stack">
        <label className="field"><span>Il tuo nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Come vuoi essere chiamata?" /></label>
        <label className="field"><span>Saluto (vuoto = automatico: Buongiorno / Buonasera…)</span><input className="input" value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Ciao bellissima" /></label>
        <div className="row"><input type="checkbox" className="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} id="rot" /><label htmlFor="rot">Una frase motivazionale diversa ogni giorno</label></div>
        {!rotate && <>
          <label className="field"><span>La tua frase</span><textarea className="textarea" value={quote} onChange={(e) => setQuote(e.target.value)} rows={2} /></label>
          <label className="field"><span>Autore (facoltativo)</span><input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
        </>}
        <div className="field"><span>Colore principale (tema Rosa)</span><Swatches value={accent} onChange={setAccent} /></div>
      </div>
    </Modal>
  );
}
