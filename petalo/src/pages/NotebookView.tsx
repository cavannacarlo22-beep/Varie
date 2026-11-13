import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { generateHTML } from '@tiptap/core';
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, Maximize2, Minimize2, ChevronDown, ChevronRight, Copy, CornerLeftUp, FileDown, FilePlus, FolderInput, MoreHorizontal, PanelLeft,
  Pencil, Plus, Printer, Search, Trash2,
} from 'lucide-react';
import { db, uid } from '../db/db';
import type { Note, Notebook } from '../db/types';
import { useSettings } from '../db/settings';
import { NoteEditor } from '../editor/NoteEditor';
import { buildExtensions } from '../editor/buildExtensions';
import { fontsInDoc } from '../lib/fonts';
import { escapeHtml, exportWord, printDocument } from '../lib/exportDoc';
import { Empty, Modal, useMenu, useUI } from '../components/ui';

export function childrenOf(notes: Note[], parentId: string | null) {
  return notes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}
function subtree(notes: Note[], id: string): Note[] {
  const root = notes.find((n) => n.id === id);
  if (!root) return [];
  return [root, ...childrenOf(notes, id).flatMap((c) => subtree(notes, c.id))];
}
/** Depth-first ordered list with numbering like 1, 1.1, 1.2, 2 … */
export function outline(notes: Note[], parentId: string | null = null, prefix = ''): { note: Note; num: string; depth: number }[] {
  return childrenOf(notes, parentId).flatMap((n, i) => {
    const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    return [{ note: n, num, depth: prefix ? prefix.split('.').length : 0 }, ...outline(notes, n.id, num)];
  });
}

export async function createNote(notebookId: string, parentId: string | null, title = ''): Promise<string> {
  const siblings = await db.notes.where('notebookId').equals(notebookId).filter((n) => n.parentId === parentId).toArray();
  const now = Date.now();
  const id = uid();
  await db.notes.add({ id, notebookId, parentId, title, content: null, text: '', order: siblings.length, createdAt: now, updatedAt: now, openedAt: now });
  await db.notebooks.update(notebookId, { updatedAt: now });
  return id;
}

export default function NotebookView() {
  const { notebookId = '', noteId } = useParams();
  const nav = useNavigate();
  const ui = useUI();
  const s = useSettings();
  const menu = useMenu();
  const notebook = useLiveQuery(() => db.notebooks.get(notebookId), [notebookId]);
  const notes = useLiveQuery(() => db.notes.where('notebookId').equals(notebookId).toArray(), [notebookId]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sideOpen, setSideOpen] = useState(false);
  const [q, setQ] = useState('');
  const [moving, setMoving] = useState<Note | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [zen, setZen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle('zen', zen);
    return () => document.body.classList.remove('zen');
  }, [zen]);

  const current = notes?.find((n) => n.id === noteId);

  // open the most recent note when none is selected
  useEffect(() => {
    if (!notes || noteId || !notes.length) return;
    const last = [...notes].sort((a, b) => b.openedAt - a.openedAt)[0];
    nav(`/quaderni/${notebookId}/${last.id}`, { replace: true });
  }, [notes, noteId, notebookId, nav]);

  const list = useMemo(() => (notes ? outline(notes) : []), [notes]);
  const matches = useMemo(() => {
    if (!q.trim() || !notes) return null;
    const n = q.toLowerCase();
    return notes.filter((x) => x.title.toLowerCase().includes(n) || x.text.toLowerCase().includes(n));
  }, [q, notes]);

  if (notebook === undefined || notes === undefined) return null;
  if (!notebook) return <div className="page"><Empty title="Quaderno non trovato" action={<Link className="btn" to="/quaderni">Torna ai quaderni</Link>} /></div>;

  const add = async (parentId: string | null) => {
    const id = await createNote(notebookId, parentId);
    if (parentId) setCollapsed((c) => { const n = new Set(c); n.delete(parentId); return n; });
    nav(`/quaderni/${notebookId}/${id}`);
    setSideOpen(false);
  };

  const reorder = async (n: Note, dir: -1 | 1) => {
    const sib = childrenOf(notes, n.parentId);
    const i = sib.findIndex((x) => x.id === n.id);
    const j = i + dir;
    if (j < 0 || j >= sib.length) return;
    [sib[i], sib[j]] = [sib[j], sib[i]];
    await db.transaction('rw', db.notes, async () => { for (let k = 0; k < sib.length; k++) await db.notes.update(sib[k].id, { order: k }); });
  };

  const moveTo = async (n: Note, targetNotebook: string, parentId: string | null) => {
    if (parentId && subtree(notes, n.id).some((x) => x.id === parentId)) { ui.toast('Non puoi spostare un capitolo dentro sé stesso', true); return; }
    const ids = subtree(notes, n.id).map((x) => x.id);
    const order = await db.notes.where('notebookId').equals(targetNotebook).filter((x) => x.parentId === parentId).count();
    await db.transaction('rw', db.notes, async () => {
      await db.notes.update(n.id, { parentId, order, notebookId: targetNotebook });
      for (const id of ids.slice(1)) await db.notes.update(id, { notebookId: targetNotebook });
    });
    ui.toast('Capitolo spostato');
    if (targetNotebook !== notebookId) nav(`/quaderni/${notebookId}`);
  };

  const duplicate = async (n: Note) => {
    const tree = subtree(notes, n.id);
    const map = new Map(tree.map((x) => [x.id, uid()]));
    const now = Date.now();
    await db.notes.bulkAdd(tree.map((x) => ({
      ...x, id: map.get(x.id)!, parentId: x.id === n.id ? n.parentId : map.get(x.parentId!) ?? x.parentId,
      title: x.id === n.id ? `${x.title || 'Senza titolo'} (copia)` : x.title, order: x.id === n.id ? n.order + 0.5 : x.order, createdAt: now, updatedAt: now, openedAt: now,
    })));
    ui.toast('Capitolo duplicato');
    nav(`/quaderni/${notebookId}/${map.get(n.id)}`);
  };

  const remove = async (n: Note) => {
    const tree = subtree(notes, n.id);
    if (!(await ui.confirm({ title: `Eliminare “${n.title || 'Senza titolo'}”?`, message: tree.length > 1 ? `Verranno eliminati anche ${tree.length - 1} sottocapitoli.` : 'Il capitolo verrà eliminato definitivamente.', ok: 'Elimina', danger: true }))) return;
    await db.notes.bulkDelete(tree.map((x) => x.id));
    ui.toast('Capitolo eliminato');
    if (tree.some((x) => x.id === noteId)) nav(`/quaderni/${notebookId}`, { replace: true });
  };

  const exportAll = async (kind: 'pdf' | 'word') => {
    const exts = buildExtensions();
    const parts: string[] = [];
    const fonts = new Set<string>();
    for (const { note, num } of list) {
      const body = note.content ? generateHTML(note.content as Parameters<typeof generateHTML>[0], exts) : '';
      fontsInDoc(note.content).forEach((f) => fonts.add(f));
      const level = Math.min(3, num.split('.').length);
      parts.push(`<section class="${level === 1 ? 'chapter' : ''}"><h${level}>${num} · ${escapeHtml(note.title || 'Senza titolo')}</h${level}>${body}</section>`);
    }
    const toc = `<h1 class="doc-title">${escapeHtml(notebook.title)}</h1>${notebook.subject ? `<p><i>${escapeHtml(notebook.subject)}</i></p>` : ''}<ol style="list-style:none;padding:0">${list.map(({ note, num, depth }) => `<li style="margin-left:${depth * 18}px">${num} · ${escapeHtml(note.title || 'Senza titolo')}</li>`).join('')}</ol>`;
    const opts = { title: notebook.title, html: `<section>${toc}</section>` + parts.join(''), fonts, baseFont: s.editorFont, baseSize: s.editorFontSize, lineHeight: s.editorLineHeight };
    if (kind === 'pdf') await printDocument(opts);
    else exportWord(opts);
  };

  const noteMenu = (e: React.MouseEvent, n: Note) => {
    e.stopPropagation();
    menu.open(e, [
      { label: 'Aggiungi sottocapitolo', icon: <FilePlus size={16} />, onClick: () => add(n.id) },
      { label: 'Rinomina', icon: <Pencil size={16} />, onClick: async () => { const t = await ui.prompt({ title: 'Rinomina capitolo', value: n.title }); if (t !== null) await db.notes.update(n.id, { title: t, updatedAt: Date.now() }); } },
      { label: 'Sposta su', icon: <ArrowUp size={16} />, onClick: () => reorder(n, -1) },
      { label: 'Sposta giù', icon: <ArrowDown size={16} />, onClick: () => reorder(n, 1) },
      ...(n.parentId ? [{ label: 'Porta al livello superiore', icon: <CornerLeftUp size={16} />, onClick: () => moveTo(n, notebookId, notes.find((x) => x.id === n.parentId)?.parentId ?? null) }] : []),
      { label: 'Sposta in…', icon: <FolderInput size={16} />, onClick: () => setMoving(n) },
      { label: 'Duplica', icon: <Copy size={16} />, onClick: () => duplicate(n) },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Elimina', icon: <Trash2 size={16} />, danger: true, onClick: () => remove(n) },
    ]);
  };

  const renderTree = (parentId: string | null, depth: number): React.ReactNode => childrenOf(notes, parentId).map((n) => {
    const kids = childrenOf(notes, n.id);
    const isCol = collapsed.has(n.id);
    return (
      <div key={n.id}>
        <div className={'tree-item' + (n.id === noteId ? ' active' : '') + (dropId === n.id ? ' drop-target' : '')} style={{ paddingLeft: depth * 16 }}
          draggable onDragStart={(e) => { setDragId(n.id); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { if (dragId && dragId !== n.id) { e.preventDefault(); setDropId(n.id); } }}
          onDragLeave={() => setDropId(null)}
          onDrop={(e) => { e.preventDefault(); const d = notes.find((x) => x.id === dragId); setDropId(null); setDragId(null); if (d && d.id !== n.id) void moveTo(d, notebookId, n.id); }}
          onContextMenu={(e) => { e.preventDefault(); noteMenu(e, n); }}>
          <button className="tree-toggle" onClick={() => setCollapsed((c) => { const x = new Set(c); if (x.has(n.id)) x.delete(n.id); else x.add(n.id); return x; })} style={{ visibility: kids.length ? 'visible' : 'hidden' }} aria-label="Espandi">
            {isCol ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </button>
          <button className="tree-title" onClick={() => { nav(`/quaderni/${notebookId}/${n.id}`); setSideOpen(false); }}>{n.title || 'Senza titolo'}</button>
          <button className="icon-btn sm" onClick={(e) => noteMenu(e, n)} aria-label="Opzioni capitolo"><MoreHorizontal size={16} /></button>
        </div>
        {!isCol && renderTree(n.id, depth + 1)}
      </div>
    );
  });

  return (
    <div className="nb-layout">
      <aside className={'nb-side' + (sideOpen ? ' show' : '')}>
        <div className="nb-side-head">
          <div className="row">
            <Link to="/quaderni" className="icon-btn" aria-label="Tutti i quaderni"><ArrowLeft size={20} /></Link>
            <span className="list-emoji" style={{ background: notebook.cover.color + '66', width: 36, height: 36 }}>{notebook.cover.emoji}</span>
            <div className="grow">
              <b className="ellipsis" style={{ display: 'block', fontFamily: 'var(--font-display)' }}>{notebook.title}</b>
              <span className="tiny muted">{notes.length} capitoli</span>
            </div>
            <button className="icon-btn" aria-label="Opzioni quaderno" onClick={(e) => menu.open(e, [
              { label: 'Esporta tutto in PDF / stampa', icon: <Printer size={16} />, onClick: () => exportAll('pdf') },
              { label: 'Esporta tutto in Word', icon: <FileDown size={16} />, onClick: () => exportAll('word') },
            ])}><MoreHorizontal size={18} /></button>
          </div>
          <div className="search"><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca negli appunti" style={{ minHeight: 40 }} /></div>
          <button className="btn btn-soft btn-sm" onClick={() => add(null)}><Plus size={16} />Nuovo capitolo</button>
        </div>
        <div className="nb-tree"
          onDragOver={(e) => { if (dragId) e.preventDefault(); }}
          onDrop={(e) => { if (e.target === e.currentTarget && dragId) { const d = notes.find((x) => x.id === dragId); setDragId(null); if (d) void moveTo(d, notebookId, null); } }}>
          {matches ? (
            matches.length ? matches.map((n) => {
              const idx = n.text.toLowerCase().indexOf(q.toLowerCase());
              return (
                <button key={n.id} className="list-card" onClick={() => { nav(`/quaderni/${notebookId}/${n.id}`); setSideOpen(false); }} style={{ minHeight: 0 }}>
                  <div className="grow">
                    <b className="ellipsis" style={{ display: 'block' }}>{n.title || 'Senza titolo'}</b>
                    {idx >= 0 && <span className="tiny muted">…{n.text.slice(Math.max(0, idx - 30), idx + 60)}…</span>}
                  </div>
                </button>
              );
            }) : <p className="small muted" style={{ padding: 10 }}>Nessun risultato.</p>
          ) : notes.length ? renderTree(null, 0) : <p className="small muted" style={{ padding: 10 }}>Nessun capitolo: creane uno per iniziare.</p>}
          {!matches && notes.length > 1 && <p className="tiny muted" style={{ padding: '10px 12px' }}>Trascina un capitolo su un altro per farlo diventare un sottocapitolo, oppure usa il menu ⋯.</p>}
        </div>
      </aside>

      <main className="nb-main">
        <div className="row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button className="icon-btn" onClick={() => setSideOpen(!sideOpen)} aria-label="Mostra capitoli" style={{ display: window.innerWidth <= 860 ? undefined : 'none' }}><PanelLeft size={20} /></button>
          <BookOpen size={18} color="var(--primary)" />
          <span className="small ellipsis grow">
            <Link to="/quaderni" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Quaderni</Link> / {notebook.title}{current ? ` / ${current.title || 'Senza titolo'}` : ''}
          </span>
          {current && <button className="btn btn-sm btn-ghost" onClick={() => add(current.id)}><FilePlus size={16} />Sottocapitolo</button>}
          <button className={'icon-btn' + (zen ? ' active' : '')} onClick={() => setZen(!zen)} title={zen ? 'Esci dalla modalità concentrazione' : 'Modalità concentrazione (schermo intero)'}>
            {zen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
        {current ? (
          <NoteEditor key={current.id} note={current} notebook={notebook} />
        ) : (
          <div className="editor-scroll"><div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
            <Empty title="Quaderno pronto" text="Crea il primo capitolo e inizia a prendere appunti. Potrai aggiungere sottocapitoli, immagini, disegni e allegati."
              action={<button className="btn btn-primary" onClick={() => add(null)}><Plus size={16} />Primo capitolo</button>} />
          </div></div>
        )}
      </main>
      {moving && <MoveDialog note={moving} notes={notes} currentNotebook={notebookId} onClose={() => setMoving(null)} onPick={(nb, parent) => { void moveTo(moving, nb, parent); setMoving(null); }} />}
      {menu.node}
    </div>
  );
}

function MoveDialog({ note, notes, currentNotebook, onClose, onPick }: { note: Note; notes: Note[]; currentNotebook: string; onClose: () => void; onPick: (nb: string, parent: string | null) => void }) {
  const notebooks = useLiveQuery(() => db.notebooks.orderBy('order').toArray(), []) ?? [];
  const [nb, setNb] = useState<Notebook['id']>(currentNotebook);
  const targetNotes = useLiveQuery(() => db.notes.where('notebookId').equals(nb).toArray(), [nb]) ?? [];
  const blocked = new Set(subtree(notes, note.id).map((x) => x.id));
  return (
    <Modal title={`Sposta “${note.title || 'Senza titolo'}”`} onClose={onClose}>
      <div className="stack">
        <label className="field"><span>Quaderno</span>
          <select className="select" value={nb} onChange={(e) => setNb(e.target.value)}>
            {notebooks.map((n) => <option key={n.id} value={n.id}>{n.cover.emoji} {n.title}</option>)}
          </select>
        </label>
        <span className="label">Inserisci dentro…</span>
        <div className="folder-tree" style={{ maxHeight: 340, overflow: 'auto' }}>
          <button onClick={() => onPick(nb, null)}>Livello principale del quaderno</button>
          {outline(targetNotes).filter(({ note: n }) => !blocked.has(n.id)).map(({ note: n, num, depth }) => (
            <button key={n.id} style={{ paddingLeft: 10 + depth * 16 }} onClick={() => onPick(nb, n.id)}>{num} · {n.title || 'Senza titolo'}</button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
