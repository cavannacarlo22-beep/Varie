import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Droplet, Flower2, GlassWater, Heart, Moon, Plus, Sparkles, Trash2 } from 'lucide-react';
import { db, uid } from '../db/db';
import type { DayLog, Habit } from '../db/types';
import { setSettings, useSettings } from '../db/settings';
import { addDays, addMonths, fmtMonth, fromISO, isSameDay, monthMatrix, startOfWeek, toISO, todayISO, weekdayNames } from '../lib/dates';
import { Modal, Swatches, useUI } from '../components/ui';

const MOODS = ['😣', '😕', '😐', '🙂', '🥰'];
const MOOD_LABEL = ['Difficile', 'Così così', 'Normale', 'Bene', 'Benissimo'];

const emptyLog = (date: string): DayLog => ({ date, mood: 0, water: 0, sleep: 0, period: false, journal: '', gratitude: '' });

async function patchLog(date: string, patch: Partial<DayLog>) {
  const cur = (await db.dayLogs.get(date)) ?? emptyLog(date);
  await db.dayLogs.put({ ...cur, ...patch });
}

export default function Benessere() {
  const [date, setDate] = useState(todayISO());
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Benessere</h1><p>Umore, diario, acqua, sonno, abitudini e ciclo: prenditi cura di te.</p></div>
        <div className="row">
          <button className="icon-btn" onClick={() => setDate(toISO(addDays(fromISO(date), -1)))} aria-label="Giorno precedente"><ChevronLeft /></button>
          <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 'auto' }} />
          <button className="icon-btn" onClick={() => setDate(toISO(addDays(fromISO(date), 1)))} aria-label="Giorno successivo"><ChevronRight /></button>
        </div>
      </div>
      <div className="dash-grid" style={{ marginTop: 0 }}>
        <div className="span-6"><Day date={date} /></div>
        <div className="span-6"><Habits /></div>
        <div className="span-6"><Cycle /></div>
        <div className="span-6"><MoodMonth /></div>
      </div>
    </div>
  );
}

function Day({ date }: { date: string }) {
  const s = useSettings();
  const log = useLiveQuery(() => db.dayLogs.get(date), [date]) ?? emptyLog(date);
  const [journal, setJournal] = useState(log.journal);
  const [grat, setGrat] = useState(log.gratitude);
  useEffect(() => { setJournal(log.journal); setGrat(log.gratitude); }, [date, log.journal, log.gratitude]);
  useEffect(() => {
    if (journal === log.journal && grat === log.gratitude) return;
    const t = setTimeout(() => void patchLog(date, { journal, gratitude: grat }), 500);
    return () => clearTimeout(t);
  }, [journal, grat]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head"><h3><Heart size={18} />{date === todayISO() ? 'Oggi' : fromISO(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div>
      <div className="label" style={{ marginBottom: 6 }}>Come ti senti?</div>
      <div className="mood-row">
        {MOODS.map((m, i) => <button key={i} className={'mood-btn' + (log.mood === i + 1 ? ' active' : '')} onClick={() => patchLog(date, { mood: log.mood === i + 1 ? 0 : i + 1 })} title={MOOD_LABEL[i]}>{m}</button>)}
      </div>
      <div className="label" style={{ margin: '16px 0 6px' }}><GlassWater size={14} style={{ verticalAlign: -2 }} /> Acqua · {log.water}/{s.waterGoal} bicchieri</div>
      <div className="water">
        {Array.from({ length: Math.max(s.waterGoal, log.water) }, (_, i) => (
          <button key={i} className={i < log.water ? 'on' : ''} onClick={() => patchLog(date, { water: i + 1 === log.water ? i : i + 1 })} aria-label={`${i + 1} bicchieri`}>
            <Droplet size={30} fill={i < log.water ? 'currentColor' : 'none'} />
          </button>
        ))}
        <button onClick={() => patchLog(date, { water: log.water + 1 })} aria-label="Un bicchiere in più" style={{ color: 'var(--muted)' }}><Plus size={22} /></button>
      </div>
      <label className="row small" style={{ marginTop: 6 }}>Obiettivo <input className="input" type="number" min={1} max={20} value={s.waterGoal} onChange={(e) => setSettings({ waterGoal: Math.max(1, Number(e.target.value) || 8) })} style={{ width: 70, minHeight: 34 }} /></label>
      <div className="label" style={{ margin: '16px 0 6px' }}><Moon size={14} style={{ verticalAlign: -2 }} /> Ore di sonno</div>
      <div className="row"><input type="range" min={0} max={12} step={0.5} value={log.sleep} onChange={(e) => patchLog(date, { sleep: Number(e.target.value) })} className="grow" /><b>{String(log.sleep).replace('.', ',')} h</b></div>
      <label className="field" style={{ marginTop: 16 }}><span>Diario</span><textarea className="textarea" value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="Com’è andata la giornata?" rows={4} /></label>
      <label className="field" style={{ marginTop: 10 }}><span><Sparkles size={13} style={{ verticalAlign: -2 }} /> Tre cose belle di oggi</span><textarea className="textarea" value={grat} onChange={(e) => setGrat(e.target.value)} rows={3} /></label>
    </div>
  );
}

function Habits() {
  const ui = useUI();
  const habits = useLiveQuery(() => db.habits.orderBy('order').filter((h) => !h.archived).toArray(), []) ?? [];
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const logs = useLiveQuery(() => db.habitLogs.where('date').between(toISO(days[0]), toISO(days[6]), true, true).toArray(), [weekStart.getTime()]) ?? [];
  const done = new Set(logs.map((l) => l.id));
  const [adding, setAdding] = useState<Habit | null>(null);
  const toggle = async (h: Habit, d: Date) => {
    const id = `${h.id}|${toISO(d)}`;
    if (done.has(id)) await db.habitLogs.delete(id);
    else await db.habitLogs.put({ id, habitId: h.id, date: toISO(d) });
  };
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><Sparkles size={18} />Abitudini</h3>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn sm" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Settimana precedente"><ChevronLeft size={16} /></button>
          <button className="icon-btn sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Settimana successiva"><ChevronRight size={16} /></button>
          <button className="btn btn-sm btn-soft" onClick={() => setAdding({ id: '', name: '', emoji: '💧', color: '#7fbfe8', order: habits.length, archived: false, createdAt: 0 })}><Plus size={14} />Nuova</button>
        </div>
      </div>
      {habits.length === 0 ? (
        <p className="small muted">Aggiungi le abitudini che vuoi coltivare: leggere 20 minuti, skincare, camminare, ripassare…</p>
      ) : (
        <div className="habit-grid">
          <span />
          {days.map((d) => <div key={d.toISOString()} className="tiny muted" style={{ textAlign: 'center', fontWeight: isSameDay(d, new Date()) ? 800 : 500 }}>{d.toLocaleDateString('it-IT', { weekday: 'narrow' })}<br />{d.getDate()}</div>)}
          {habits.map((h) => (
            <HabitRow key={h.id} h={h} days={days} done={done} onToggle={toggle} onDelete={async () => {
              if (await ui.confirm({ title: `Eliminare “${h.name}”?`, ok: 'Elimina', danger: true })) {
                await db.habitLogs.where('habitId').equals(h.id).delete();
                await db.habits.delete(h.id);
              }
            }} />
          ))}
        </div>
      )}
      {adding && <HabitEditor h={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function HabitRow({ h, days, done, onToggle, onDelete }: { h: Habit; days: Date[]; done: Set<string>; onToggle: (h: Habit, d: Date) => void; onDelete: () => void }) {
  return (
    <>
      <div className="row" style={{ gap: 6, minWidth: 0 }}>
        <span>{h.emoji}</span><span className="ellipsis small grow" style={{ fontWeight: 600 }}>{h.name}</span>
        <button className="icon-btn sm danger" onClick={onDelete} aria-label="Elimina abitudine" style={{ width: 28, height: 28 }}><Trash2 size={13} /></button>
      </div>
      {days.map((d) => {
        const on = done.has(`${h.id}|${toISO(d)}`);
        return <button key={d.toISOString()} className={'habit-cell' + (on ? ' on' : '')} style={on ? { background: h.color } : undefined} onClick={() => onToggle(h, d)} aria-label={`${h.name} ${d.toLocaleDateString('it-IT')}`}>{on ? '✓' : ''}</button>;
      })}
    </>
  );
}

function HabitEditor({ h, onClose }: { h: Habit; onClose: () => void }) {
  const [x, setX] = useState(h);
  const save = async () => {
    if (!x.name.trim()) return;
    await db.habits.put({ ...x, name: x.name.trim(), id: x.id || uid(), createdAt: x.createdAt || Date.now() });
    onClose();
  };
  return (
    <Modal title="Nuova abitudine" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button></>}>
      <div className="stack">
        <input className="input" autoFocus value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} placeholder="Es. Leggere 20 minuti" onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="chips">{['💧', '📖', '🧘‍♀️', '🏃‍♀️', '🥗', '💤', '🧴', '💊', '✍️', '🎧', '🌿', '📵'].map((e) => <button key={e} className={'chip' + (x.emoji === e ? ' active' : '')} style={{ fontSize: '1.15rem', padding: '0 9px' }} onClick={() => setX({ ...x, emoji: e })}>{e}</button>)}</div>
        <Swatches value={x.color} onChange={(c) => setX({ ...x, color: c })} />
      </div>
    </Modal>
  );
}

/** Groups consecutive period days into cycles and estimates the next one. */
export function cycleInfo(periodDays: string[]) {
  const sorted = [...new Set(periodDays)].sort();
  const starts: string[] = [];
  let prev: Date | null = null;
  for (const d of sorted) {
    const cur = fromISO(d);
    if (!prev || (cur.getTime() - prev.getTime()) / 86400000 > 2) starts.push(d);
    prev = cur;
  }
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = Math.round((fromISO(starts[i]).getTime() - fromISO(starts[i - 1]).getTime()) / 86400000);
    if (len >= 18 && len <= 45) lengths.push(len);
  }
  const recent = lengths.slice(-6);
  const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 28;
  const last = starts[starts.length - 1];
  const next = last ? toISO(addDays(fromISO(last), avg)) : null;
  return { starts, avg, last, next, measured: recent.length > 0 };
}

function Cycle() {
  const [cursor, setCursor] = useState(new Date());
  const logs = useLiveQuery(() => db.dayLogs.filter((l) => l.period).toArray(), []) ?? [];
  const period = new Set(logs.map((l) => l.date));
  const info = useMemo(() => cycleInfo([...period]), [logs]); // eslint-disable-line react-hooks/exhaustive-deps
  const predicted = new Set<string>();
  const fertile = new Set<string>();
  if (info.next) {
    for (let k = 0; k < 3; k++) {
      const start = addDays(fromISO(info.next), info.avg * k);
      for (let i = 0; i < 5; i++) predicted.add(toISO(addDays(start, i)));
      const ov = addDays(start, -14);
      for (let i = -4; i <= 1; i++) fertile.add(toISO(addDays(ov, i)));
    }
  }
  const days = monthMatrix(cursor);
  const today = todayISO();
  const daysTo = info.next ? Math.round((fromISO(info.next).getTime() - fromISO(today).getTime()) / 86400000) : null;
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><Flower2 size={18} />Ciclo</h3>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mese precedente"><ChevronLeft size={16} /></button>
          <b className="small" style={{ textTransform: 'capitalize', minWidth: 110, textAlign: 'center' }}>{fmtMonth(cursor)}</b>
          <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Mese successivo"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="cycle-cal">
        {weekdayNames(true, 'narrow').map((w, i) => <div key={i} className="tiny muted" style={{ textAlign: 'center' }}>{w}</div>)}
        {days.map((d) => {
          const iso = toISO(d);
          const cls = [period.has(iso) ? 'period' : predicted.has(iso) ? 'predicted' : fertile.has(iso) ? 'fertile' : '', iso === today ? 'today' : ''].join(' ');
          return (
            <button key={iso} className={cls} style={{ opacity: d.getMonth() === cursor.getMonth() ? 1 : 0.35 }} onClick={() => patchLog(iso, { period: !period.has(iso) })}>{d.getDate()}</button>
          );
        })}
      </div>
      <div className="row wrap small" style={{ gap: 14, marginTop: 12 }}>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--primary)' }} />Mestruazioni</span>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--primary-soft)', boxShadow: 'inset 0 0 0 2px var(--primary-soft)' }} />Previste</span>
        <span className="row" style={{ gap: 5 }}><span className="dot" style={{ background: 'var(--blue-soft)' }} />Finestra fertile stimata</span>
      </div>
      <div className="divider" />
      {info.last ? (
        <p className="small" style={{ margin: 0 }}>
          Durata media del ciclo: <b>{info.avg} giorni</b>{!info.measured && ' (stima predefinita: segna almeno due cicli per un calcolo personale)'}.<br />
          {daysTo !== null && (daysTo > 0 ? <>Prossimo ciclo previsto tra <b>{daysTo} giorni</b> ({fromISO(info.next!).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}).</> : daysTo === 0 ? <>Il ciclo è previsto <b>oggi</b>.</> : <>Il ciclo previsto è in ritardo di {-daysTo} giorni.</>)}
        </p>
      ) : <p className="small muted" style={{ margin: 0 }}>Tocca i giorni del ciclo per segnarli: Petalo stimerà il prossimo.</p>}
      <p className="tiny muted" style={{ marginBottom: 0 }}>Le previsioni sono indicative e non sostituiscono il parere medico né un metodo contraccettivo.</p>
    </div>
  );
}

function MoodMonth() {
  const [cursor, setCursor] = useState(new Date());
  const days = monthMatrix(cursor);
  const logs = useLiveQuery(() => db.dayLogs.where('date').between(toISO(days[0]), toISO(days[41]), true, true).toArray(), [cursor.getMonth(), cursor.getFullYear()]) ?? [];
  const map = new Map(logs.map((l) => [l.date, l]));
  const inMonth = logs.filter((l) => fromISO(l.date).getMonth() === cursor.getMonth() && l.mood);
  const avg = inMonth.length ? inMonth.reduce((a, l) => a + l.mood, 0) / inMonth.length : 0;
  const sleepDays = logs.filter((l) => l.sleep > 0 && fromISO(l.date).getMonth() === cursor.getMonth());
  const sleepAvg = sleepDays.length ? sleepDays.reduce((a, l) => a + l.sleep, 0) / sleepDays.length : 0;
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-head">
        <h3><Heart size={18} />Il tuo mese</h3>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mese precedente"><ChevronLeft size={16} /></button>
          <b className="small" style={{ textTransform: 'capitalize', minWidth: 110, textAlign: 'center' }}>{fmtMonth(cursor)}</b>
          <button className="icon-btn sm" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Mese successivo"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="cycle-cal">
        {weekdayNames(true, 'narrow').map((w, i) => <div key={i} className="tiny muted" style={{ textAlign: 'center' }}>{w}</div>)}
        {days.map((d) => {
          const l = map.get(toISO(d));
          return <div key={d.toISOString()} style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', fontSize: l?.mood ? '1.25rem' : '.8rem', opacity: d.getMonth() === cursor.getMonth() ? 1 : 0.3, color: 'var(--muted)' }} title={l?.journal}>{l?.mood ? MOODS[l.mood - 1] : d.getDate()}</div>;
        })}
      </div>
      <div className="row wrap" style={{ gap: 24, marginTop: 12 }}>
        <div className="stat"><b>{avg ? MOODS[Math.round(avg) - 1] : '—'}</b><span>umore medio</span></div>
        <div className="stat"><b>{inMonth.length}</b><span>giorni registrati</span></div>
        <div className="stat"><b>{sleepAvg ? sleepAvg.toFixed(1).replace('.', ',') + ' h' : '—'}</b><span>sonno medio</span></div>
      </div>
    </div>
  );
}
