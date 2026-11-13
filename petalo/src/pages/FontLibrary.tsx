import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Columns2, Search, Star, Type, X } from 'lucide-react';
import { FONT_CATEGORIES, FONTS, cssFamily, loadFont, type FontCategory, type FontDef } from '../lib/fonts';
import { setSettings, useSettings } from '../db/settings';
import { toggleFavoriteFont } from '../components/FontPicker';
import { Modal, useUI } from '../components/ui';

const PAGE = 48;

export default function FontLibrary() {
  const s = useSettings();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FontCategory | 'all' | 'fav'>('all');
  const [text, setText] = useState('');
  const [size, setSize] = useState(30);
  const [color, setColor] = useState('');
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    let l: FontDef[] = FONTS;
    if (cat === 'fav') l = FONTS.filter((f) => s.favoriteFonts.includes(f.family));
    else if (cat !== 'all') l = FONTS.filter((f) => f.category === cat);
    if (n) l = l.filter((f) => f.family.toLowerCase().includes(n));
    return l;
  }, [q, cat, s.favoriteFonts]);

  useEffect(() => setLimit(PAGE), [q, cat]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((x) => x + PAGE), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);

  const toggleCompare = (f: string) => setCompare((c) => (c.includes(f) ? c.filter((x) => x !== f) : c.length >= 8 ? c : [...c, f]));
  const useAsDefault = async (f: string) => {
    await loadFont(f);
    await setSettings({ editorFont: f, recentFonts: [f, ...s.recentFonts.filter((x) => x !== f)].slice(0, 12) });
    ui.toast(`“${f}” è ora il carattere dei tuoi quaderni`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Libreria dei font</h1>
          <p>{FONTS.length} famiglie tipografiche Google Fonts (licenza libera OFL/Apache), caricate solo quando servono e disponibili anche offline dopo il primo uso.</p>
        </div>
        {compare.length > 0 && <button className="btn btn-primary" onClick={() => setShowCompare(true)}><Columns2 size={18} />Confronta ({compare.length})</button>}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row wrap">
          <div className="search grow" style={{ minWidth: 200 }}><Search size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca un font per nome" /></div>
          <input className="input grow" style={{ minWidth: 200 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi qui il testo di anteprima" />
        </div>
        <div className="row wrap" style={{ marginTop: 12, gap: 18 }}>
          <label className="row small"><span className="muted">Dimensione</span><input type="range" min={14} max={72} value={size} onChange={(e) => setSize(Number(e.target.value))} /> <b>{size}px</b></label>
          <label className="row small"><span className="muted">Colore</span><input type="color" value={color || '#4b2c38'} onChange={(e) => setColor(e.target.value)} style={{ width: 36, height: 30, border: 0, background: 'none' }} />{color && <button className="btn btn-sm btn-ghost" onClick={() => setColor('')}>Predefinito</button>}</label>
          <span className="small muted">Font attuale dei quaderni: <b style={{ fontFamily: cssFamily(s.editorFont) }}>{s.editorFont}</b></span>
        </div>
      </div>

      <div className="chips scroll" style={{ marginBottom: 18 }}>
        <button className={'chip' + (cat === 'all' ? ' active' : '')} onClick={() => setCat('all')}>Tutti ({FONTS.length})</button>
        <button className={'chip' + (cat === 'fav' ? ' active' : '')} onClick={() => setCat('fav')}><Star size={13} />Preferiti ({s.favoriteFonts.length})</button>
        {FONT_CATEGORIES.map((c) => (
          <button key={c.id} className={'chip' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)} title={c.hint}>
            {c.label} ({FONTS.filter((f) => f.category === c.id).length})
          </button>
        ))}
      </div>

      {list.length === 0 && <p className="muted">Nessun font trovato.</p>}
      <div className="font-grid">
        {list.slice(0, limit).map((f) => (
          <FontCard key={f.family} font={f} text={text} size={size} color={color} fav={s.favoriteFonts.includes(f.family)} isDefault={s.editorFont === f.family}
            comparing={compare.includes(f.family)}
            onFav={() => setSettings({ favoriteFonts: toggleFavoriteFont(s.favoriteFonts, f.family) })}
            onCompare={() => toggleCompare(f.family)} onUse={() => useAsDefault(f.family)} />
        ))}
      </div>
      <div ref={sentinel} style={{ height: 1 }} />

      {showCompare && (
        <Modal title="Confronta i caratteri" size="wide" onClose={() => setShowCompare(false)}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Testo di prova" style={{ marginBottom: 10 }} />
          {compare.map((f) => (
            <div key={f} className="compare-row">
              <div><b>{f}</b><div className="tiny muted">{FONT_CATEGORIES.find((c) => c.id === FONTS.find((x) => x.family === f)?.category)?.label}</div></div>
              <CompareSample family={f} text={text || 'Il diritto alla felicità — appunti del 12 marzo'} size={size} color={color} />
              <div className="row">
                <button className="btn btn-sm btn-soft" onClick={() => useAsDefault(f)}>Usa</button>
                <button className="icon-btn sm" onClick={() => toggleCompare(f)} aria-label="Togli"><X size={16} /></button>
              </div>
            </div>
          ))}
          {compare.length === 0 && <p className="muted">Seleziona dei font con “Confronta”.</p>}
        </Modal>
      )}
    </div>
  );
}

function useVisibleLoad(family: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) {
        io.disconnect();
        void loadFont(family).then(() => setReady(true));
      }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [family]);
  return { ref, ready };
}

function CompareSample({ family, text, size, color }: { family: string; text: string; size: number; color: string }) {
  const { ref } = useVisibleLoad(family);
  return <div ref={ref} style={{ fontFamily: cssFamily(family), fontSize: size, color: color || undefined, lineHeight: 1.3, wordBreak: 'break-word' }}>{text}</div>;
}

function FontCard({ font, text, size, color, fav, isDefault, comparing, onFav, onCompare, onUse }: {
  font: FontDef; text: string; size: number; color: string; fav: boolean; isDefault: boolean; comparing: boolean;
  onFav: () => void; onCompare: () => void; onUse: () => void;
}) {
  const { ref, ready } = useVisibleLoad(font.family);
  return (
    <div className={'font-card' + (comparing ? ' selected' : '')} ref={ref}>
      <div className="row between">
        <div className="grow">
          <b className="ellipsis" style={{ display: 'block' }}>{font.family}</b>
          <span className="tiny muted">{FONT_CATEGORIES.find((c) => c.id === font.category)?.label}{font.bold ? ' · grassetto' : ''}{font.italic ? ' · corsivo' : ''}</span>
        </div>
        <button className="icon-btn sm" onClick={onFav} aria-label={fav ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}>
          <Star size={17} fill={fav ? 'var(--warning)' : 'none'} color={fav ? 'var(--warning)' : 'var(--muted)'} />
        </button>
      </div>
      <div className="font-sample" style={{ fontFamily: cssFamily(font.family), fontSize: size, color: color || undefined, opacity: ready ? 1 : 0.35, transition: 'opacity .2s' }}>
        {text || 'Appunti di oggi'}
      </div>
      {!text && <div style={{ fontFamily: cssFamily(font.family), fontSize: 15, color: 'var(--text-2)' }}>Aa Bb Cc 0123 — àèéìòù</div>}
      <div className="row">
        <button className={'btn btn-sm ' + (isDefault ? 'btn-primary' : 'btn-soft')} onClick={onUse}>{isDefault ? <><Check size={14} />Predefinito</> : <><Type size={14} />Usa nei quaderni</>}</button>
        <button className={'btn btn-sm ' + (comparing ? 'btn-primary' : 'btn-ghost')} onClick={onCompare}><Columns2 size={14} />Confronta</button>
      </div>
    </div>
  );
}
