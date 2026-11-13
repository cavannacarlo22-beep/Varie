import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, BookHeart, ImagePlus, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { db, uid } from '../db/db';
import type { Notebook, NotebookCover, Paper } from '../db/types';
import { compressImage, pickFiles } from '../lib/files';
import { fmtRelative } from '../lib/dates';
import { Empty, Modal, Swatches, useMenu, useUI } from '../components/ui';
import { createNote } from './NotebookView';

const PATTERNS: NotebookCover['pattern'][] = ['hearts', 'dots', 'stripes', 'grid', 'flowers', 'plain'];
const PATTERN_LABEL: Record<NotebookCover['pattern'], string> = { hearts: 'Cuoricini', dots: 'Pois', stripes: 'Righe', grid: 'Quadretti', flowers: 'Fiori', plain: 'Tinta unita' };
const EMOJIS = ['📒', '📕', '📗', '📘', '📙', '📓', '⚖️', '🧬', '🧪', '📐', '🧮', '💻', '🏛️', '🎨', '🌍', '💊', '🧠', '📊', '💶', '🗣️', '🎼', '📜', '🔭', '🌱', '🩺', '✏️', '💗', '🌸'];
const COVER_COLORS = ['#f6b3c4', '#f39cc0', '#e88aa3', '#fbd3dc', '#bfa8e8', '#d8c8f2', '#a8d4f2', '#7fbfe8', '#b9e3cf', '#f6cfa8', '#f3e2a9', '#e6d5cf'];

export function CoverView({ nb, onClick, small }: { nb: Pick<Notebook, 'title' | 'subject' | 'cover'>; onClick?: () => void; small?: boolean }) {
  return (
    <button className={`nb-cover pattern-${nb.cover.pattern}`} style={{ backgroundColor: nb.cover.color, maxWidth: small ? 150 : undefined }} onClick={onClick} type="button">
      {nb.cover.image && <img className="cover-img" src={nb.cover.image} alt="" />}
      <div className="label"><b>{nb.title || 'Nuovo quaderno'}</b>{nb.subject && <span>{nb.subject}</span>}</div>
      <span className="emoji">{nb.cover.emoji}</span>
    </button>
  );
}

export default function Quaderni() {
  const nav = useNavigate();
  const ui = useUI();
  const menu = useMenu();
  const notebooks = useLiveQuery(() => db.notebooks.orderBy('order').toArray(), []);
  const counts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    await db.notes.each((n) => m.set(n.notebookId, (m.get(n.notebookId) ?? 0) + 1));
    return m;
  }, []);
  const [edit, setEdit] = useState<Notebook | null>(null);
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const results = useLiveQuery(async () => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return null;
    return db.notes.filter((x) => x.title.toLowerCase().includes(n) || x.text.toLowerCase().includes(n)).limit(50).toArray();
  }, [q]);
  const nbMap = useMemo(() => new Map((notebooks ?? []).map((n) => [n.id, n])), [notebooks]);

  if (!notebooks) return null;
  const shown = notebooks.filter((n) => n.archived === showArchived);

  const blank = (): Notebook => ({
    id: '', title: '', subject: '', professor: '', paper: 'lines', order: notebooks.length, archived: false, createdAt: 0, updatedAt: 0,
    cover: { color: COVER_COLORS[notebooks.length % COVER_COLORS.length], pattern: 'hearts', emoji: '📒' },
  });

  const nbMenu = (e: React.MouseEvent, nb: Notebook) => {
    e.stopPropagation();
    menu.open(e, [
      { label: 'Modifica copertina e dettagli', icon: <Pencil size={16} />, onClick: () => setEdit(nb) },
      { label: nb.archived ? 'Ripristina' : 'Archivia', icon: nb.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />, onClick: () => db.notebooks.update(nb.id, { archived: !nb.archived }) },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Elimina quaderno', icon: <Trash2 size={16} />, danger: true, onClick: async () => {
        const n = counts?.get(nb.id) ?? 0;
        if (await ui.confirm({ title: `Eliminare “${nb.title}”?`, message: `Il quaderno e i suoi ${n} capitoli verranno eliminati definitivamente. Puoi archiviarlo invece di eliminarlo.`, ok: 'Elimina', danger: true })) {
          await db.transaction('rw', db.notebooks, db.notes, async () => {
            await db.notes.where('notebookId').equals(nb.id).delete();
            await db.notebooks.delete(nb.id);
          });
          ui.toast('Quaderno eliminato');
        }
      } },
    ]);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Quaderni universitari</h1>
          <p>Un quaderno per ogni materia, con capitoli, sottocapitoli e la tua copertina.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={18} />Nuovo quaderno</button>
      </div>
      <div className="row wrap" style={{ marginBottom: 20 }}>
        <div className="search grow" style={{ minWidth: 220 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca una parola in tutti gli appunti" /></div>
        <button className={'chip' + (showArchived ? ' active' : '')} onClick={() => setShowArchived(!showArchived)}><Archive size={14} />Archiviati</button>
      </div>

      {results ? (
        <div className="card">
          <div className="card-head"><h3><Search size={18} />Risultati per “{q}”</h3><button className="icon-btn sm" onClick={() => setQ('')}><X size={16} /></button></div>
          {results.length === 0 ? <p className="muted">Nessun appunto contiene questa parola.</p> : results.map((n) => {
            const nb = nbMap.get(n.notebookId);
            const i = n.text.toLowerCase().indexOf(q.toLowerCase());
            return (
              <Link key={n.id} to={`/quaderni/${n.notebookId}/${n.id}`} className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="list-emoji" style={{ background: (nb?.cover.color ?? '#eee') + '66', width: 36, height: 36 }}>{nb?.cover.emoji}</span>
                <div className="grow">
                  <b>{n.title || 'Senza titolo'}</b> <span className="tiny muted">· {nb?.title}</span>
                  {i >= 0 && <div className="small muted ellipsis">…{n.text.slice(Math.max(0, i - 40), i)}<mark>{n.text.slice(i, i + q.length)}</mark>{n.text.slice(i + q.length, i + 80)}…</div>}
                </div>
              </Link>
            );
          })}
        </div>
      ) : shown.length === 0 ? (
        <div className="card"><Empty icon={<BookHeart size={56} color="var(--primary)" />} title={showArchived ? 'Nessun quaderno archiviato' : 'Il tuo primo quaderno ti aspetta'}
          text={showArchived ? undefined : 'Crea un quaderno per ogni materia: Diritto, Statistica, Anatomia… scegli colore, motivo e icona della copertina.'}
          action={!showArchived && <button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={16} />Crea quaderno</button>} /></div>
      ) : (
        <div className="nb-grid">
          {shown.map((nb) => (
            <div key={nb.id} style={{ position: 'relative' }}>
              <CoverView nb={nb} onClick={() => nav(`/quaderni/${nb.id}`)} />
              <button className="icon-btn sm" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,.85)' }} onClick={(e) => nbMenu(e, nb)} aria-label="Opzioni quaderno"><MoreHorizontal size={16} /></button>
              <div className="row between tiny muted" style={{ marginTop: 8, padding: '0 4px' }}>
                <span>{counts?.get(nb.id) ?? 0} capitoli</span><span>{nb.updatedAt ? fmtRelative(nb.updatedAt) : ''}</span>
              </div>
            </div>
          ))}
          <button className="nb-cover" style={{ background: 'var(--surface-2)', border: '2px dashed var(--border-strong)', boxShadow: 'none', display: 'grid', placeItems: 'center', color: 'var(--text-2)' }} onClick={() => setEdit(blank())}>
            <span style={{ textAlign: 'center' }}><Plus size={32} /><br />Nuovo quaderno</span>
          </button>
        </div>
      )}
      {edit && <NotebookEditor nb={edit} onClose={() => setEdit(null)} onCreated={(id, noteId) => nav(`/quaderni/${id}/${noteId}`)} />}
      {menu.node}
    </div>
  );
}

function NotebookEditor({ nb, onClose, onCreated }: { nb: Notebook; onClose: () => void; onCreated: (id: string, noteId: string) => void }) {
  const ui = useUI();
  const [n, setN] = useState(nb);
  const isNew = !nb.id;
  const setCover = (p: Partial<NotebookCover>) => setN((x) => ({ ...x, cover: { ...x.cover, ...p } }));
  const save = async () => {
    if (!n.title.trim()) { ui.toast('Dai un nome al quaderno', true); return; }
    const now = Date.now();
    const rec = { ...n, title: n.title.trim(), id: n.id || uid(), createdAt: n.createdAt || now, updatedAt: now };
    await db.notebooks.put(rec);
    onClose();
    if (isNew) {
      const noteId = await createNote(rec.id, null, 'Introduzione');
      onCreated(rec.id, noteId);
    }
  };
  const upload = async () => {
    const [f] = await pickFiles('image/*', false);
    if (f) setCover({ image: await compressImage(f, 900, 0.82) });
  };
  return (
    <Modal title={isNew ? 'Nuovo quaderno' : 'Modifica quaderno'} size="wide" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Crea quaderno' : 'Salva'}</button></>}>
      <div className="nb-edit-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: 24 }}>
        <div><CoverView nb={n} small /></div>
        <div className="stack">
          <label className="field"><span>Materia / titolo</span><input className="input" autoFocus value={n.title} onChange={(e) => setN({ ...n, title: e.target.value })} placeholder="Es. Diritto costituzionale" /></label>
          <div className="field-row">
            <label className="field"><span>Sottotitolo (corso, anno…)</span><input className="input" value={n.subject} onChange={(e) => setN({ ...n, subject: e.target.value })} placeholder="2° anno · I semestre" /></label>
            <label className="field"><span>Docente</span><input className="input" value={n.professor} onChange={(e) => setN({ ...n, professor: e.target.value })} /></label>
          </div>
          <div className="field"><span>Colore copertina</span><Swatches value={n.cover.color} onChange={(c) => setCover({ color: c })} colors={COVER_COLORS} /></div>
          <div className="field"><span>Motivo</span>
            <div className="chips">{PATTERNS.map((p) => <button key={p} className={'chip' + (n.cover.pattern === p ? ' active' : '')} onClick={() => setCover({ pattern: p })}>{PATTERN_LABEL[p]}</button>)}</div>
          </div>
          <div className="field"><span>Icona</span>
            <div className="chips">{EMOJIS.map((e) => <button key={e} className={'chip' + (n.cover.emoji === e ? ' active' : '')} style={{ fontSize: '1.15rem', padding: '0 9px' }} onClick={() => setCover({ emoji: e })}>{e}</button>)}</div>
          </div>
          <div className="row wrap">
            <button className="btn btn-sm" onClick={upload}><ImagePlus size={16} />Foto di copertina</button>
            {n.cover.image && <button className="btn btn-sm btn-ghost" onClick={() => setCover({ image: undefined })}><X size={14} />Rimuovi foto</button>}
          </div>
          <div className="field"><span>Tipo di foglio</span>
            <div className="chips">{([['lines', 'A righe'], ['grid', 'A quadretti'], ['dots', 'A puntini'], ['blank', 'Bianco']] as [Paper, string][]).map(([p, l]) => (
              <button key={p} className={'chip' + (n.paper === p ? ' active' : '')} onClick={() => setN({ ...n, paper: p })}>{l}</button>
            ))}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
