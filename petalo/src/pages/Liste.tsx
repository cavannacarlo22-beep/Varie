import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft, Calendar, CheckCheck, ChevronDown, ChevronRight, Copy, Flag, GripVertical, MoreHorizontal, Pencil, Pin, Plus, Search, StickyNote, Trash2,
} from 'lucide-react';
import { db, uid } from '../db/db';
import type { ListItem, ListKind, TodoList } from '../db/types';
import { fromISO, todayISO } from '../lib/dates';
import { Empty, Modal, Progress, Swatches, useMenu, useUI } from '../components/ui';

const KINDS: { id: ListKind; label: string; emoji: string; color: string }[] = [
  { id: 'studio', label: 'Studio', emoji: '📚', color: '#bfa8e8' },
  { id: 'lavoro', label: 'Lavoro', emoji: '💼', color: '#7fbfe8' },
  { id: 'casa', label: 'Casa', emoji: '🏡', color: '#8fd0b0' },
  { id: 'personale', label: 'Personale', emoji: '🌸', color: '#f39cc0' },
  { id: 'spesa', label: 'Spesa', emoji: '🛒', color: '#f6bf95' },
  { id: 'viaggi', label: 'Viaggi', emoji: '✈️', color: '#5fa8dc' },
  { id: 'altro', label: 'Altro', emoji: '✨', color: '#e46f8e' },
];
const EMOJIS = ['📚', '📝', '💼', '🏡', '🌸', '🛒', '✈️', '✨', '💖', '🎓', '🧘‍♀️', '🏋️‍♀️', '🎁', '💄', '🍰', '🐾', '🎬', '📖', '💡', '🧺', '🌷', '☕', '🎀', '💰'];
const PRIO_COLOR = ['transparent', '#7fbfe8', '#f2a35e', '#e46f8e'];
const PRIO_LABEL = ['Nessuna', 'Bassa', 'Media', 'Alta'];

export default function Liste() {
  const { listId } = useParams();
  const nav = useNavigate();
  const ui = useUI();
  const lists = useLiveQuery(() => db.lists.orderBy('order').toArray(), []);
  const counts = useLiveQuery(async () => {
    const m = new Map<string, { done: number; total: number }>();
    await db.items.each((i) => {
      const c = m.get(i.listId) ?? { done: 0, total: 0 };
      c.total++;
      if (i.done) c.done++;
      m.set(i.listId, c);
    });
    return m;
  }, []);
  const [kind, setKind] = useState<ListKind | 'all'>('all');
  const [editList, setEditList] = useState<TodoList | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!lists) return null;
  const sorted = [...lists].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
  const shown = kind === 'all' ? sorted : sorted.filter((l) => l.kind === kind);
  const active = lists.find((l) => l.id === listId) ?? (window.innerWidth > 1023 ? shown[0] : undefined);

  const newList = () => {
    const k = KINDS.find((x) => x.id === kind) ?? KINDS[3];
    setEditList({ id: '', title: '', kind: k.id, color: k.color, emoji: k.emoji, order: lists.length, pinned: false, createdAt: 0, updatedAt: 0 });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = shown.map((l) => l.id);
    const next = arrayMove(shown, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    await db.transaction('rw', db.lists, async () => {
      for (let i = 0; i < next.length; i++) await db.lists.update(next[i].id, { order: i });
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Le mie liste</h1>
          <p>Crea tutte le liste che vuoi: studio, lavoro, casa, spesa, viaggi…</p>
        </div>
        <button className="btn btn-primary" onClick={newList}><Plus size={18} />Nuova lista</button>
      </div>
      <div className="chips scroll" style={{ marginBottom: 16 }}>
        <button className={'chip' + (kind === 'all' ? ' active' : '')} onClick={() => setKind('all')}>Tutte</button>
        {KINDS.map((k) => (
          <button key={k.id} className={'chip' + (kind === k.id ? ' active' : '')} onClick={() => setKind(k.id)}>{k.emoji} {k.label}</button>
        ))}
      </div>
      <div className="lists-layout">
        <div className="card" style={{ padding: 10, display: active && window.innerWidth <= 1023 && listId ? 'none' : undefined }}>
          {shown.length === 0 ? (
            <Empty title="Nessuna lista" text="Crea la tua prima lista e inizia a spuntare." action={<button className="btn btn-soft" onClick={newList}><Plus size={16} />Crea lista</button>} />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={shown.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                {shown.map((l) => (
                  <SortableListCard key={l.id} list={l} active={active?.id === l.id} count={counts?.get(l.id)} onClick={() => nav(`/liste/${l.id}`)} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
        {active ? (
          <ListDetail key={active.id} list={active} onBack={() => nav('/liste')} onEdit={() => setEditList(active)}
            onDeleted={() => { nav('/liste'); ui.toast('Lista eliminata'); }} />
        ) : lists.length > 0 && window.innerWidth > 1023 ? (
          <div className="card"><Empty title="Scegli una lista" /></div>
        ) : null}
      </div>
      {editList && <ListEditor list={editList} onClose={() => setEditList(null)} onCreated={(id) => nav(`/liste/${id}`)} />}
    </div>
  );
}

function SortableListCard({ list, active, count, onClick }: { list: TodoList; active: boolean; count?: { done: number; total: number }; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: list.id });
  const pct = count?.total ? count.done / count.total : 0;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} {...attributes} {...listeners}>
      <button className={'list-card' + (active ? ' active' : '')} onClick={onClick}>
        <span className="list-emoji" style={{ background: list.color + '33' }}>{list.emoji}</span>
        <div className="grow">
          <div className="row" style={{ gap: 6 }}>
            <b className="ellipsis">{list.title}</b>
            {list.pinned && <Pin size={12} color="var(--primary)" />}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <div className="grow"><div className="progress" style={{ height: 6 }}><div style={{ width: `${pct * 100}%`, background: list.color }} /></div></div>
            <span className="tiny muted">{count?.done ?? 0}/{count?.total ?? 0}</span>
          </div>
        </div>
      </button>
    </div>
  );
}

function ListDetail({ list, onBack, onEdit, onDeleted }: { list: TodoList; onBack: () => void; onEdit: () => void; onDeleted: () => void }) {
  const ui = useUI();
  const menu = useMenu();
  const items = useLiveQuery(() => db.items.where('listId').equals(list.id).sortBy('order'), [list.id]) ?? [];
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(true);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<ListItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = q ? items.filter((i) => i.text.toLowerCase().includes(q.toLowerCase())) : items;
  const todo = filtered.filter((i) => !i.done);
  const done = filtered.filter((i) => i.done);
  const pct = items.length ? items.filter((i) => i.done).length / items.length : 0;

  const add = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const max = items.reduce((m, i) => Math.max(m, i.order), -1);
    await db.items.bulkAdd(lines.map((t, k) => ({
      id: uid(), listId: list.id, text: t, note: '', done: false, order: max + 1 + k, dueDate: '', priority: 0 as const, createdAt: Date.now(), completedAt: null,
    })));
    await db.lists.update(list.id, { updatedAt: Date.now() });
    setText('');
  };
  const toggle = (i: ListItem) => db.items.update(i.id, { done: !i.done, completedAt: i.done ? null : Date.now() });

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = todo.map((i) => i.id);
    const next = arrayMove(todo, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    await db.transaction('rw', db.items, async () => {
      for (let k = 0; k < next.length; k++) await db.items.update(next[k].id, { order: k });
    });
  };

  const openMenu = (e: React.MouseEvent) => menu.open(e, [
    { label: 'Modifica lista', icon: <Pencil size={16} />, onClick: onEdit },
    { label: list.pinned ? 'Rimuovi dai fissati' : 'Fissa in alto', icon: <Pin size={16} />, onClick: () => db.lists.update(list.id, { pinned: !list.pinned }) },
    { label: 'Duplica lista', icon: <Copy size={16} />, onClick: async () => {
      const id = uid();
      await db.lists.add({ ...list, id, title: list.title + ' (copia)', createdAt: Date.now(), updatedAt: Date.now(), order: list.order + 0.5 });
      await db.items.bulkAdd(items.map((i) => ({ ...i, id: uid(), listId: id })));
      ui.toast('Lista duplicata');
    } },
    { label: 'Segna tutto come fatto', icon: <CheckCheck size={16} />, onClick: () => db.items.where('listId').equals(list.id).modify({ done: true, completedAt: Date.now() }) },
    { label: 'Ripristina tutto (da fare)', icon: <ChevronDown size={16} />, onClick: () => db.items.where('listId').equals(list.id).modify({ done: false, completedAt: null }) },
    { label: 'Elimina completate', icon: <Trash2 size={16} />, onClick: () => db.items.where('listId').equals(list.id).filter((i) => i.done).delete() },
    { divider: true, label: '', onClick: () => {} },
    { label: 'Elimina lista', icon: <Trash2 size={16} />, danger: true, onClick: async () => {
      if (await ui.confirm({ title: `Eliminare “${list.title}”?`, message: `La lista e le sue ${items.length} attività verranno eliminate.`, ok: 'Elimina', danger: true })) {
        await db.transaction('rw', db.lists, db.items, async () => {
          await db.items.where('listId').equals(list.id).delete();
          await db.lists.delete(list.id);
        });
        onDeleted();
      }
    } },
  ]);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="icon-btn" onClick={onBack} aria-label="Indietro" style={{ display: window.innerWidth <= 1023 ? undefined : 'none' }}><ArrowLeft size={20} /></button>
        <span className="list-emoji" style={{ background: list.color + '33', width: 48, height: 48, fontSize: '1.5rem' }}>{list.emoji}</span>
        <div className="grow">
          <h2 className="ellipsis">{list.title}</h2>
          <div className="small muted">{items.filter((i) => i.done).length} di {items.length} completate · {Math.round(pct * 100)}%</div>
        </div>
        <button className="icon-btn" onClick={openMenu} aria-label="Opzioni"><MoreHorizontal size={20} /></button>
      </div>
      <Progress value={pct} />

      <form className="row" style={{ marginTop: 16, alignItems: 'flex-start' }} onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <textarea className="textarea" style={{ minHeight: 44, height: 44 }} rows={1} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void add(); } }}
          placeholder="Aggiungi un’attività…" title="Puoi incollare più righe per aggiungere tante attività insieme" />
        <button className="btn btn-primary" type="submit"><Plus size={18} />Aggiungi</button>
      </form>
      {items.length > 6 && (
        <div className="search" style={{ marginTop: 10 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nella lista" /></div>
      )}

      <div style={{ marginTop: 16 }}>
        {todo.length === 0 && done.length === 0 && <Empty title="Lista vuota" text="Scrivi qui sopra la prima attività." />}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={todo.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {todo.map((i) => <TodoRow key={i.id} item={i} onToggle={() => toggle(i)} onOpen={() => setDetail(i)} sortable={!q} />)}
          </SortableContext>
        </DndContext>
        {done.length > 0 && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => setShowDone(!showDone)}>
              {showDone ? <ChevronDown size={16} /> : <ChevronRight size={16} />}Completate ({done.length})
            </button>
            {showDone && <div style={{ marginTop: 8 }}>{done.map((i) => <TodoRow key={i.id} item={i} onToggle={() => toggle(i)} onOpen={() => setDetail(i)} sortable={false} />)}</div>}
          </>
        )}
      </div>
      {detail && <ItemEditor item={detail} onClose={() => setDetail(null)} />}
      {menu.node}
    </div>
  );
}

function TodoRow({ item, onToggle, onOpen, sortable }: { item: ListItem; onToggle: () => void; onOpen: () => void; sortable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !sortable });
  const [text, setText] = useState(item.text);
  const late = !item.done && item.dueDate && item.dueDate < todayISO();
  return (
    <div ref={setNodeRef} className={'todo' + (item.done ? ' done' : '')}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1, zIndex: isDragging ? 2 : undefined, position: 'relative', boxShadow: isDragging ? 'var(--shadow-lg)' : undefined }}>
      {sortable ? <button className="drag-handle" {...attributes} {...listeners} aria-label="Trascina per riordinare"><GripVertical size={18} /></button> : <span style={{ width: 32 }} />}
      <input type="checkbox" className="checkbox" checked={item.done} onChange={onToggle} aria-label="Completata" />
      {item.priority > 0 && <span className="prio" style={{ background: PRIO_COLOR[item.priority] }} title={'Priorità ' + PRIO_LABEL[item.priority]} />}
      <div className="grow">
        <input className="todo-text" value={text} onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && text !== item.text && db.items.update(item.id, { text: text.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Testo attività" />
        {(item.dueDate || item.note) && (
          <div className="tiny row" style={{ gap: 10, paddingLeft: 4, color: late ? 'var(--danger)' : 'var(--muted)' }}>
            {item.dueDate && <span className="row" style={{ gap: 3 }}><Calendar size={11} />{fromISO(item.dueDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>}
            {item.note && <span className="row ellipsis" style={{ gap: 3 }}><StickyNote size={11} />{item.note}</span>}
          </div>
        )}
      </div>
      <button className="icon-btn sm" onClick={onOpen} aria-label="Dettagli"><MoreHorizontal size={16} /></button>
    </div>
  );
}

function ItemEditor({ item, onClose }: { item: ListItem; onClose: () => void }) {
  const ui = useUI();
  const lists = useLiveQuery(() => db.lists.orderBy('order').toArray(), []) ?? [];
  const [it, setIt] = useState(item);
  const save = async () => {
    await db.items.put({ ...it, text: it.text.trim() || item.text });
    onClose();
  };
  const remove = async () => {
    await db.items.delete(item.id);
    ui.toast('Attività eliminata');
    onClose();
  };
  return (
    <Modal title="Dettagli attività" onClose={onClose} footer={<>
      <button className="btn btn-danger" onClick={remove}><Trash2 size={16} />Elimina</button>
      <span className="grow" />
      <button className="btn" onClick={onClose}>Annulla</button>
      <button className="btn btn-primary" onClick={save}>Salva</button>
    </>}>
      <div className="stack">
        <label className="field"><span>Attività</span><input className="input" value={it.text} onChange={(e) => setIt({ ...it, text: e.target.value })} /></label>
        <div className="field-row">
          <label className="field"><span>Scadenza</span><input className="input" type="date" value={it.dueDate} onChange={(e) => setIt({ ...it, dueDate: e.target.value })} /></label>
          <label className="field"><span>Lista</span>
            <select className="select" value={it.listId} onChange={(e) => setIt({ ...it, listId: e.target.value })}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.title}</option>)}
            </select>
          </label>
        </div>
        <div className="field"><span>Priorità</span>
          <div className="chips">
            {PRIO_LABEL.map((p, i) => (
              <button key={p} className={'chip' + (it.priority === i ? ' active' : '')} onClick={() => setIt({ ...it, priority: i as ListItem['priority'] })}>
                {i > 0 && <Flag size={13} color={it.priority === i ? '#fff' : PRIO_COLOR[i]} />}{p}
              </button>
            ))}
          </div>
        </div>
        <label className="field"><span>Note</span><textarea className="textarea" value={it.note} onChange={(e) => setIt({ ...it, note: e.target.value })} /></label>
        <div className="row"><input type="checkbox" className="checkbox" checked={it.done} onChange={(e) => setIt({ ...it, done: e.target.checked, completedAt: e.target.checked ? Date.now() : null })} id="dn" /><label htmlFor="dn">Completata</label></div>
      </div>
    </Modal>
  );
}

function ListEditor({ list, onClose, onCreated }: { list: TodoList; onClose: () => void; onCreated: (id: string) => void }) {
  const ui = useUI();
  const [l, setL] = useState(list);
  const isNew = !list.id;
  const kindInfo = useMemo(() => KINDS.find((k) => k.id === l.kind), [l.kind]);
  const save = async () => {
    if (!l.title.trim()) { ui.toast('Dai un nome alla lista', true); return; }
    const now = Date.now();
    const rec = { ...l, title: l.title.trim(), id: l.id || uid(), createdAt: l.createdAt || now, updatedAt: now };
    await db.lists.put(rec);
    onClose();
    if (isNew) onCreated(rec.id);
  };
  return (
    <Modal title={isNew ? 'Nuova lista' : 'Modifica lista'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>{isNew ? 'Crea' : 'Salva'}</button></>}>
      <div className="stack">
        <label className="field"><span>Nome</span><input className="input" autoFocus value={l.title} onChange={(e) => setL({ ...l, title: e.target.value })} placeholder="Es. Preparazione esame di Statistica" onKeyDown={(e) => e.key === 'Enter' && save()} /></label>
        <div className="field"><span>Tipo</span>
          <div className="chips">
            {KINDS.map((k) => (
              <button key={k.id} className={'chip' + (l.kind === k.id ? ' active' : '')} onClick={() => setL({ ...l, kind: k.id, emoji: l.emoji === kindInfo?.emoji ? k.emoji : l.emoji, color: l.color === kindInfo?.color ? k.color : l.color })}>{k.emoji} {k.label}</button>
            ))}
          </div>
        </div>
        <div className="field"><span>Icona</span>
          <div className="chips">{EMOJIS.map((e) => <button key={e} className={'chip' + (l.emoji === e ? ' active' : '')} style={{ fontSize: '1.15rem', padding: '0 10px' }} onClick={() => setL({ ...l, emoji: e })}>{e}</button>)}</div>
        </div>
        <div className="field"><span>Colore</span><Swatches value={l.color} onChange={(c) => setL({ ...l, color: c })} /></div>
      </div>
    </Modal>
  );
}
