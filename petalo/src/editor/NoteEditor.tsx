import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, ChevronDown, Code, Eraser, FileDown, Highlighter, Image as ImageIcon,
  Italic, Link2, List, ListChecks, ListOrdered, Minus, Paperclip, PenTool, Plus, Printer, Quote, Redo2, Search, SeparatorHorizontal,
  Strikethrough, Subscript as SubIcon, Superscript as SupIcon, Table as TableIcon, Underline as UnderlineIcon, Undo2, X, Check, CloudOff,
} from 'lucide-react';
import { db, uid } from '../db/db';
import type { Note, Notebook } from '../db/types';
import { useSettings } from '../db/settings';
import { cssFamily, fontsInDoc, loadFont, loadFonts } from '../lib/fonts';
import { compressImage, openBlob, pickFiles } from '../lib/files';
import { exportHTML, exportWord, printDocument, escapeHtml } from '../lib/exportDoc';
import { FontPicker } from '../components/FontPicker';
import { DrawingCanvas, type DrawingHandle, type Stroke } from '../components/DrawingCanvas';
import { Modal, useMenu, useUI } from '../components/ui';
import { buildExtensions } from './buildExtensions';
import { searchKey, type DrawingAttrs } from './extensions';

const TEXT_COLORS = ['#3a2a31', '#6b6b6b', '#e46f8e', '#c94f71', '#9b5de5', '#5fa8dc', '#2f7fb8', '#4caf84', '#2e8b57', '#f2a35e', '#d9534f', '#b8860b'];
const HL_COLORS = ['#fff3a3', '#ffd6e0', '#d6ecff', '#dcf5d0', '#eadcff', '#ffe2c4', '#fbdbe4', '#e2f1fb'];
const SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 36, 42, 48, 60, 72];
const LINE_HEIGHTS = ['1', '1.15', '1.35', '1.5', '1.7', '2', '2.5'];
const STORAGE_FOLDER = 'Allegati dei quaderni';

async function attachmentsFolder(): Promise<string> {
  const f = await db.folders.filter((x) => x.name === STORAGE_FOLDER && x.parentId === null).first();
  if (f) return f.id;
  const id = uid();
  await db.folders.add({ id, name: STORAGE_FOLDER, parentId: null, color: '#7fbfe8', createdAt: Date.now() });
  return id;
}

export function NoteEditor({ note, notebook }: { note: Note; notebook: Notebook }) {
  const s = useSettings();
  const ui = useUI();
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [findOpen, setFindOpen] = useState(false);
  const [drawing, setDrawing] = useState<{ pos: number | null; attrs?: DrawingAttrs } | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const job = pending.current;
    pending.current = null;
    if (job) {
      try {
        await job();
        setStatus('saved');
      } catch (e) {
        console.error(e);
        setStatus('error');
        ui.toast('Salvataggio non riuscito: controlla lo spazio disponibile', true);
      }
    }
  }, [ui]);

  const schedule = useCallback((job: () => Promise<void>) => {
    pending.current = job;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 500);
  }, [flush]);

  const insertImages = useCallback(async (ed: Editor, files: File[], pos?: number) => {
    for (const f of files.filter((x) => x.type.startsWith('image/'))) {
      try {
        const src = await compressImage(f);
        const chain = ed.chain().focus();
        if (pos !== undefined) chain.insertContentAt(pos, { type: 'image', attrs: { src } }).run();
        else chain.setImage({ src }).run();
      } catch {
        ui.toast('Immagine non supportata', true);
      }
    }
  }, [ui]);

  const editor = useEditor({
    extensions: buildExtensions('Inizia a scrivere i tuoi appunti… (usa la barra in alto per titoli, elenchi, colori e font)'),
    content: (note.content as object) ?? '',
    editorProps: {
      attributes: { spellcheck: String(s.spellcheck), autocapitalize: 'sentences' },
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        const ed = editorRef.current;
        if (ed) void insertImages(ed, files);
        void view;
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY });
        const ed = editorRef.current;
        if (!ed) return true;
        const images = files.filter((f) => f.type.startsWith('image/'));
        const others = files.filter((f) => !f.type.startsWith('image/'));
        if (images.length) void insertImages(ed, images, coords?.pos);
        if (others.length) void attachFiles(ed, others);
        return true;
      },
      handleClickOn: (_view, pos, node: PMNode, _np, event) => {
        if (node.type.name === 'attachment') {
          event.preventDefault();
          void db.files.get(node.attrs.fileId).then((f) => (f ? openBlob(f.blob) : ui.toast('L’allegato non è più nell’archivio', true)));
          return true;
        }
        if (node.type.name === 'drawing' && (event.detail >= 2 || (event as PointerEvent).pointerType === 'pen' || (event as PointerEvent).pointerType === 'touch')) {
          setDrawing({ pos, attrs: node.attrs as DrawingAttrs });
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const content = ed.getJSON();
      const text = ed.getText({ blockSeparator: '\n' });
      schedule(() => db.notes.update(note.id, { content, text, updatedAt: Date.now() }).then(() => db.notebooks.update(notebook.id, { updatedAt: Date.now() })).then(() => undefined));
    },
  }, [note.id]);

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  const attachFiles = useCallback(async (ed: Editor, files: File[]) => {
    const folderId = await attachmentsFolder();
    const { storeFiles } = await import('../pages/Archivio');
    for (const f of files) {
      const before = Date.now();
      await storeFiles([f], folderId);
      const rec = await db.files.where('createdAt').aboveOrEqual(before).filter((x) => x.name === f.name).last();
      if (rec) ed.chain().focus().insertAttachment({ fileId: rec.id, name: f.name }).run();
    }
    ui.toast(files.length === 1 ? 'Allegato salvato anche nell’archivio' : 'Allegati salvati anche nell’archivio');
  }, [ui]);

  // load the fonts used in this note
  useEffect(() => {
    void loadFonts([...fontsInDoc(note.content), s.editorFont]);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void loadFont(s.editorFont); }, [s.editorFont]);

  // mark as opened
  useEffect(() => { void db.notes.update(note.id, { openedAt: Date.now() }); }, [note.id]);

  // flush pending saves when leaving
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); setFindOpen(true); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void flush(); ui.toast('Salvato'); }
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); void doPrint(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const saveTitle = (t: string) => {
    setTitle(t);
    schedule(() => db.notes.update(note.id, { title: t, updatedAt: Date.now() }).then(() => undefined));
  };

  const exportOpts = () => {
    const html = `<h1 class="doc-title">${escapeHtml(title || 'Appunti')}</h1>` + (editor?.getHTML() ?? '');
    return { title: title || 'Appunti', html, fonts: fontsInDoc(editor?.getJSON()), baseFont: s.editorFont, baseSize: s.editorFontSize, lineHeight: s.editorLineHeight };
  };
  const doPrint = async () => { await flush(); await printDocument(exportOpts()); };

  if (!editor) return null;
  const words = editor.storage.characterCount.words() as number;
  const chars = editor.storage.characterCount.characters() as number;
  const paper = notebook.paper ?? s.editorPaper;

  return (
    <>
      <Toolbar editor={editor} onFind={() => setFindOpen(!findOpen)} onDraw={() => setDrawing({ pos: null })}
        onAttach={async () => { const files = await pickFiles(''); if (files.length) await attachFiles(editor, files); }}
        onImage={async () => { const files = await pickFiles('image/*'); if (files.length) await insertImages(editor, files); }}
        onPrint={doPrint} onWord={async () => { await flush(); exportWord(exportOpts()); }} onHtml={async () => { await flush(); exportHTML(exportOpts()); }} />
      {findOpen && <FindBar editor={editor} onClose={() => { editor.commands.setSearchTerm(''); setFindOpen(false); }} />}
      <div className="editor-scroll">
        <div className={`paper w-${s.editorWidth} ${paper}`}
          style={{ fontFamily: cssFamily(s.editorFont), fontSize: s.editorFontSize, lineHeight: `${Math.round(s.editorFontSize * s.editorLineHeight)}px`, ['--lh' as string]: `${Math.round(s.editorFontSize * s.editorLineHeight)}px` }}>
          <input className="note-title" value={title} onChange={(e) => saveTitle(e.target.value)} placeholder="Titolo del capitolo" aria-label="Titolo" />
          <div className="note-meta no-print">
            <span>{notebook.title}</span>
            <span>Modificato {new Date(note.updatedAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="word-count no-print">
        {status === 'saved' && <><Check size={13} color="var(--success)" />Salvato</>}
        {status === 'saving' && <>Salvataggio…</>}
        {status === 'error' && <><CloudOff size={13} color="var(--danger)" />Non salvato</>}
        <span>·</span>{words.toLocaleString('it-IT')} parole · {chars.toLocaleString('it-IT')} caratteri · ~{Math.max(1, Math.round(words / 300))} pag.
      </div>
      {drawing && (
        <DrawingModal initial={drawing.attrs} paper={paper} onClose={() => setDrawing(null)}
          onSave={(attrs) => {
            if (drawing.pos !== null) {
              editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(drawing.pos!, undefined, attrs); return true; }).run();
            } else {
              editor.chain().focus().insertDrawing(attrs).run();
            }
            setDrawing(null);
          }}
          onDelete={drawing.pos !== null ? () => {
            editor.chain().focus().command(({ tr }) => { tr.delete(drawing.pos!, drawing.pos! + 1); return true; }).run();
            setDrawing(null);
          } : undefined} />
      )}
    </>
  );
}

/* ——— toolbar ——— */

function Pop({ anchor, onClose, children, width = 260 }: { anchor: HTMLElement; onClose: () => void; children: React.ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 6 });
  }, [anchor, width]);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose(); };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [anchor, onClose]);
  return createPortal(<div ref={ref} className="menu" style={{ ...pos, width, padding: 12 }}>{children}</div>, document.body);
}

function Toolbar({ editor, onFind, onDraw, onAttach, onImage, onPrint, onWord, onHtml }: {
  editor: Editor; onFind: () => void; onDraw: () => void; onAttach: () => void; onImage: () => void; onPrint: () => void; onWord: () => void; onHtml: () => void;
}) {
  const s = useSettings();
  const ui = useUI();
  const menu = useMenu();
  const [pop, setPop] = useState<{ kind: 'font' | 'color' | 'hl' | 'table'; el: HTMLElement } | null>(null);
  const ts = editor.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
  const currentFont = ts.fontFamily ? ts.fontFamily.split(',')[0].replace(/["']/g, '').trim() : s.editorFont;
  const currentSize = ts.fontSize ? parseInt(ts.fontSize, 10) : s.editorFontSize;
  const hl = editor.getAttributes('highlight') as { color?: string };
  const block = editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('heading', { level: 4 }) ? 'h4' : editor.isActive('blockquote') ? 'quote' : editor.isActive('codeBlock') ? 'code' : 'p';
  const lh = (editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight ?? '') as string;

  const B = ({ on, active, title, children, disabled }: { on: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) => (
    <button className={'tb-btn' + (active ? ' active' : '')} onMouseDown={(e) => e.preventDefault()} onClick={on} title={title} aria-label={title} disabled={disabled}>{children}</button>
  );
  const setSize = (n: number) => editor.chain().focus().setFontSize(`${Math.max(6, Math.min(120, n))}px`).run();
  const setBlock = (v: string) => {
    const c = editor.chain().focus();
    if (v === 'p') c.setParagraph().run();
    else if (v === 'quote') c.toggleBlockquote().run();
    else if (v === 'code') c.toggleCodeBlock().run();
    else c.setHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 }).run();
  };
  const setLink = async () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = await ui.prompt({ title: 'Collegamento', label: 'Indirizzo web (vuoto per rimuovere)', value: prev ?? 'https://' });
    if (url === null) return;
    if (!url.trim() || url === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="editor-toolbar no-print" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'SELECT' && (e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
      <B on={() => editor.chain().focus().undo().run()} title="Annulla" disabled={!editor.can().undo()}><Undo2 size={18} /></B>
      <B on={() => editor.chain().focus().redo().run()} title="Ripeti" disabled={!editor.can().redo()}><Redo2 size={18} /></B>
      <span className="sep" />
      <button className="tb-select" onClick={(e) => setPop({ kind: 'font', el: e.currentTarget })} style={{ fontFamily: cssFamily(currentFont), minWidth: 130 }} title="Carattere">
        <span className="ellipsis" style={{ maxWidth: 130 }}>{currentFont}</span><ChevronDown size={14} />
      </button>
      <div className="row" style={{ gap: 0 }}>
        <B on={() => setSize(currentSize - 1)} title="Riduci dimensione"><Minus size={14} /></B>
        <select className="tb-select" style={{ width: 64, padding: '0 6px' }} value={SIZES.includes(currentSize) ? currentSize : ''} onChange={(e) => setSize(Number(e.target.value))} title="Dimensione">
          {!SIZES.includes(currentSize) && <option value="">{currentSize}</option>}
          {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <B on={() => setSize(currentSize + 1)} title="Aumenta dimensione"><Plus size={14} /></B>
      </div>
      <select className="tb-select" value={block} onChange={(e) => setBlock(e.target.value)} title="Stile paragrafo">
        <option value="p">Testo normale</option>
        <option value="h1">Titolo 1</option>
        <option value="h2">Titolo 2</option>
        <option value="h3">Sottotitolo</option>
        <option value="h4">Sottotitolo piccolo</option>
        <option value="quote">Citazione</option>
        <option value="code">Codice / formula</option>
      </select>
      <span className="sep" />
      <B on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Grassetto (⌘B)"><Bold size={18} /></B>
      <B on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Corsivo (⌘I)"><Italic size={18} /></B>
      <B on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sottolineato (⌘U)"><UnderlineIcon size={18} /></B>
      <B on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Barrato"><Strikethrough size={18} /></B>
      <button className="tb-btn tb-color" onMouseDown={(e) => e.preventDefault()} onClick={(e) => setPop({ kind: 'color', el: e.currentTarget })} title="Colore del testo">
        <Baseline size={18} /><span className="bar" style={{ background: ts.color ?? 'var(--text)' }} />
      </button>
      <button className={'tb-btn tb-color' + (editor.isActive('highlight') ? ' active' : '')} onMouseDown={(e) => e.preventDefault()} onClick={(e) => setPop({ kind: 'hl', el: e.currentTarget })} title="Evidenziatore">
        <Highlighter size={18} /><span className="bar" style={{ background: hl.color ?? '#fff3a3' }} />
      </button>
      <span className="sep" />
      <B on={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Allinea a sinistra"><AlignLeft size={18} /></B>
      <B on={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centra"><AlignCenter size={18} /></B>
      <B on={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Allinea a destra"><AlignRight size={18} /></B>
      <B on={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Giustifica"><AlignJustify size={18} /></B>
      <select className="tb-select" value={lh} onChange={(e) => (e.target.value ? editor.chain().focus().setLineHeight(e.target.value).run() : editor.chain().focus().unsetLineHeight().run())} title="Interlinea" style={{ width: 92 }}>
        <option value="">Interl. ↕</option>
        {LINE_HEIGHTS.map((v) => <option key={v} value={v}>{v.replace('.', ',')}</option>)}
      </select>
      <span className="sep" />
      <B on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Elenco puntato"><List size={18} /></B>
      <B on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Elenco numerato"><ListOrdered size={18} /></B>
      <B on={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist"><ListChecks size={18} /></B>
      <B on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citazione"><Quote size={18} /></B>
      <B on={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Codice in linea"><Code size={18} /></B>
      <B on={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Pedice (H₂O)"><SubIcon size={18} /></B>
      <B on={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Apice (x²)"><SupIcon size={18} /></B>
      <B on={() => editor.chain().focus().setHorizontalRule().run()} title="Linea di separazione"><SeparatorHorizontal size={18} /></B>
      <span className="sep" />
      <button className={'tb-btn' + (editor.isActive('table') ? ' active' : '')} onMouseDown={(e) => e.preventDefault()} onClick={(e) => setPop({ kind: 'table', el: e.currentTarget })} title="Tabella"><TableIcon size={18} /></button>
      <B on={onImage} title="Inserisci immagine"><ImageIcon size={18} /></B>
      <B on={onAttach} title="Allega file"><Paperclip size={18} /></B>
      <B on={onDraw} title="Disegna / scrivi a mano (Apple Pencil)"><PenTool size={18} /></B>
      <B on={setLink} active={editor.isActive('link')} title="Collegamento"><Link2 size={18} /></B>
      <B on={() => editor.chain().focus().unsetAllMarks().clearNodes().unsetLineHeight().run()} title="Rimuovi formattazione"><Eraser size={18} /></B>
      <span className="sep" />
      <B on={onFind} title="Cerca nel testo (⌘F)"><Search size={18} /></B>
      <button className="tb-btn" onMouseDown={(e) => e.preventDefault()} title="Esporta e stampa"
        onClick={(e) => menu.open(e, [
          { label: 'Esporta PDF / Stampa', icon: <Printer size={16} />, onClick: onPrint },
          { label: 'Esporta Word (.doc)', icon: <FileDown size={16} />, onClick: onWord },
          { label: 'Esporta pagina web (.html)', icon: <FileDown size={16} />, onClick: onHtml },
        ])}>
        <FileDown size={18} />
      </button>
      {editor.isActive('image') && (
        <>
          <span className="sep" />
          <span className="tiny muted">Immagine:</span>
          {['25%', '50%', '75%', '100%'].map((w) => (
            <B key={w} on={() => editor.chain().focus().updateAttributes('image', { width: w }).run()} active={editor.getAttributes('image').width === w} title={'Larghezza ' + w}><span style={{ fontSize: '.78rem' }}>{w}</span></B>
          ))}
        </>
      )}

      {pop?.kind === 'font' && (
        <FontPicker anchor={pop.el} current={currentFont} onClose={() => setPop(null)}
          onPick={(f) => { void loadFont(f).then(() => editor.chain().focus().setFontFamily(cssFamily(f)).run()); }} />
      )}
      {pop?.kind === 'color' && (
        <Pop anchor={pop.el} onClose={() => setPop(null)}>
          <div className="swatches">
            {TEXT_COLORS.map((c) => <button key={c} className="swatch" style={{ background: c }} onClick={() => { editor.chain().focus().setColor(c).run(); setPop(null); }} aria-label={c} />)}
            <label className="swatch" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', position: 'relative' }}>
              <input type="color" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} style={{ opacity: 0, position: 'absolute', inset: 0 }} />
            </label>
          </div>
          <button className="btn btn-sm btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { editor.chain().focus().unsetColor().run(); setPop(null); }}><X size={14} />Colore automatico</button>
        </Pop>
      )}
      {pop?.kind === 'hl' && (
        <Pop anchor={pop.el} onClose={() => setPop(null)}>
          <div className="swatches">
            {HL_COLORS.map((c) => <button key={c} className="swatch" style={{ background: c }} onClick={() => { editor.chain().focus().setHighlight({ color: c }).run(); setPop(null); }} aria-label={c} />)}
          </div>
          <button className="btn btn-sm btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { editor.chain().focus().unsetHighlight().run(); setPop(null); }}><X size={14} />Togli evidenziazione</button>
        </Pop>
      )}
      {pop?.kind === 'table' && (
        <Pop anchor={pop.el} onClose={() => setPop(null)} width={240}>
          <div className="stack" style={{ gap: 4 }}>
            {!editor.isActive('table') ? (
              <button className="btn btn-sm btn-soft" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setPop(null); }}>Inserisci tabella 3×3</button>
            ) : (
              <>
                {([
                  ['Riga sopra', () => editor.chain().focus().addRowBefore().run()],
                  ['Riga sotto', () => editor.chain().focus().addRowAfter().run()],
                  ['Colonna a sinistra', () => editor.chain().focus().addColumnBefore().run()],
                  ['Colonna a destra', () => editor.chain().focus().addColumnAfter().run()],
                  ['Elimina riga', () => editor.chain().focus().deleteRow().run()],
                  ['Elimina colonna', () => editor.chain().focus().deleteColumn().run()],
                  ['Unisci / dividi celle', () => editor.chain().focus().mergeOrSplit().run()],
                  ['Intestazione on/off', () => editor.chain().focus().toggleHeaderRow().run()],
                  ['Elimina tabella', () => editor.chain().focus().deleteTable().run()],
                ] as [string, () => void][]).map(([l, f]) => <button key={l} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={() => { f(); }}>{l}</button>)}
              </>
            )}
          </div>
        </Pop>
      )}
      {menu.node}
    </div>
  );
}

function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [rep, setRep] = useState('');
  const [cs, setCs] = useState(false);
  const st = searchKey.getState(editor.state);
  useEffect(() => { editor.commands.setSearchTerm(term, cs); }, [term, cs, editor]);
  return (
    <div className="find-bar no-print">
      <Search size={16} color="var(--muted)" />
      <input className="input" autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cerca nel capitolo"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) editor.commands.prevSearchResult(); else editor.commands.nextSearchResult(); } if (e.key === 'Escape') onClose(); }} />
      <span className="small muted" style={{ minWidth: 60 }}>{term ? (st?.results.length ? `${st.index + 1} di ${st.results.length}` : 'Nessuno') : ''}</span>
      <button className="btn btn-sm" onClick={() => editor.commands.prevSearchResult()}>‹</button>
      <button className="btn btn-sm" onClick={() => editor.commands.nextSearchResult()}>›</button>
      <label className="row small" style={{ gap: 4 }}><input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} />Aa</label>
      <input className="input" value={rep} onChange={(e) => setRep(e.target.value)} placeholder="Sostituisci con" />
      <button className="btn btn-sm" onClick={() => editor.commands.replaceCurrent(rep)} disabled={!st?.results.length}>Sostituisci</button>
      <button className="btn btn-sm" onClick={() => editor.commands.replaceAll(rep)} disabled={!st?.results.length}>Tutti</button>
      <button className="icon-btn sm" onClick={onClose} aria-label="Chiudi ricerca"><X size={16} /></button>
    </div>
  );
}

const PAPER_BG: Record<string, string> = {
  blank: '#ffffff',
  lines: 'repeating-linear-gradient(#fff 0 31px, #cfe6f7 31px 32px)',
  grid: '#fff linear-gradient(#e2eef8 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, #e2eef8 1px, #fff 1px) 0 0 / 24px 24px',
  dots: '#fff radial-gradient(#b9d7ee 1.3px, transparent 1.5px) 0 0 / 24px 24px',
};

function DrawingModal({ initial, paper, onSave, onClose, onDelete }: {
  initial?: DrawingAttrs; paper: string; onSave: (a: DrawingAttrs) => void; onClose: () => void; onDelete?: () => void;
}) {
  const ref = useRef<DrawingHandle>(null);
  const [bg, setBg] = useState(initial?.paper ?? paper);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: initial?.w ?? 1000, h: initial?.h ?? 700 });
  const strokes = initial ? (JSON.parse(initial.strokes || '[]') as Stroke[]) : undefined;
  const save = () => {
    const h = ref.current;
    if (!h) return;
    if (h.isEmpty()) { onClose(); return; }
    onSave({ src: h.toDataURL(false, 1.5), strokes: JSON.stringify(h.strokes().map((s) => ({ ...s, points: s.points.map((p) => p.map((n) => Math.round(n * 10) / 10)) }))), w: size.w, h: size.h, paper: bg });
  };
  return (
    <Modal title={initial ? 'Modifica disegno' : 'Scrivi o disegna a mano'} size="full" onClose={onClose}
      footer={<>
        {onDelete && <button className="btn btn-danger" onClick={onDelete}>Elimina disegno</button>}
        <span className="tiny muted grow">Con Apple Pencil la pressione cambia lo spessore del tratto. Attiva “Solo Pencil” per appoggiare la mano sullo schermo.</span>
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" onClick={save}>Inserisci negli appunti</button>
      </>}>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <span className="small muted">Foglio:</span>
        {[['blank', 'Bianco'], ['lines', 'Righe'], ['grid', 'Quadretti'], ['dots', 'Puntini']].map(([v, l]) => (
          <button key={v} className={'chip' + (bg === v ? ' active' : '')} onClick={() => setBg(v)}>{l}</button>
        ))}
        {!initial && <>
          <span className="small muted" style={{ marginLeft: 8 }}>Formato:</span>
          <button className={'chip' + (size.h === 700 ? ' active' : '')} onClick={() => setSize({ w: 1000, h: 700 })}>Orizzontale</button>
          <button className={'chip' + (size.h === 1400 ? ' active' : '')} onClick={() => setSize({ w: 1000, h: 1400 })}>Pagina intera</button>
          <button className={'chip' + (size.h === 400 ? ' active' : '')} onClick={() => setSize({ w: 1000, h: 400 })}>Striscia</button>
        </>}
      </div>
      <DrawingCanvas key={`${size.w}x${size.h}`} ref={ref} width={size.w} height={size.h} initial={strokes} paper={PAPER_BG[bg]} />
    </Modal>
  );
}
