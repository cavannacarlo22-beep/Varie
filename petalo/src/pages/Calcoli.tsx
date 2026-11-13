import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Calculator, Columns3, Copy, Download, FileSpreadsheet, HelpCircle, History,
  MoreHorizontal, Pencil, Plus, Rows3, Sigma, Trash2, Undo2, Upload,
} from 'lucide-react';
import { db, uid } from '../db/db';
import type { Sheet } from '../db/types';
import { calc, formatValue, FUNCTION_HELP, FormulaError } from '../lib/formula';
import { addr, colName, computeSheet, fromCSV, remapCells, shiftFormula, toCSV } from '../lib/sheet';
import { download, pickFiles } from '../lib/files';
import { fmtRelative } from '../lib/dates';
import { Empty, Modal, useMenu, useUI } from '../components/ui';

export default function Calcoli() {
  const [tab, setTab] = useState<'calc' | 'sheet' | 'history'>('calc');
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calcoli matematici</h1>
          <p>Calcolatrice, tabelle con formule e storico di tutto quello che hai calcolato.</p>
        </div>
        <div className="seg">
          <button className={tab === 'calc' ? 'active' : ''} onClick={() => setTab('calc')}><Calculator size={15} style={{ verticalAlign: -2 }} /> Calcolatrice</button>
          <button className={tab === 'sheet' ? 'active' : ''} onClick={() => setTab('sheet')}><FileSpreadsheet size={15} style={{ verticalAlign: -2 }} /> Tabelle</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={15} style={{ verticalAlign: -2 }} /> Storico</button>
        </div>
      </div>
      {tab === 'calc' && <CalculatorView />}
      {tab === 'sheet' && <Sheets />}
      {tab === 'history' && <HistoryView full />}
    </div>
  );
}

/* ———————————————— Calculator ———————————————— */

function CalculatorView() {
  const ui = useUI();
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<{ text: string; err?: boolean } | null>(null);
  const [sci, setSci] = useState(false);
  const [deg, setDeg] = useState(true);
  const memory = useLiveQuery(async () => ((await db.settings.get('calcMemory'))?.value as number) ?? 0, []) ?? 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAns = useRef<number>(0);

  const prepared = (e: string) => {
    let x = e.replace(/\bAns\b/g, `(${lastAns.current})`);
    if (deg) x = x.replace(/\b(sin|cos|tan)\(/gi, (_m, f: string) => `${f}(RADIANTI(1)*`);
    return x;
  };
  const preview = useMemo(() => {
    if (!expr.trim()) return '';
    try {
      return formatValue(calc(prepared(expr)));
    } catch {
      return '';
    }
  }, [expr, deg]); // eslint-disable-line react-hooks/exhaustive-deps

  const evaluate = async () => {
    if (!expr.trim()) return;
    try {
      const v = calc(prepared(expr));
      const text = formatValue(v);
      setResult({ text });
      if (typeof v === 'number') lastAns.current = v;
      await db.calcHistory.add({ expression: expr, result: text, source: 'calcolatrice', createdAt: Date.now() });
      setExpr(typeof v === 'number' ? String(v).replace('.', ',') : String(v));
    } catch (e) {
      setResult({ text: e instanceof FormulaError ? e.message : 'Espressione non valida', err: true });
    }
  };

  const insert = (s: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    const next = expr.slice(0, start) + s + expr.slice(end);
    setExpr(next);
    setResult(null);
    requestAnimationFrame(() => {
      if (!el) return;
      const p = start + s.length;
      el.setSelectionRange(p, p);
    });
  };
  const back = () => { setExpr((e) => e.slice(0, -1)); setResult(null); };
  const clear = () => { setExpr(''); setResult(null); };
  const currentValue = (): number | null => {
    try {
      const v = calc(prepared(expr || '0'));
      return typeof v === 'number' ? v : null;
    } catch {
      return null;
    }
  };
  const setMem = (v: number) => db.settings.put({ key: 'calcMemory', value: v });
  const mem = async (op: 'MC' | 'MR' | 'M+' | 'M-' | 'MS') => {
    const v = currentValue();
    if (op === 'MC') { await setMem(0); ui.toast('Memoria azzerata'); }
    else if (op === 'MR') insert(String(memory).replace('.', ','));
    else if (v === null) ui.toast('Il calcolo non è valido', true);
    else if (op === 'M+') await setMem(memory + v);
    else if (op === 'M-') await setMem(memory - v);
    else await setMem(v);
  };
  const negate = () => setExpr((e) => (e.startsWith('-(') && e.endsWith(')') ? e.slice(2, -1) : e ? `-(${e})` : '-'));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if ((e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')) return;
      if (/^[0-9+\-*/^().,%!]$/.test(e.key)) { insert(e.key); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === '=') { void evaluate(); e.preventDefault(); }
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const K = ({ k, cls = '', label, on }: { k?: string; cls?: string; label?: React.ReactNode; on?: () => void }) => (
    <button className={'ck ' + cls} onClick={on ?? (() => insert(k!))}>{label ?? k}</button>
  );

  return (
    <div className="calc-layout">
      <div className="calc">
        <div className="calc-screen">
          <div className="row between tiny muted">
            <span>{memory !== 0 ? `M = ${formatValue(memory)}` : ''}</span>
            {sci && <button className="chip" style={{ minHeight: 26, fontSize: '.72rem' }} onClick={() => setDeg(!deg)}>{deg ? 'DEG' : 'RAD'}</button>}
          </div>
          <input ref={inputRef} className="calc-expr" value={expr} inputMode="decimal" onChange={(e) => { setExpr(e.target.value); setResult(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void evaluate(); } }} placeholder="0" aria-label="Espressione" />
          <div className={'calc-result' + (result?.err ? ' err' : '')}>{result ? result.text : preview || '0'}</div>
        </div>
        <div className="calc-keys">
          <K k="MC" cls="mem" on={() => mem('MC')} /><K k="MR" cls="mem" on={() => mem('MR')} /><K k="M+" cls="mem" on={() => mem('M+')} /><K k="M−" cls="mem" on={() => mem('M-')} /><K k="MS" cls="mem" on={() => mem('MS')} />
          {sci && <>
            <K k="sin(" label="sin" cls="fn" /><K k="cos(" label="cos" cls="fn" /><K k="tan(" label="tan" cls="fn" /><K k="LOG(" label="log" cls="fn" /><K k="LN(" label="ln" cls="fn" />
            <K k="π" cls="fn" /><K k="E" label="e" cls="fn" /><K k="!" label="n!" cls="fn" /><K k="RADICE(" label="ⁿ√" cls="fn" /><K k="Ans" label="Ans" cls="fn" />
          </>}
          <K label="C" cls="op" on={clear} /><K label="⌫" cls="op" on={back} /><K k="(" cls="op" /><K k=")" cls="op" /><K k="÷" cls="op" />
          <K k="7" /><K k="8" /><K k="9" /><K k="×" cls="op" /><K k="√" cls="fn" />
          <K k="4" /><K k="5" /><K k="6" /><K k="−" cls="op" /><K k="^2" label="x²" cls="fn" />
          <K k="1" /><K k="2" /><K k="3" /><K k="+" cls="op" /><K k="^" label="xʸ" cls="fn" />
          <K label="±" on={negate} /><K k="0" /><K k="," /><K k="%" cls="op" /><K label="=" cls="eq" on={evaluate} />
        </div>
        <div className="row between" style={{ marginTop: 12 }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setSci(!sci)}>{sci ? 'Modalità semplice' : 'Funzioni scientifiche'}</button>
          <span className="tiny muted">Tastiera: Invio = risultato, Esc = cancella</span>
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <div className="card-head"><h3><HelpCircle size={18} />Come funziona</h3></div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', lineHeight: 1.8 }}>
            <li>Percentuali come sulla calcolatrice: <b>200 + 10%</b> = 220, <b>80 × 25%</b> = 20</li>
            <li>Potenze e radici: <b>2^10</b>, <b>√144</b>, <b>RADICE(27; 3)</b></li>
            <li>Parentesi e moltiplicazione implicita: <b>2(3+4)</b> = 14</li>
            <li>Memoria: <b>MS</b> salva, <b>M+ / M−</b> somma/sottrae, <b>MR</b> richiama, <b>MC</b> azzera</li>
            <li>Puoi scrivere anche direttamente nel display, con la tastiera dell’iPad o esterna.</li>
          </ul>
        </div>
        <HistoryView onPick={(e) => { setExpr(e); setResult(null); }} />
      </div>
    </div>
  );
}

function HistoryView({ full, onPick }: { full?: boolean; onPick?: (expr: string) => void }) {
  const ui = useUI();
  const items = useLiveQuery(() => db.calcHistory.orderBy('createdAt').reverse().limit(full ? 500 : 30).toArray(), [full]) ?? [];
  const clearAll = async () => {
    if (await ui.confirm({ title: 'Svuotare lo storico?', message: 'Tutti i calcoli salvati verranno eliminati.', ok: 'Svuota', danger: true })) await db.calcHistory.clear();
  };
  return (
    <div className="card">
      <div className="card-head">
        <h3><History size={18} />Storico dei calcoli</h3>
        {items.length > 0 && <button className="btn btn-sm btn-ghost" onClick={clearAll}><Trash2 size={14} />Svuota</button>}
      </div>
      {!items.length ? <p className="small muted">Ogni risultato che calcoli viene salvato qui.</p> : (
        <div style={{ maxHeight: full ? undefined : 380, overflow: 'auto' }}>
          {items.map((h) => (
            <div key={h.id} className="list-row">
              <button className="grow" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0 }} onClick={() => onPick?.(h.expression)} disabled={!onPick}>
                <div className="small muted ellipsis">{h.expression}</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>= {h.result}</div>
              </button>
              <span className="tiny muted">{h.source === 'tabella' ? 'Tabella · ' : ''}{fmtRelative(h.createdAt)}</span>
              <button className="icon-btn sm" onClick={() => navigator.clipboard?.writeText(h.result).then(() => ui.toast('Copiato'))} aria-label="Copia"><Copy size={14} /></button>
              <button className="icon-btn sm danger" onClick={() => db.calcHistory.delete(h.id!)} aria-label="Elimina"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ———————————————— Spreadsheet ———————————————— */

const TEMPLATES: { name: string; build: () => Partial<Sheet> }[] = [
  { name: 'Tabella vuota', build: () => ({ rows: 30, cols: 8, cells: {} }) },
  {
    name: 'Media voti (pesata sui CFU)',
    build: () => ({
      rows: 25, cols: 4,
      cells: { A1: 'Esame', B1: 'Voto', C1: 'CFU', D1: 'Voto × CFU', A22: 'Media ponderata', B22: '=MEDIA.PONDERATA(B2:B21; C2:C21)', A23: 'Media aritmetica', B23: '=MEDIA(B2:B21)', A24: 'Totale CFU', B24: '=SOMMA(C2:C21)', A25: 'Base di laurea (/110)', B25: '=ARROTONDA(B22*110/30; 2)' },
      formats: { A1: { bold: true }, B1: { bold: true }, C1: { bold: true }, D1: { bold: true }, A22: { bold: true }, A23: { bold: true }, A24: { bold: true }, A25: { bold: true } },
    }),
  },
  {
    name: 'Budget mensile',
    build: () => ({
      rows: 25, cols: 4,
      cells: { A1: 'Voce', B1: 'Entrate', C1: 'Uscite', D1: '% sulle uscite', A22: 'Totale', B22: '=SOMMA(B2:B21)', C22: '=SOMMA(C2:C21)', A23: 'Saldo', B23: '=B22-C22' },
      formats: { A1: { bold: true }, B1: { bold: true }, C1: { bold: true }, D1: { bold: true }, A22: { bold: true }, A23: { bold: true } },
    }),
  },
];

function Sheets() {
  const ui = useUI();
  const sheets = useLiveQuery(() => db.sheets.orderBy('updatedAt').reverse().toArray(), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const menu = useMenu();
  const active = sheets?.find((s) => s.id === activeId) ?? sheets?.[0];

  const create = async (tpl: (typeof TEMPLATES)[number]) => {
    const name = await ui.prompt({ title: 'Nome della tabella', value: tpl.name === 'Tabella vuota' ? 'Nuova tabella' : tpl.name });
    if (name === null) return;
    const now = Date.now();
    const s: Sheet = { id: uid(), name: name || 'Tabella', rows: 30, cols: 8, cells: {}, formats: {}, colWidths: {}, createdAt: now, updatedAt: now, ...tpl.build() } as Sheet;
    await db.sheets.add(s);
    setActiveId(s.id);
    setNewOpen(false);
  };

  if (!sheets) return null;
  return (
    <div className="stack">
      <div className="row wrap">
        <div className="chips scroll grow">
          {sheets.map((s) => (
            <button key={s.id} className={'chip' + (active?.id === s.id ? ' active' : '')} onClick={() => setActiveId(s.id)}
              onContextMenu={(e) => { e.preventDefault(); openSheetMenu(e, s); }}>
              <FileSpreadsheet size={14} />{s.name}
            </button>
          ))}
        </div>
        {active && <button className="icon-btn" onClick={(e) => openSheetMenu(e, active)} aria-label="Opzioni tabella"><MoreHorizontal size={20} /></button>}
        <button className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}><Plus size={16} />Nuova tabella</button>
      </div>
      {active ? <SheetEditor key={active.id} sheet={active} /> : (
        <div className="card"><Empty title="Nessuna tabella" text="Crea una tabella per fare somme, medie, percentuali e totali automatici, come in un piccolo Excel." action={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Plus size={16} />Crea tabella</button>} /></div>
      )}
      {newOpen && (
        <Modal title="Nuova tabella" onClose={() => setNewOpen(false)}>
          <div className="stack">
            {TEMPLATES.map((t) => (
              <button key={t.name} className="list-card" style={{ border: '1px solid var(--border)' }} onClick={() => create(t)}>
                <span className="list-emoji" style={{ background: 'var(--primary-soft)' }}><FileSpreadsheet size={20} color="var(--primary-strong)" /></span>
                <b>{t.name}</b>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {menu.node}
    </div>
  );

  function openSheetMenu(e: React.MouseEvent, s: Sheet) {
    menu.open(e, [
      { label: 'Rinomina', icon: <Pencil size={16} />, onClick: async () => { const n = await ui.prompt({ title: 'Rinomina tabella', value: s.name }); if (n) await db.sheets.update(s.id, { name: n, updatedAt: Date.now() }); } },
      { label: 'Duplica', icon: <Copy size={16} />, onClick: async () => { const id = uid(); await db.sheets.add({ ...s, id, name: s.name + ' (copia)', createdAt: Date.now(), updatedAt: Date.now() }); setActiveId(id); } },
      { label: 'Esporta CSV (Excel)', icon: <Download size={16} />, onClick: () => { const v = computeSheet(s.cells); download(new Blob(['﻿' + toCSV(s.cells, s.rows, s.cols, v)], { type: 'text/csv;charset=utf-8' }), s.name + '.csv'); } },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Elimina tabella', icon: <Trash2 size={16} />, danger: true, onClick: async () => { if (await ui.confirm({ title: `Eliminare “${s.name}”?`, ok: 'Elimina', danger: true })) { await db.sheets.delete(s.id); setActiveId(null); } } },
    ]);
  }
}

interface Sel { r: number; c: number; r2: number; c2: number }

function SheetEditor({ sheet }: { sheet: Sheet }) {
  const ui = useUI();
  const [cells, setCells] = useState(sheet.cells);
  const [formats, setFormats] = useState(sheet.formats ?? {});
  const [rows, setRows] = useState(sheet.rows);
  const [cols, setCols] = useState(sheet.cols);
  const [sel, setSel] = useState<Sel>({ r: 0, c: 0, r2: 0, c2: 0 });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [help, setHelp] = useState(false);
  const undo = useRef<{ cells: Record<string, string>; rows: number; cols: number }[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const values = useMemo(() => computeSheet(cells), [cells]);
  const cur = addr(sel.r, sel.c);

  // persist (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      void db.sheets.update(sheet.id, { cells, formats, rows, cols, updatedAt: Date.now() });
    }, 300);
    return () => clearTimeout(t);
  }, [cells, formats, rows, cols, sheet.id]);

  const pushUndo = () => {
    undo.current.push({ cells, rows, cols });
    if (undo.current.length > 100) undo.current.shift();
  };
  const doUndo = () => {
    const last = undo.current.pop();
    if (last) { setCells(last.cells); setRows(last.rows); setCols(last.cols); }
  };

  const setCell = (a: string, raw: string) => {
    pushUndo();
    setCells((c) => {
      const n = { ...c };
      if (raw === '') delete n[a];
      else n[a] = raw;
      return n;
    });
    if (raw.startsWith('=')) {
      try {
        const r = computeSheet({ ...cells, [a]: raw })[a];
        if (!r.error) void db.calcHistory.add({ expression: `${sheet.name} ${a}: ${raw}`, result: formatValue(r.value), source: 'tabella', createdAt: Date.now() });
      } catch { /* ignore */ }
    }
  };

  const commit = (move?: [number, number]) => {
    if (editing) setCell(editing, draft.trim());
    setEditing(null);
    if (move) go(move[0], move[1]);
    wrapRef.current?.focus();
  };
  const startEdit = (initial?: string) => {
    setEditing(cur);
    setDraft(initial ?? cells[cur] ?? '');
  };
  const go = (dr: number, dc: number, extend = false) => {
    setSel((s) => {
      const r = Math.max(0, Math.min(rows - 1, (extend ? s.r2 : s.r) + dr));
      const c = Math.max(0, Math.min(cols - 1, (extend ? s.c2 : s.c) + dc));
      return extend ? { ...s, r2: r, c2: c } : { r, c, r2: r, c2: c };
    });
  };
  const rng = { r1: Math.min(sel.r, sel.r2), r2: Math.max(sel.r, sel.r2), c1: Math.min(sel.c, sel.c2), c2: Math.max(sel.c, sel.c2) };
  const inRange = (r: number, c: number) => r >= rng.r1 && r <= rng.r2 && c >= rng.c1 && c <= rng.c2;
  const rangeAddrs = () => {
    const out: string[] = [];
    for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) out.push(addr(r, c));
    return out;
  };

  const clearRange = () => {
    pushUndo();
    setCells((c) => {
      const n = { ...c };
      for (const a of rangeAddrs()) delete n[a];
      return n;
    });
  };

  const copy = async () => {
    const lines: string[] = [];
    for (let r = rng.r1; r <= rng.r2; r++) {
      const l: string[] = [];
      for (let c = rng.c1; c <= rng.c2; c++) l.push(cells[addr(r, c)] ?? '');
      lines.push(l.join('\t'));
    }
    clipboard.current = { origin: { r: rng.r1, c: rng.c1 }, text: lines.join('\n') };
    try { await navigator.clipboard.writeText(lines.join('\n')); } catch { /* ignore */ }
    ui.toast('Celle copiate');
  };
  const clipboard = useRef<{ origin: { r: number; c: number }; text: string } | null>(null);
  const paste = async (textIn?: string) => {
    let text = textIn;
    if (text === undefined) {
      try { text = await navigator.clipboard.readText(); } catch { text = clipboard.current?.text ?? ''; }
    }
    if (!text) return;
    const rowsData = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1).map((l) => l.split('\t'));
    const same = clipboard.current && clipboard.current.text === text;
    pushUndo();
    setCells((c) => {
      const n = { ...c };
      rowsData.forEach((line, i) => line.forEach((v, j) => {
        const a = addr(sel.r + i, sel.c + j);
        const val = same ? shiftFormula(v, sel.r - clipboard.current!.origin.r, sel.c - clipboard.current!.origin.c) : v;
        if (val === '') delete n[a]; else n[a] = val;
      }));
      return n;
    });
    setRows((r) => Math.max(r, sel.r + rowsData.length));
    setCols((c) => Math.max(c, sel.c + Math.max(...rowsData.map((l) => l.length))));
  };

  const insertRow = (after: boolean) => {
    pushUndo();
    const at = after ? sel.r + 1 : sel.r;
    setCells((c) => remapCells(c, (r, col) => ({ row: r >= at ? r + 1 : r, col })));
    setRows(rows + 1);
  };
  const deleteRow = () => {
    if (rows <= 1) return;
    pushUndo();
    const n = rng.r2 - rng.r1 + 1;
    setCells((c) => remapCells(c, (r, col) => (r >= rng.r1 && r <= rng.r2 ? null : { row: r > rng.r2 ? r - n : r, col })));
    setRows(Math.max(1, rows - n));
    setSel({ r: rng.r1, c: sel.c, r2: rng.r1, c2: sel.c });
  };
  const insertCol = (after: boolean) => {
    pushUndo();
    const at = after ? sel.c + 1 : sel.c;
    setCells((c) => remapCells(c, (r, col) => ({ row: r, col: col >= at ? col + 1 : col })));
    setCols(cols + 1);
  };
  const deleteCol = () => {
    if (cols <= 1) return;
    pushUndo();
    const n = rng.c2 - rng.c1 + 1;
    setCells((c) => remapCells(c, (r, col) => (col >= rng.c1 && col <= rng.c2 ? null : { row: r, col: col > rng.c2 ? col - n : col })));
    setCols(Math.max(1, cols - n));
    setSel({ r: sel.r, c: rng.c1, r2: sel.r, c2: rng.c1 });
  };

  const autoFn = (fn: string) => {
    // put e.g. =SOMMA(above range) in the current cell
    let top = sel.r - 1;
    while (top >= 0 && typeof values[addr(top, sel.c)]?.value === 'number') top--;
    const from = top + 1;
    if (from >= sel.r) {
      startEdit(`=${fn}()`);
      return;
    }
    setCell(cur, `=${fn}(${addr(from, sel.c)}:${addr(sel.r - 1, sel.c)})`);
  };

  const setFmt = (patch: Partial<Sheet['formats'][string]>) => {
    setFormats((f) => {
      const n = { ...f };
      for (const a of rangeAddrs()) n[a] = { ...n[a], ...patch };
      return n;
    });
  };

  const importCSV = async () => {
    const [file] = await pickFiles('.csv,text/csv,text/plain', false);
    if (!file) return;
    const data = fromCSV(await file.text());
    pushUndo();
    const n: Record<string, string> = {};
    data.forEach((line, r) => line.forEach((v, c) => { if (v !== '') n[addr(r, c)] = v; }));
    setCells(n);
    setRows(Math.max(rows, data.length + 5));
    setCols(Math.max(cols, Math.max(...data.map((l) => l.length))));
    ui.toast('CSV importato');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); void copy(); return; }
    if (mod && e.key.toLowerCase() === 'v') { return; } // handled by onPaste
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); setFmt({ bold: !formats[cur]?.bold }); return; }
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); go(-1, 0, e.shiftKey); break;
      case 'ArrowDown': e.preventDefault(); go(1, 0, e.shiftKey); break;
      case 'ArrowLeft': e.preventDefault(); go(0, -1, e.shiftKey); break;
      case 'ArrowRight': e.preventDefault(); go(0, 1, e.shiftKey); break;
      case 'Tab': e.preventDefault(); go(0, e.shiftKey ? -1 : 1); break;
      case 'Enter': case 'F2': e.preventDefault(); startEdit(); break;
      case 'Delete': case 'Backspace': e.preventDefault(); clearRange(); break;
      default:
        if (e.key.length === 1 && !mod) { e.preventDefault(); startEdit(e.key); }
    }
  };

  // selection stats
  const stats = useMemo(() => {
    const nums: number[] = [];
    for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) {
      const v = values[addr(r, c)]?.value;
      if (typeof v === 'number') nums.push(v);
    }
    if (nums.length < 1) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return { sum, avg: sum / nums.length, count: nums.length, min: Math.min(...nums), max: Math.max(...nums) };
  }, [values, rng.r1, rng.r2, rng.c1, rng.c2]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = (a: string) => {
    const v = values[a];
    if (!v) return '';
    if (v.error) return v.error;
    const raw = cells[a] ?? '';
    if (typeof v.value === 'number' && /%\s*$/.test(raw)) return formatValue(v.value * 100) + '%';
    return formatValue(v.value, formats[a]?.decimals);
  };

  const onCellPointerDown = useCallback((r: number, c: number, e: React.PointerEvent) => {
    if (editing) commit();
    if (e.shiftKey) setSel((s) => ({ ...s, r2: r, c2: c }));
    else setSel({ r, c, r2: r, c2: c });
    if (e.pointerType === 'mouse') dragging.current = true;
  }, [editing, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const err = values[cur]?.error ? values[cur]?.message : null;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="sheet-tools">
        <button className="btn btn-sm" onClick={() => autoFn('SOMMA')} title="Somma automatica"><Sigma size={15} />Somma</button>
        <button className="btn btn-sm" onClick={() => autoFn('MEDIA')}>Media</button>
        <button className="btn btn-sm" onClick={() => autoFn('MAX')}>Max</button>
        <button className="btn btn-sm" onClick={() => autoFn('MIN')}>Min</button>
        <span className="sep" style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <button className={'tb-btn' + (formats[cur]?.bold ? ' active' : '')} onClick={() => setFmt({ bold: !formats[cur]?.bold })} title="Grassetto"><Bold size={16} /></button>
        <button className="tb-btn" onClick={() => setFmt({ align: 'left' })} title="Allinea a sinistra"><AlignLeft size={16} /></button>
        <button className="tb-btn" onClick={() => setFmt({ align: 'center' })} title="Centra"><AlignCenter size={16} /></button>
        <button className="tb-btn" onClick={() => setFmt({ align: 'right' })} title="Allinea a destra"><AlignRight size={16} /></button>
        <select className="tb-select" value={formats[cur]?.decimals ?? ''} onChange={(e) => setFmt({ decimals: e.target.value === '' ? undefined : Number(e.target.value) })} title="Decimali">
          <option value="">Decimali auto</option>{[0, 1, 2, 3, 4].map((d) => <option key={d} value={d}>{d} decimali</option>)}
        </select>
        <span className="sep" style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <button className="btn btn-sm" onClick={() => insertRow(true)} title="Aggiungi riga sotto"><Rows3 size={15} />+ Riga</button>
        <button className="btn btn-sm" onClick={deleteRow} title="Elimina riga">− Riga</button>
        <button className="btn btn-sm" onClick={() => insertCol(true)} title="Aggiungi colonna a destra"><Columns3 size={15} />+ Colonna</button>
        <button className="btn btn-sm" onClick={deleteCol} title="Elimina colonna">− Colonna</button>
        <span className="sep" style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
        <button className="tb-btn" onClick={doUndo} title="Annulla (Ctrl/Cmd+Z)"><Undo2 size={16} /></button>
        <button className="tb-btn" onClick={clearRange} title="Cancella valori selezionati"><Trash2 size={16} /></button>
        <button className="tb-btn" onClick={importCSV} title="Importa CSV"><Upload size={16} /></button>
        <button className="tb-btn" onClick={() => setHelp(true)} title="Funzioni disponibili"><HelpCircle size={16} /></button>
      </div>

      <div className="formula-bar">
        <span className="cell-name">{rng.r1 === rng.r2 && rng.c1 === rng.c2 ? cur : `${addr(rng.r1, rng.c1)}:${addr(rng.r2, rng.c2)}`}</span>
        <input className="input" value={editing === cur ? draft : cells[cur] ?? ''} placeholder="Scrivi un numero, un testo o una formula: =SOMMA(A1:A5)"
          onFocus={() => { if (editing !== cur) startEdit(); }}
          onChange={(e) => { if (editing !== cur) setEditing(cur); setDraft(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit([1, 0]); } if (e.key === 'Escape') { setEditing(null); wrapRef.current?.focus(); } }}
          onBlur={() => editing && commit()} />
      </div>
      {err && <div className="small" style={{ color: 'var(--danger)', marginBottom: 8 }}>{values[cur]?.error}: {err}</div>}

      <div className="sheet-wrap" ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown}
        onPaste={(e) => { if (editing) return; e.preventDefault(); void paste(e.clipboardData.getData('text')); }}>
        <table className="sheet">
          <thead>
            <tr>
              <th className="rowh corner" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className={c >= rng.c1 && c <= rng.c2 ? 'sel-h' : ''} style={{ minWidth: sheet.colWidths?.[c] ?? 110 }}
                  onClick={() => setSel({ r: 0, c, r2: rows - 1, c2: c })}>{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th className={'rowh' + (r >= rng.r1 && r <= rng.r2 ? ' sel-h' : '')} onClick={() => setSel({ r, c: 0, r2: r, c2: cols - 1 })}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const a = addr(r, c);
                  const isSel = r === sel.r && c === sel.c;
                  const v = values[a];
                  const f = formats[a];
                  if (editing === a && isSel) {
                    return (
                      <td key={c} className="editing">
                        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commit([1, 0]); }
                            else if (e.key === 'Tab') { e.preventDefault(); commit([0, e.shiftKey ? -1 : 1]); }
                            else if (e.key === 'Escape') { setEditing(null); wrapRef.current?.focus(); }
                          }}
                          onBlur={() => commit()} />
                      </td>
                    );
                  }
                  return (
                    <td key={c}
                      className={[isSel ? 'sel' : inRange(r, c) ? 'in-range' : '', typeof v?.value === 'number' ? 'num' : '', v?.error ? 'err' : ''].join(' ')}
                      style={{ fontWeight: f?.bold ? 700 : undefined, textAlign: f?.align, background: f?.bg }}
                      onPointerDown={(e) => onCellPointerDown(r, c, e)}
                      onPointerEnter={() => dragging.current && setSel((s) => ({ ...s, r2: r, c2: c }))}
                      onDoubleClick={() => startEdit()}
                      onClick={(e) => { if (e.detail === 1 && isSel && e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType !== 'mouse') startEdit(); }}
                      title={v?.message}>
                      {display(a)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sheet-stats">
        {stats ? <>
          <span>Somma <b>{formatValue(stats.sum)}</b></span>
          <span>Media <b>{formatValue(Math.round(stats.avg * 1e6) / 1e6)}</b></span>
          <span>Conteggio <b>{stats.count}</b></span>
          <span>Min <b>{formatValue(stats.min)}</b></span>
          <span>Max <b>{formatValue(stats.max)}</b></span>
        </> : <span>Seleziona più celle (trascina o Maiusc + frecce) per vedere somma, media e totali.</span>}
        <span className="grow" />
        <button className="btn btn-sm btn-ghost" onClick={() => { setRows(rows + 10); }}>+10 righe</button>
        <span className="tiny muted">{rows} × {cols} · salvataggio automatico</span>
      </div>
      {help && (
        <Modal title="Funzioni disponibili" size="wide" onClose={() => setHelp(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>Le formule iniziano con <b>=</b>. Separa gli argomenti con <b>;</b> e usa <b>:</b> per gli intervalli (A1:A10). Operatori: + − * / ^ % e confronti (&gt;, &lt;, =, &lt;&gt;). Tocca due volte una cella per modificarla; sull’iPad toccala una seconda volta.</p>
          <table className="exam-table">
            <thead><tr><th>Funzione</th><th>A cosa serve</th><th>Esempio</th></tr></thead>
            <tbody>{FUNCTION_HELP.map((f) => <tr key={f.name}><td><b>{f.name}</b></td><td>{f.desc}</td><td><code>{f.example}</code></td></tr>)}</tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

