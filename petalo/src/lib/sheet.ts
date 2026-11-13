import { calc, FormulaError, type Value } from './formula';

export function colName(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function addr(row: number, col: number): string {
  return colName(col) + (row + 1);
}

export function parseAddr(a: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(a.replace(/\$/g, '').toUpperCase());
  if (!m) throw new FormulaError('#RIF!', `Cella non valida: ${a}`);
  return { col: colIndex(m[1]), row: parseInt(m[2], 10) - 1 };
}

/** Interprets a raw typed value (non formula). */
export function literal(raw: string): Value {
  const t = raw.trim();
  if (t === '') return '';
  const pct = /^(-?[\d.,]+)\s*%$/.exec(t);
  if (pct) {
    const n = toNumber(pct[1]);
    if (n !== null) return n / 100;
  }
  const n = toNumber(t.replace(/^€\s*|\s*€$/g, ''));
  if (n !== null) return n;
  return t;
}

/** Accepts 1234,5 / 1.234,5 / 1234.5 */
export function toNumber(t: string): number | null {
  if (!/^-?[\d.,]+$/.test(t)) return null;
  let s = t;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface CellResult {
  value: Value;
  error?: string;
  message?: string;
}

/** Evaluates every non-empty cell of a sheet, with cycle detection. */
export function computeSheet(cells: Record<string, string>): Record<string, CellResult> {
  const results: Record<string, CellResult> = {};
  const visiting = new Set<string>();

  const get = (a: string): Value => {
    const r = evalCell(a);
    if (r.error) throw new FormulaError(r.error, r.message);
    return r.value;
  };

  function evalCell(a: string): CellResult {
    if (results[a]) return results[a];
    const raw = cells[a];
    if (raw === undefined || raw === '') return { value: '' };
    if (!raw.startsWith('=')) {
      results[a] = { value: literal(raw) };
      return results[a];
    }
    if (visiting.has(a)) return { value: '', error: '#CICLO!', message: 'Riferimento circolare' };
    visiting.add(a);
    let res: CellResult;
    try {
      const value = calc(raw.slice(1), {
        cell: (ref) => get(ref),
        range: (x, y) => {
          const p = parseAddr(x);
          const q = parseAddr(y);
          const out: Value[] = [];
          for (let row = Math.min(p.row, q.row); row <= Math.max(p.row, q.row); row++) {
            for (let col = Math.min(p.col, q.col); col <= Math.max(p.col, q.col); col++) {
              out.push(get(addr(row, col)));
            }
          }
          return out;
        },
      });
      res = { value };
    } catch (e) {
      const fe = e instanceof FormulaError ? e : new FormulaError('#ERRORE', String(e));
      res = { value: '', error: fe.code, message: fe.message };
    }
    visiting.delete(a);
    results[a] = res;
    return res;
  }

  for (const a of Object.keys(cells)) evalCell(a);
  return results;
}

/** Shifts references in a formula when copying a cell (relative refs only). */
export function shiftFormula(raw: string, dRow: number, dCol: number): string {
  if (!raw.startsWith('=')) return raw;
  return raw.replace(/(\$?)([A-Z]{1,3})(\$?)(\d{1,5})(?![A-Z(])/g, (_m, dc: string, c: string, dr: string, r: string) => {
    const col = dc ? colIndex(c) : Math.max(0, colIndex(c) + dCol);
    const row = dr ? parseInt(r, 10) : Math.max(1, parseInt(r, 10) + dRow);
    return `${dc}${colName(col)}${dr}${row}`;
  });
}

/** Moves cell contents when inserting/removing rows or columns. */
export function remapCells(
  cells: Record<string, string>,
  fn: (row: number, col: number) => { row: number; col: number } | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [a, v] of Object.entries(cells)) {
    const { row, col } = parseAddr(a);
    const n = fn(row, col);
    if (n) out[addr(n.row, n.col)] = v;
  }
  return out;
}

export function toCSV(cells: Record<string, string>, rows: number, cols: number, values: Record<string, CellResult>): string {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const line: string[] = [];
    for (let c = 0; c < cols; c++) {
      const a = addr(r, c);
      const v = values[a]?.value ?? cells[a] ?? '';
      let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
      if (/[;"\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      line.push(s);
    }
    lines.push(line.join(';'));
  }
  return lines.join('\n');
}

export function fromCSV(text: string): string[][] {
  const delim = (text.split('\n')[0].match(/;/g) ?? []).length >= (text.split('\n')[0].match(/,/g) ?? []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
