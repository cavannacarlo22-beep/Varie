import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Star } from 'lucide-react';
import { FONT_CATEGORIES, FONTS, cssFamily, loadFontPreview, type FontCategory } from '../lib/fonts';
import { setSettings, useSettings } from '../db/settings';

export function toggleFavoriteFont(fav: string[], family: string) {
  return fav.includes(family) ? fav.filter((f) => f !== family) : [...fav, family];
}

/** Lazily loads the preview glyphs when the row scrolls into view. */
export function FontRow({ family, children, className, onClick, style, previewText }: {
  family: string; children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties; previewText?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting) {
        loadFontPreview(family, family + (previewText ?? ''));
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [family, previewText]);
  return <button ref={ref} className={className} onClick={onClick} style={{ fontFamily: cssFamily(family), ...style }}>{children}</button>;
}

export function FontPicker({ anchor, current, onPick, onClose }: { anchor: HTMLElement; current?: string; onPick: (family: string) => void; onClose: () => void }) {
  const s = useSettings();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FontCategory | 'fav' | 'recent' | 'all'>(s.favoriteFonts.length ? 'fav' : 'all');
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 16);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: Math.min(r.bottom + 6, window.innerHeight - 200) });
  }, [anchor]);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key); };
  }, [anchor, onClose]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle) return FONTS.filter((f) => f.family.toLowerCase().includes(needle)).map((f) => f.family);
    if (cat === 'fav') return s.favoriteFonts;
    if (cat === 'recent') return s.recentFonts;
    if (cat === 'all') return FONTS.map((f) => f.family);
    return FONTS.filter((f) => f.category === cat).map((f) => f.family);
  }, [q, cat, s.favoriteFonts, s.recentFonts]);

  const pick = (family: string) => {
    void setSettings({ recentFonts: [family, ...s.recentFonts.filter((f) => f !== family)].slice(0, 12) });
    onPick(family);
    onClose();
  };

  return createPortal(
    <div className="font-pop" ref={popRef} style={{ left: pos.left, top: pos.top, width: Math.min(340, window.innerWidth - 16), maxHeight: `min(70vh, ${window.innerHeight - pos.top - 12}px)` }}>
      <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
        <div className="search"><Search size={16} /><input className="input" autoFocus={window.matchMedia('(pointer: fine)').matches} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cerca tra ${FONTS.length} font`} /></div>
        <div className="chips scroll" style={{ marginTop: 8 }}>
          <button className={'chip' + (cat === 'fav' ? ' active' : '')} onClick={() => setCat('fav')}><Star size={13} />Preferiti</button>
          <button className={'chip' + (cat === 'recent' ? ' active' : '')} onClick={() => setCat('recent')}>Recenti</button>
          <button className={'chip' + (cat === 'all' ? ' active' : '')} onClick={() => setCat('all')}>Tutti</button>
          {FONT_CATEGORIES.map((c) => <button key={c.id} className={'chip' + (cat === c.id ? ' active' : '')} onClick={() => setCat(c.id)}>{c.label}</button>)}
        </div>
      </div>
      <div className="font-pop-list">
        {list.length === 0 && <p className="small muted" style={{ padding: 12 }}>{cat === 'fav' ? 'Tocca la stellina accanto a un font per aggiungerlo ai preferiti.' : 'Nessun font trovato.'}</p>}
        {list.map((family) => (
          <div key={family} className="row" style={{ gap: 0 }}>
            <FontRow family={family} className={'font-opt' + (current === family ? ' active' : '')} onClick={() => pick(family)}>
              <span className="fname">{family}</span>
            </FontRow>
            <button className="icon-btn sm" onClick={() => setSettings({ favoriteFonts: toggleFavoriteFont(s.favoriteFonts, family) })} aria-label="Preferito">
              <Star size={15} fill={s.favoriteFonts.includes(family) ? 'var(--warning)' : 'none'} color={s.favoriteFonts.includes(family) ? 'var(--warning)' : 'var(--muted)'} />
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
