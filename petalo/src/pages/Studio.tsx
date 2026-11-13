import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Award, Coffee, GraduationCap, Pause, Pencil, Play, Plus, RotateCcw, Timer, Trash2 } from 'lucide-react';
import { db, uid } from '../db/db';
import type { Exam } from '../db/types';
import { examStats } from '../lib/exams';
import { setSettings, useSettings } from '../db/settings';
import { addDays, fromISO, toISO, todayISO } from '../lib/dates';
import { showSystemNotification } from '../lib/notify';
import { Empty, Modal, useUI } from '../components/ui';

export default function Studio() {
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Studio ed esami</h1><p>Il tuo libretto con medie automatiche e un timer per concentrarti.</p></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
        <Libretto />
        <Focus />
      </div>
    </div>
  );
}

function Libretto() {
  const s = useSettings();
  const ui = useUI();
  const exams = useLiveQuery(() => db.exams.toArray(), []) ?? [];
  const notebooks = useLiveQuery(() => db.notebooks.toArray(), []) ?? [];
  const [edit, setEdit] = useState<Exam | null>(null);
  const st = examStats(exams, s.graduationScale);
  const sorted = [...exams].sort((a, b) => (a.status === b.status ? (b.date || '').localeCompare(a.date || '') : a.status === 'da-sostenere' ? -1 : 1));
  const blank = (): Exam => ({ id: '', name: '', cfu: 6, grade: 0, date: '', status: 'da-sostenere', notebookId: null, notes: '', createdAt: 0 });
  const fmt = (n: number) => (n ? n.toFixed(2).replace('.', ',') : '—');

  return (
    <div className="card">
      <div className="card-head">
        <h3><GraduationCap size={18} />Libretto universitario</h3>
        <button className="btn btn-sm btn-primary" onClick={() => setEdit(blank())}><Plus size={15} />Esame</button>
      </div>
      <div className="row wrap" style={{ gap: 26, marginBottom: 16 }}>
        <div className="stat"><b>{fmt(st.weighted)}</b><span>media ponderata</span></div>
        <div className="stat"><b>{fmt(st.arithmetic)}</b><span>media aritmetica</span></div>
        <div className="stat"><b>{st.cfu}</b><span>CFU acquisiti</span></div>
        <div className="stat"><b>{fmt(st.base)}</b><span>base di laurea /{s.graduationScale}</span></div>
        {st.lodi > 0 && <div className="stat"><b>{st.lodi}</b><span>lodi</span></div>}
      </div>
      <div className="row small" style={{ marginBottom: 12 }}>
        <span className="muted">Scala voto di laurea:</span>
        <div className="seg">
          {([110, 100] as const).map((v) => <button key={v} className={s.graduationScale === v ? 'active' : ''} onClick={() => setSettings({ graduationScale: v })}>/{v}</button>)}
        </div>
      </div>
      {exams.length === 0 ? <Empty title="Libretto vuoto" text="Aggiungi gli esami superati (con voto e CFU) e quelli da sostenere: le medie si calcolano da sole." /> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="exam-table">
            <thead><tr><th>Esame</th><th>CFU</th><th>Voto</th><th>Data</th><th /></tr></thead>
            <tbody>
              {sorted.map((e) => {
                const days = e.status === 'da-sostenere' && e.date ? Math.round((fromISO(e.date).getTime() - fromISO(todayISO()).getTime()) / 86400000) : null;
                return (
                  <tr key={e.id}>
                    <td><b>{e.name}</b>{e.status === 'da-sostenere' && <div className="tiny" style={{ color: 'var(--primary-strong)' }}>{days === null ? 'da sostenere' : days < 0 ? 'data passata: aggiorna l’esito' : days === 0 ? 'oggi!' : `tra ${days} giorni`}</div>}</td>
                    <td>{e.cfu}</td>
                    <td>{e.status === 'superato' ? <span className="grade">{e.grade === 31 ? '30L' : e.grade === 0 ? 'Id.' : e.grade}</span> : <span className="muted">—</span>}</td>
                    <td className="small">{e.date ? fromISO(e.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' }) : ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="icon-btn sm" onClick={() => setEdit(e)} aria-label="Modifica"><Pencil size={15} /></button>
                      <button className="icon-btn sm danger" onClick={async () => { if (await ui.confirm({ title: `Eliminare “${e.name}”?`, ok: 'Elimina', danger: true })) await db.exams.delete(e.id); }} aria-label="Elimina"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <ExamEditor exam={edit} notebooks={notebooks.map((n) => ({ id: n.id, title: n.title }))} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ExamEditor({ exam, notebooks, onClose }: { exam: Exam; notebooks: { id: string; title: string }[]; onClose: () => void }) {
  const ui = useUI();
  const [e, setE] = useState(exam);
  const [addToAgenda, setAddToAgenda] = useState(!exam.id);
  const save = async () => {
    if (!e.name.trim()) { ui.toast('Scrivi il nome dell’esame', true); return; }
    if (e.status === 'superato' && e.grade !== 0 && (e.grade < 18 || e.grade > 31)) { ui.toast('Il voto va da 18 a 30 (o 30 e lode)', true); return; }
    const rec = { ...e, name: e.name.trim(), id: e.id || uid(), createdAt: e.createdAt || Date.now() };
    await db.exams.put(rec);
    if (addToAgenda && e.date && e.status === 'da-sostenere') {
      const cat = await db.categories.filter((c) => c.name === 'Esami').first();
      await db.events.add({
        id: uid(), title: `Esame: ${rec.name}`, description: `${rec.cfu} CFU`, notes: rec.notes, location: '', date: e.date, startTime: '09:00', endTime: '12:00',
        allDay: false, categoryId: cat?.id ?? null, reminder: 1440, repeat: 'none', notified: [], createdAt: Date.now(), updatedAt: Date.now(),
      });
      ui.toast('Esame aggiunto anche in agenda (con promemoria il giorno prima)');
    }
    onClose();
  };
  return (
    <Modal title={exam.id ? 'Modifica esame' : 'Nuovo esame'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button></>}>
      <div className="stack">
        <label className="field"><span>Nome dell’esame</span><input className="input" autoFocus value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} placeholder="Es. Microeconomia" /></label>
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          <button className={e.status === 'da-sostenere' ? 'active' : ''} onClick={() => setE({ ...e, status: 'da-sostenere' })}>Da sostenere</button>
          <button className={e.status === 'superato' ? 'active' : ''} onClick={() => setE({ ...e, status: 'superato', grade: e.grade || 28 })}>Superato</button>
        </div>
        <div className="field-row">
          <label className="field"><span>CFU</span><input className="input" type="number" min={1} max={30} value={e.cfu} onChange={(x) => setE({ ...e, cfu: Number(x.target.value) || 0 })} /></label>
          {e.status === 'superato' && (
            <label className="field"><span>Voto</span>
              <select className="select" value={e.grade} onChange={(x) => setE({ ...e, grade: Number(x.target.value) })}>
                {Array.from({ length: 13 }, (_, i) => 18 + i).map((g) => <option key={g} value={g}>{g}</option>)}
                <option value={31}>30 e lode</option>
                <option value={0}>Idoneità (senza voto)</option>
              </select>
            </label>
          )}
          <label className="field"><span>{e.status === 'superato' ? 'Data' : 'Data appello'}</span><input className="input" type="date" value={e.date} onChange={(x) => setE({ ...e, date: x.target.value })} /></label>
        </div>
        {notebooks.length > 0 && (
          <label className="field"><span>Quaderno collegato</span>
            <select className="select" value={e.notebookId ?? ''} onChange={(x) => setE({ ...e, notebookId: x.target.value || null })}>
              <option value="">Nessuno</option>{notebooks.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>Note</span><textarea className="textarea" value={e.notes} onChange={(x) => setE({ ...e, notes: x.target.value })} placeholder="Programma, libri, modalità d’esame…" /></label>
        {!exam.id && e.status === 'da-sostenere' && e.date && (
          <div className="row"><input type="checkbox" className="checkbox" checked={addToAgenda} onChange={(x) => setAddToAgenda(x.target.checked)} id="ag" /><label htmlFor="ag">Aggiungi anche in agenda con promemoria</label></div>
        )}
      </div>
    </Modal>
  );
}

function Focus() {
  const s = useSettings();
  const ui = useUI();
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(s.focusMinutes * 60);
  const [label, setLabel] = useState('');
  const endAt = useRef<number | null>(null);
  const total = (mode === 'focus' ? s.focusMinutes : s.breakMinutes) * 60;

  const week = useLiveQuery(async () => {
    const days = Array.from({ length: 7 }, (_, i) => toISO(addDays(new Date(), i - 6)));
    const rows = await db.focus.where('date').anyOf(days).toArray();
    return days.map((d) => ({ d, m: rows.filter((r) => r.date === d).reduce((x, r) => x + r.minutes, 0) }));
  }, []) ?? [];
  const max = Math.max(60, ...week.map((w) => w.m));

  useEffect(() => { if (!running) setLeft(total); }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    if (!endAt.current) endAt.current = Date.now() + left * 1000;
    const t = setInterval(async () => {
      const rem = Math.max(0, Math.round((endAt.current! - Date.now()) / 1000));
      setLeft(rem);
      if (rem === 0) {
        clearInterval(t);
        setRunning(false);
        endAt.current = null;
        if (mode === 'focus') {
          await db.focus.add({ date: todayISO(), minutes: s.focusMinutes, label, createdAt: Date.now() });
          ui.toast('Sessione completata! Fai una pausa ☕');
          void showSystemNotification('Sessione di studio completata', 'È il momento di una pausa.');
          setMode('break');
        } else {
          ui.toast('Pausa finita: si riparte!');
          void showSystemNotification('Pausa finita', 'Pronta per un’altra sessione?');
          setMode('focus');
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    if (running) { setRunning(false); endAt.current = null; }
    else setRunning(true);
  };
  const reset = () => { setRunning(false); endAt.current = null; setLeft(total); };
  const pct = 1 - left / total;
  const R = 108;
  const C = 2 * Math.PI * R;

  return (
    <div className="card">
      <div className="card-head">
        <h3><Timer size={18} />Timer di concentrazione</h3>
        <div className="seg">
          <button className={mode === 'focus' ? 'active' : ''} onClick={() => { if (!running) setMode('focus'); }}>Studio</button>
          <button className={mode === 'break' ? 'active' : ''} onClick={() => { if (!running) setMode('break'); }}><Coffee size={13} style={{ verticalAlign: -2 }} /> Pausa</button>
        </div>
      </div>
      <div className="ring" style={{ margin: '8px auto 16px', width: 250, height: 250 }}>
        <svg width="250" height="250">
          <circle cx="125" cy="125" r={R} stroke="var(--surface-3)" strokeWidth="14" fill="none" />
          <circle cx="125" cy="125" r={R} stroke={mode === 'focus' ? 'var(--primary)' : 'var(--blue)'} strokeWidth="14" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .5s linear' }} />
        </svg>
        <div className="center">
          <div className="timer-big">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</div>
          <div className="small muted">{mode === 'focus' ? 'concentrazione' : 'pausa'}</div>
        </div>
      </div>
      <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Cosa stai studiando? (facoltativo)" style={{ marginBottom: 12 }} />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={toggle} style={{ minWidth: 140 }}>{running ? <><Pause size={18} />Pausa</> : <><Play size={18} />Avvia</>}</button>
        <button className="btn" onClick={reset}><RotateCcw size={16} />Azzera</button>
      </div>
      <div className="row small" style={{ justifyContent: 'center', marginTop: 12, gap: 14 }}>
        <label className="row">Studio <input className="input" type="number" min={5} max={180} value={s.focusMinutes} onChange={(e) => setSettings({ focusMinutes: Math.max(1, Number(e.target.value) || 25) })} style={{ width: 70, minHeight: 36 }} /> min</label>
        <label className="row">Pausa <input className="input" type="number" min={1} max={60} value={s.breakMinutes} onChange={(e) => setSettings({ breakMinutes: Math.max(1, Number(e.target.value) || 5) })} style={{ width: 70, minHeight: 36 }} /> min</label>
      </div>
      <div className="divider" />
      <div className="row between"><b className="small"><Award size={14} style={{ verticalAlign: -2 }} /> Ultimi 7 giorni</b><span className="small muted">{week.reduce((a, w) => a + w.m, 0)} minuti</span></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110, marginTop: 10 }}>
        {week.map((w) => (
          <div key={w.d} style={{ flex: 1, textAlign: 'center' }}>
            <div title={`${w.m} min`} style={{ height: Math.max(4, (w.m / max) * 84), background: w.d === todayISO() ? 'var(--primary)' : 'var(--primary-soft)', borderRadius: 8 }} />
            <div className="tiny muted" style={{ marginTop: 4 }}>{fromISO(w.d).toLocaleDateString('it-IT', { weekday: 'narrow' })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
