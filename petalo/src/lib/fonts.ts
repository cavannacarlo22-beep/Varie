import data from './fonts.generated.json';

export type FontCategory =
  | 'calligrafici' | 'a-mano' | 'minimalisti' | 'moderni' | 'accademici'
  | 'serif' | 'sans-serif' | 'decorativi' | 'vintage' | 'titoli';

export interface FontDef {
  family: string;
  category: FontCategory;
  /** axis spec for the Google Fonts CSS2 API */
  spec: string;
  bold: boolean;
  italic: boolean;
}

export const FONTS: FontDef[] = data as FontDef[];

export const FONT_CATEGORIES: { id: FontCategory; label: string; hint: string }[] = [
  { id: 'calligrafici', label: 'Calligrafici ed eleganti', hint: 'Inviti, frontespizi, citazioni' },
  { id: 'a-mano', label: 'Scrittura a mano', hint: 'Appunti dal sapore di quaderno' },
  { id: 'minimalisti', label: 'Minimalisti', hint: 'Puliti e leggibilissimi' },
  { id: 'moderni', label: 'Moderni', hint: 'Geometrici e freschi' },
  { id: 'accademici', label: 'Classici e accademici', hint: 'Tesi, saggi, testi lunghi' },
  { id: 'serif', label: 'Serif', hint: 'Lettura comoda su pagine lunghe' },
  { id: 'sans-serif', label: 'Sans serif', hint: 'Neutri, perfetti per schemi' },
  { id: 'decorativi', label: 'Decorativi', hint: 'Per dare carattere' },
  { id: 'vintage', label: 'Vintage', hint: 'Macchina da scrivere e manifesti' },
  { id: 'titoli', label: 'Per i titoli', hint: 'Grandi, d’impatto' },
];

const byFamily = new Map(FONTS.map((f) => [f.family, f]));
export const getFont = (family: string) => byFamily.get(family);

export function cssFamily(family: string): string {
  const f = byFamily.get(family);
  const fallback =
    f?.category === 'a-mano' || f?.category === 'calligrafici' ? 'cursive'
      : f?.category === 'serif' || f?.category === 'accademici' || f?.category === 'vintage' ? 'serif'
        : 'sans-serif';
  return `"${family}", ${fallback}`;
}

export function fontCssUrl(family: string, previewText?: string): string {
  const f = byFamily.get(family);
  const name = family.replace(/ /g, '+');
  const spec = f?.spec ? ':' + f.spec : '';
  const text = previewText ? '&text=' + encodeURIComponent(previewText) : '';
  return `https://fonts.googleapis.com/css2?family=${name}${previewText ? '' : spec}${text}&display=swap`;
}

const loaded = new Map<string, Promise<void>>();

function injectLink(id: string, href: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById(id)) return resolve();
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/** Loads the full family (all supported weights/italics) on demand. */
export function loadFont(family: string): Promise<void> {
  if (!byFamily.has(family)) return Promise.resolve();
  let p = loaded.get(family);
  if (!p) {
    p = injectLink('gf-' + family.replace(/\W/g, '-'), fontCssUrl(family)).then(async () => {
      try {
        await document.fonts.load(`16px "${family}"`);
      } catch {
        /* ignore */
      }
    });
    loaded.set(family, p);
  }
  return p;
}

const previewLoaded = new Set<string>();
/** Loads only the glyphs needed to show a preview (tiny download). */
export function loadFontPreview(family: string, text: string): void {
  if (loaded.has(family) || previewLoaded.has(family)) return;
  previewLoaded.add(family);
  void injectLink('gfp-' + family.replace(/\W/g, '-'), fontCssUrl(family, text));
}

export function loadFonts(families: Iterable<string>): Promise<void[]> {
  return Promise.all([...new Set(families)].map(loadFont));
}

/** Collects every font family used inside a TipTap JSON document. */
export function fontsInDoc(doc: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { marks?: { type: string; attrs?: { fontFamily?: string } }[]; content?: unknown[] };
    for (const m of node.marks ?? []) {
      if (m.type === 'textStyle' && m.attrs?.fontFamily) {
        out.add(m.attrs.fontFamily.split(',')[0].replace(/["']/g, '').trim());
      }
    }
    for (const c of node.content ?? []) walk(c);
  };
  walk(doc);
  return out;
}

export const PREVIEW_TEXT = 'Appunti di oggi — Aa Bb 123';
