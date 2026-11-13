// Verifies every family against the Google Fonts CSS API and records which
// axes can be requested, so the app never asks for a style that does not exist.
import { writeFileSync } from 'node:fs';
import { SOURCE } from './font-source.mjs';

const API = 'https://fonts.googleapis.com/css2?family=';
const VARIANTS = [
  { spec: 'ital,wght@0,400;0,700;1,400;1,700', bold: true, italic: true },
  { spec: 'wght@400;700', bold: true, italic: false },
  { spec: 'ital@0;1', bold: false, italic: true },
  { spec: '', bold: false, italic: false },
];

async function ok(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15' } });
  return res.ok;
}

const seen = new Set();
const out = [];
const failed = [];
for (const [category, families] of Object.entries(SOURCE)) {
  for (const family of families) {
    if (seen.has(family)) continue;
    seen.add(family);
    const fam = family.replace(/ /g, '+');
    let found = null;
    for (const v of VARIANTS) {
      if (await ok(API + fam + (v.spec ? ':' + v.spec : '') + '&display=swap')) { found = v; break; }
    }
    if (!found) { failed.push(family); continue; }
    out.push({ family, category, spec: found.spec, bold: found.bold, italic: found.italic });
    process.stdout.write('.');
  }
}
console.log(`\n${out.length} famiglie verificate`);
if (failed.length) console.log('Non trovate:', failed.join(', '));
writeFileSync(new URL('../src/lib/fonts.generated.json', import.meta.url), JSON.stringify(out, null, 0) + '\n');
