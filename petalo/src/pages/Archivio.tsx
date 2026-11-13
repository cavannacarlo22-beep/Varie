import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronRight, Download, File, FileImage, FileSpreadsheet, FileText, Folder, FolderInput, FolderOpen, FolderPlus, Grid2x2, Home, List, MoreVertical,
  Pencil, Search, Star, Trash2, Upload,
} from 'lucide-react';
import { db, uid } from '../db/db';
import type { FileCategory, FileRec, Folder as FolderT } from '../db/types';
import { CATEGORY_COLOR, CATEGORY_LABEL, categorize, download, fmtSize, pickFiles } from '../lib/files';
import { fmtRelative } from '../lib/dates';
import { FileViewer } from '../components/FileViewer';
import { Empty, Modal, Swatches, useMenu, useUI } from '../components/ui';

const ICON: Partial<Record<FileCategory, typeof File>> = { pdf: FileText, word: FileText, excel: FileSpreadsheet, immagine: FileImage };

export async function storeFiles(files: File[], folderId: string | null): Promise<number> {
  const now = Date.now();
  const recs: FileRec[] = files.map((f, i) => ({
    id: uid(), name: f.name, folderId, mime: f.type || 'application/octet-stream', size: f.size, category: categorize(f.name, f.type),
    blob: f, favorite: false, tags: [], createdAt: now + i, updatedAt: now + i,
  }));
  await db.files.bulkAdd(recs);
  return recs.length;
}

export default function Archivio() {
  const { folderId = null } = useParams();
  const nav = useNavigate();
  const ui = useUI();
  const menu = useMenu();
  const folders = useLiveQuery(() => db.folders.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FileCategory | 'all' | 'fav'>('all');
  const [sort, setSort] = useState<'recent' | 'name' | 'size'>('recent');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<FileRec | null>(null);
  const [moving, setMoving] = useState<FileRec | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const searching = q.trim() !== '' || cat !== 'all';

  const files = useLiveQuery(async () => {
    let list: FileRec[];
    if (searching) list = await db.files.toArray();
    else list = folderId ? await db.files.where('folderId').equals(folderId).toArray() : await db.files.filter((f) => f.folderId === null).toArray();
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((f) => f.name.toLowerCase().includes(needle) || f.tags.some((t) => t.toLowerCase().includes(needle)));
    if (cat === 'fav') list = list.filter((f) => f.favorite);
    else if (cat !== 'all') list = list.filter((f) => f.category === cat);
    list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'it') : sort === 'size' ? b.size - a.size : b.createdAt - a.createdAt);
    return list;
  }, [folderId, q, cat, sort]);

  const usage = useLiveQuery(async () => {
    let size = 0;
    let n = 0;
    await db.files.each((f) => { size += f.size; n++; });
    return { size, n };
  }, []);

  const current = folders.find((f) => f.id === folderId) ?? null;
  const children = folders.filter((f) => f.parentId === (folderId ?? null)).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const crumbs = useMemo(() => {
    const out: FolderT[] = [];
    let f = current;
    while (f) { out.unshift(f); f = folders.find((x) => x.id === f!.parentId) ?? null; }
    return out;
  }, [current, folders]);

  const upload = async (list?: File[]) => {
    const picked = list ?? await pickFiles('');
    if (!picked.length) return;
    try {
      const n = await storeFiles(picked, folderId);
      ui.toast(n === 1 ? 'File salvato nell’archivio' : `${n} file salvati nell’archivio`);
    } catch (e) {
      console.error(e);
      ui.toast('Spazio insufficiente o file non leggibile', true);
    }
  };

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => { window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); };
  }, []);

  const fileMenu = (e: React.MouseEvent, f: FileRec) => {
    e.stopPropagation();
    menu.open(e, [
      { label: 'Apri', icon: <FolderOpen size={16} />, onClick: () => setOpen(f) },
      { label: f.favorite ? 'Togli dai preferiti' : 'Aggiungi ai preferiti', icon: <Star size={16} />, onClick: () => db.files.update(f.id, { favorite: !f.favorite }) },
      { label: 'Rinomina', icon: <Pencil size={16} />, onClick: async () => {
        const n = await ui.prompt({ title: 'Rinomina file', value: f.name });
        if (n?.trim()) await db.files.update(f.id, { name: n.trim(), updatedAt: Date.now() });
      } },
      { label: 'Etichette', icon: <Pencil size={16} />, onClick: async () => {
        const n = await ui.prompt({ title: 'Etichette (separate da virgola)', value: f.tags.join(', '), label: 'Es. esame, slide, 2° semestre' });
        if (n !== null) await db.files.update(f.id, { tags: n.split(',').map((t) => t.trim()).filter(Boolean) });
      } },
      { label: 'Sposta in…', icon: <FolderInput size={16} />, onClick: () => setMoving(f) },
      { label: 'Scarica', icon: <Download size={16} />, onClick: () => download(f.blob, f.name) },
      { divider: true, label: '', onClick: () => {} },
      { label: 'Elimina', icon: <Trash2 size={16} />, danger: true, onClick: async () => {
        if (await ui.confirm({ title: 'Eliminare il file?', message: `“${f.name}” verrà eliminato definitivamente.`, ok: 'Elimina', danger: true })) {
          await db.files.delete(f.id);
          ui.toast('File eliminato');
        }
      } },
    ]);
  };

  const folderMenu = (e: React.MouseEvent, f: FolderT) => {
    e.stopPropagation();
    menu.open(e, [
      { label: 'Rinomina', icon: <Pencil size={16} />, onClick: async () => {
        const n = await ui.prompt({ title: 'Rinomina cartella', value: f.name });
        if (n?.trim()) await db.folders.update(f.id, { name: n.trim() });
      } },
      { label: 'Elimina cartella', icon: <Trash2 size={16} />, danger: true, onClick: async () => {
        const ids = descendants(folders, f.id);
        const n = await db.files.where('folderId').anyOf(ids).count();
        if (await ui.confirm({ title: `Eliminare “${f.name}”?`, message: n ? `Verranno eliminati anche ${n} file e le sottocartelle.` : 'Verranno eliminate anche le sottocartelle.', ok: 'Elimina', danger: true })) {
          await db.transaction('rw', db.files, db.folders, async () => {
            await db.files.where('folderId').anyOf(ids).delete();
            await db.folders.bulkDelete(ids);
          });
          if (ids.includes(folderId ?? '')) nav('/archivio');
        }
      } },
    ]);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Archivio documenti</h1>
          <p>{usage ? `${usage.n} file · ${fmtSize(usage.size)} salvati sul dispositivo` : ''}</p>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => setNewFolder(true)}><FolderPlus size={18} />Nuova cartella</button>
          <button className="btn btn-primary" onClick={() => upload()}><Upload size={18} />Carica file</button>
        </div>
      </div>

      <div className="files-layout">
        <aside className="card" style={{ padding: 10 }}>
          <div className="folder-tree">
            <button className={!folderId && !searching ? 'active' : ''} onClick={() => { setQ(''); setCat('all'); nav('/archivio'); }}><Home size={17} />Tutti i documenti</button>
            <button className={cat === 'fav' ? 'active' : ''} onClick={() => setCat('fav')}><Star size={17} />Preferiti</button>
            <div className="nav-section" style={{ padding: '12px 10px 4px' }}>Cartelle</div>
            <FolderTree folders={folders} parent={null} active={folderId} depth={0} onOpen={(id) => { setQ(''); setCat('all'); nav('/archivio/' + id); }} onMenu={folderMenu} />
            {folders.length === 0 && <p className="tiny muted" style={{ padding: '0 10px' }}>Crea cartelle per materia, anno o argomento.</p>}
          </div>
        </aside>

        <div className="stack" style={{ minWidth: 0 }}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void upload(Array.from(e.dataTransfer.files)); }}>
          <div className="row wrap">
            <div className="search grow" style={{ minWidth: 200 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca un documento per nome o etichetta" /></div>
            <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="recent">Più recenti</option><option value="name">Nome A–Z</option><option value="size">Più grandi</option>
            </select>
            <button className={'icon-btn' + (layout === 'grid' ? ' active' : '')} onClick={() => setLayout('grid')} aria-label="Griglia"><Grid2x2 size={18} /></button>
            <button className={'icon-btn' + (layout === 'list' ? ' active' : '')} onClick={() => setLayout('list')} aria-label="Elenco"><List size={18} /></button>
          </div>
          <div className="chips scroll">
            <button className={'chip' + (cat === 'all' ? ' active' : '')} onClick={() => setCat('all')}>Tutti</button>
            {(['pdf', 'word', 'excel', 'immagine', 'presentazione', 'testo', 'altro'] as FileCategory[]).map((c) => (
              <button key={c} className={'chip' + (cat === c ? ' active' : '')} onClick={() => setCat(c)}><span className="dot" style={{ background: CATEGORY_COLOR[c] }} />{CATEGORY_LABEL[c]}</button>
            ))}
          </div>

          {!searching && (
            <div className="row small" style={{ gap: 4, flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => nav('/archivio')}><Home size={14} />Archivio</button>
              {crumbs.map((c) => (
                <span key={c.id} className="row" style={{ gap: 4 }}><ChevronRight size={14} color="var(--muted)" /><button className="btn btn-sm btn-ghost" onClick={() => nav('/archivio/' + c.id)}>{c.name}</button></span>
              ))}
            </div>
          )}

          {!searching && children.length > 0 && (
            <div className="file-grid">
              {children.map((f) => (
                <div key={f.id} className="file-tile" role="button" tabIndex={0} onClick={() => nav('/archivio/' + f.id)} onKeyDown={(e) => e.key === 'Enter' && nav('/archivio/' + f.id)}
                  onContextMenu={(e) => { e.preventDefault(); folderMenu(e, f); }}>
                  <div className="row">
                    <Folder size={30} color={f.color} fill={f.color + '55'} />
                    <div className="grow"><div className="file-name">{f.name}</div><div className="file-meta">Cartella</div></div>
                    <button className="icon-btn sm" onClick={(e) => folderMenu(e, f)} aria-label="Opzioni cartella"><MoreVertical size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={'dropzone' + (over ? ' over' : '')}>
            <Upload size={22} style={{ verticalAlign: -5 }} /> Trascina qui i file oppure <button className="btn btn-sm btn-soft" onClick={() => upload()}>scegli dal dispositivo</button>
            <div className="tiny muted" style={{ marginTop: 6 }}>PDF, Word, Excel, PowerPoint, immagini, audio… Su iPad puoi scegliere da File, Foto o iCloud Drive.</div>
          </div>

          {files && files.length === 0 && (children.length === 0 || searching) && (
            <div className="card"><Empty title={searching ? 'Nessun risultato' : 'Questa cartella è vuota'} text={searching ? 'Prova con un’altra parola o categoria.' : 'Carica i tuoi documenti: resteranno salvati anche dopo aver chiuso l’app.'} /></div>
          )}

          {layout === 'grid' ? (
            <div className="file-grid">
              {files?.map((f) => <FileTile key={f.id} file={f} folders={folders} showFolder={searching} onOpen={() => setOpen(f)} onMenu={(e) => fileMenu(e, f)} />)}
            </div>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              {files?.map((f) => {
                const Icon = ICON[f.category] ?? File;
                return (
                  <div key={f.id} className="list-row" style={{ cursor: 'pointer', padding: '8px 10px' }} onClick={() => setOpen(f)}>
                    <Icon size={22} color={CATEGORY_COLOR[f.category]} />
                    <div className="grow"><div className="ellipsis" style={{ fontWeight: 600 }}>{f.name}</div><div className="tiny muted">{CATEGORY_LABEL[f.category]} · {fmtSize(f.size)} · {fmtRelative(f.createdAt)}</div></div>
                    {f.favorite && <Star size={15} fill="var(--warning)" color="var(--warning)" />}
                    <button className="icon-btn sm" onClick={(e) => fileMenu(e, f)} aria-label="Opzioni"><MoreVertical size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {open && <FileViewer file={open} onClose={() => setOpen(null)} />}
      {moving && <MoveDialog folders={folders} onClose={() => setMoving(null)} onPick={async (id) => { await db.files.update(moving.id, { folderId: id }); ui.toast('File spostato'); setMoving(null); }} />}
      {newFolder && <NewFolder parentId={folderId} onClose={() => setNewFolder(false)} />}
      {menu.node}
    </div>
  );
}

function descendants(folders: FolderT[], id: string): string[] {
  const out = [id];
  for (const f of folders) if (f.parentId === id) out.push(...descendants(folders, f.id));
  return out;
}

function FolderTree({ folders, parent, active, depth, onOpen, onMenu }: {
  folders: FolderT[]; parent: string | null; active: string | null; depth: number; onOpen: (id: string) => void; onMenu: (e: React.MouseEvent, f: FolderT) => void;
}) {
  const kids = folders.filter((f) => f.parentId === parent).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  return (
    <>
      {kids.map((f) => (
        <div key={f.id}>
          <button className={active === f.id ? 'active' : ''} style={{ paddingLeft: 10 + depth * 16 }} onClick={() => onOpen(f.id)} onContextMenu={(e) => { e.preventDefault(); onMenu(e, f); }}>
            <Folder size={17} color={f.color} fill={f.color + '44'} /><span className="ellipsis">{f.name}</span>
          </button>
          <FolderTree folders={folders} parent={f.id} active={active} depth={depth + 1} onOpen={onOpen} onMenu={onMenu} />
        </div>
      ))}
    </>
  );
}

function FileTile({ file, folders, showFolder, onOpen, onMenu }: { file: FileRec; folders: FolderT[]; showFolder: boolean; onOpen: () => void; onMenu: (e: React.MouseEvent) => void }) {
  const [thumb, setThumb] = useState('');
  useEffect(() => {
    if (file.category !== 'immagine' || /heic|heif/i.test(file.name)) return;
    const u = URL.createObjectURL(file.blob);
    setThumb(u);
    return () => URL.revokeObjectURL(u);
  }, [file.blob, file.category, file.name]);
  const Icon = ICON[file.category] ?? File;
  const folder = folders.find((f) => f.id === file.folderId);
  return (
    <div className="file-tile" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} onContextMenu={(e) => { e.preventDefault(); onMenu(e); }}>
      <div className="file-thumb" style={{ background: CATEGORY_COLOR[file.category] + '1c' }}>
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : (
          <div style={{ textAlign: 'center', color: CATEGORY_COLOR[file.category] }}>
            <Icon size={38} strokeWidth={1.5} />
            <div className="tiny" style={{ fontWeight: 700, textTransform: 'uppercase' }}>{file.name.split('.').pop()}</div>
          </div>
        )}
      </div>
      <div className="file-name" title={file.name}>{file.name}</div>
      <div className="file-meta">{fmtSize(file.size)} · {fmtRelative(file.createdAt)}{showFolder && folder ? ` · ${folder.name}` : ''}</div>
      {file.favorite && <Star size={14} fill="var(--warning)" color="var(--warning)" style={{ position: 'absolute', top: 14, left: 14 }} />}
      <button className="icon-btn sm more-btn" onClick={onMenu} aria-label="Opzioni file"><MoreVertical size={16} /></button>
    </div>
  );
}

function MoveDialog({ folders, onClose, onPick }: { folders: FolderT[]; onClose: () => void; onPick: (id: string | null) => void }) {
  return (
    <Modal title="Sposta in…" onClose={onClose}>
      <div className="folder-tree">
        <button onClick={() => onPick(null)}><Home size={17} />Archivio (cartella principale)</button>
        <FolderTree folders={folders} parent={null} active={null} depth={0} onOpen={(id) => onPick(id)} onMenu={() => {}} />
      </div>
    </Modal>
  );
}

function NewFolder({ parentId, onClose }: { parentId: string | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#e46f8e');
  const save = async () => {
    if (!name.trim()) return;
    await db.folders.add({ id: uid(), name: name.trim(), parentId, color, createdAt: Date.now() });
    onClose();
  };
  return (
    <Modal title={parentId ? 'Nuova sottocartella' : 'Nuova cartella'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Crea</button></>}>
      <div className="stack">
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Economia aziendale" onKeyDown={(e) => e.key === 'Enter' && save()} />
        <Swatches value={color} onChange={setColor} />
      </div>
    </Modal>
  );
}
