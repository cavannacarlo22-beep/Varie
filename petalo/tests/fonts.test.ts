import { describe, expect, it } from 'vitest';
import { FONTS, FONT_CATEGORIES, fontsInDoc } from '../src/lib/fonts';

describe('libreria font', () => {
  it('almeno 200 famiglie distinte, tutte categorizzate', () => {
    const names = new Set(FONTS.map((f) => f.family));
    expect(names.size).toBe(FONTS.length);
    expect(FONTS.length).toBeGreaterThanOrEqual(200);
    const cats = new Set(FONT_CATEGORIES.map((c) => c.id));
    for (const f of FONTS) expect(cats.has(f.category)).toBe(true);
    for (const c of FONT_CATEGORIES) expect(FONTS.filter((f) => f.category === c.id).length).toBeGreaterThan(10);
  });
  it('contiene i font richiesti', () => {
    for (const f of ['Playfair Display', 'Poppins', 'Montserrat', 'Lora', 'Merriweather', 'Dancing Script', 'Caveat', 'Pacifico', 'Great Vibes', 'Libre Baskerville', 'Nunito', 'Quicksand', 'Roboto', 'Open Sans', 'Cormorant Garamond']) {
      expect(FONTS.some((x) => x.family === f), f).toBe(true);
    }
  });
  it('trova i font usati in un documento', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ciao', marks: [{ type: 'textStyle', attrs: { fontFamily: '"Caveat", cursive' } }] }] }] };
    expect([...fontsInDoc(doc)]).toEqual(['Caveat']);
  });
});
