/**
 * Small expression engine shared by the calculator and the spreadsheet.
 *
 * - Operators: + - * / ^ % ! ( ) and the symbols × ÷ − √ π
 * - Implicit multiplication: 2(3+1), 3π, 2√9
 * - Percent like a pocket calculator: 200 + 10% = 220, 200 * 10% = 20
 * - Function arguments separated by `;` (Italian style). Decimals with `.` or `,`.
 * - Cell references (A1, $B$2) and ranges (A1:C3) when a resolver is provided.
 */

export type Value = number | string | boolean;

export class FormulaError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'ref'; v: string }
  | { t: 'op'; v: string };

const OPS2 = ['<=', '>=', '<>'];
const OPS1 = '+-*/^%!()<>=;:√&';

export function tokenize(src: string): Tok[] {
  const s = src
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, ' PI ');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (/[0-9]/.test(c) || ((c === '.' || c === ',') && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      if ((s[j] === '.' || s[j] === ',') && /[0-9]/.test(s[j + 1] ?? '')) {
        j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      if ((s[j] === 'e' || s[j] === 'E') && /[-+0-9]/.test(s[j + 1] ?? '') && /[0-9]/.test(s[j + 1] === '-' || s[j + 1] === '+' ? s[j + 2] ?? '' : s[j + 1])) {
        j += 2;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      out.push({ t: 'num', v: parseFloat(s.slice(i, j).replace(',', '.')) });
      i = j;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let str = '';
      while (j < s.length && s[j] !== '"') str += s[j++];
      if (s[j] !== '"') throw new FormulaError('#SINTASSI', 'Virgolette non chiuse');
      out.push({ t: 'str', v: str });
      i = j + 1;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (OPS2.includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if (OPS1.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (/[A-Za-z_$À-ÿ]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_.$À-ÿ]/.test(s[j])) j++;
      const word = s.slice(i, j);
      const clean = word.replace(/\$/g, '').toUpperCase();
      if (/^[A-Z]{1,3}[0-9]{1,5}$/.test(clean) && s[j] !== '(') out.push({ t: 'ref', v: clean });
      else out.push({ t: 'id', v: clean });
      i = j;
      continue;
    }
    throw new FormulaError('#SINTASSI', `Carattere non valido: ${c}`);
  }
  return out;
}

type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'ref'; v: string }
  | { k: 'range'; a: string; b: string }
  | { k: 'name'; v: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'pct'; a: Node }
  | { k: 'fact'; a: Node }
  | { k: 'call'; fn: string; args: Node[] };

export function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => toks[p]?.t === 'op' && toks[p].v === v;
  const eat = (v: string) => {
    if (!isOp(v)) throw new FormulaError('#SINTASSI', `Atteso "${v}"`);
    p++;
  };

  function comparison(): Node {
    let a = concat();
    while (peek()?.t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(peek()!.v as string)) {
      const op = (toks[p++] as { v: string }).v;
      a = { k: 'bin', op, a, b: concat() };
    }
    return a;
  }
  function concat(): Node {
    let a = additive();
    while (isOp('&')) { p++; a = { k: 'bin', op: '&', a, b: additive() }; }
    return a;
  }
  function additive(): Node {
    let a = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: string }).v;
      a = { k: 'bin', op, a, b: term() };
    }
    return a;
  }
  function startsPrimary(): boolean {
    const t = peek();
    if (!t) return false;
    if (t.t === 'num' || t.t === 'ref' || t.t === 'id') return true;
    return t.t === 'op' && (t.v === '(' || t.v === '√');
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as { v: string }).v;
        a = { k: 'bin', op, a, b: unary() };
      } else if (startsPrimary()) {
        // implicit multiplication: 2(3), 2π, (1+1)(2)
        a = { k: 'bin', op: '*', a, b: power() };
      } else break;
    }
    return a;
  }
  function unary(): Node {
    if (isOp('-')) { p++; return { k: 'un', op: '-', a: unary() }; }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power(): Node {
    const base = postfix();
    if (isOp('^')) { p++; return { k: 'bin', op: '^', a: base, b: unary() }; }
    return base;
  }
  function postfix(): Node {
    let a = primary();
    for (;;) {
      if (isOp('%')) { p++; a = { k: 'pct', a }; }
      else if (isOp('!')) { p++; a = { k: 'fact', a }; }
      else break;
    }
    return a;
  }
  function primary(): Node {
    const t = peek();
    if (!t) throw new FormulaError('#SINTASSI', 'Espressione incompleta');
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === 'str') { p++; return { k: 'str', v: t.v }; }
    if (t.t === 'ref') {
      p++;
      if (isOp(':')) {
        p++;
        const b = peek();
        if (b?.t !== 'ref') throw new FormulaError('#RIF!', 'Intervallo non valido');
        p++;
        return { k: 'range', a: t.v, b: b.v };
      }
      return { k: 'ref', v: t.v };
    }
    if (t.t === 'id') {
      p++;
      if (isOp('(')) {
        p++;
        const args: Node[] = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(';')) { p++; args.push(comparison()); }
        }
        eat(')');
        return { k: 'call', fn: t.v, args };
      }
      return { k: 'name', v: t.v };
    }
    if (t.v === '(') {
      p++;
      const e = comparison();
      eat(')');
      return e;
    }
    if (t.v === '√') { p++; return { k: 'call', fn: 'SQRT', args: [postfix()] }; }
    throw new FormulaError('#SINTASSI', `Simbolo inatteso "${t.v}"`);
  }

  if (toks.length === 0) throw new FormulaError('#SINTASSI', 'Espressione vuota');
  const n = comparison();
  if (p < toks.length) throw new FormulaError('#SINTASSI', 'Simbolo inatteso alla fine');
  return n;
}

export interface Resolver {
  cell(ref: string): Value;
  range(a: string, b: string): Value[];
}

function num(v: Value | Value[]): number {
  if (Array.isArray(v)) {
    if (v.length === 1) return num(v[0]);
    throw new FormulaError('#VALORE!', 'Atteso un singolo valore');
  }
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '') return 0;
  const n = Number(v.replace(',', '.'));
  if (Number.isNaN(n)) throw new FormulaError('#VALORE!', `"${v}" non è un numero`);
  return n;
}

function flatNums(vals: (Value | Value[])[]): number[] {
  const out: number[] = [];
  for (const v of vals) {
    if (Array.isArray(v)) {
      for (const x of v) if (typeof x === 'number') out.push(x);
    } else if (typeof v === 'number') out.push(v);
    else if (typeof v === 'boolean') out.push(v ? 1 : 0);
    else if (v !== '' && !Number.isNaN(Number(v.replace(',', '.')))) out.push(Number(v.replace(',', '.')));
  }
  return out;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new FormulaError('#NUM!', 'Fattoriale solo per interi ≥ 0');
  if (n > 170) throw new FormulaError('#NUM!', 'Numero troppo grande');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

type Fn = (args: (Value | Value[])[]) => Value;

const FUNCS: Record<string, Fn> = {
  SUM: (a) => flatNums(a).reduce((x, y) => x + y, 0),
  AVERAGE: (a) => {
    const n = flatNums(a);
    if (!n.length) throw new FormulaError('#DIV/0!', 'Nessun valore per la media');
    return n.reduce((x, y) => x + y, 0) / n.length;
  },
  MIN: (a) => { const n = flatNums(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = flatNums(a); return n.length ? Math.max(...n) : 0; },
  COUNT: (a) => flatNums(a).length,
  COUNTA: (a) => a.flat().filter((v) => v !== '' && v !== undefined).length,
  PRODUCT: (a) => flatNums(a).reduce((x, y) => x * y, 1),
  MEDIAN: (a) => {
    const n = flatNums(a).sort((x, y) => x - y);
    if (!n.length) throw new FormulaError('#NUM!');
    const m = Math.floor(n.length / 2);
    return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2;
  },
  STDEV: (a) => {
    const n = flatNums(a);
    if (n.length < 2) throw new FormulaError('#DIV/0!');
    const avg = n.reduce((x, y) => x + y, 0) / n.length;
    return Math.sqrt(n.reduce((s, x) => s + (x - avg) ** 2, 0) / (n.length - 1));
  },
  WEIGHTEDAVG: (a) => {
    if (a.length !== 2) throw new FormulaError('#VALORE!', 'MEDIA.PONDERATA(valori; pesi)');
    const v = Array.isArray(a[0]) ? a[0] : [a[0]];
    const w = Array.isArray(a[1]) ? a[1] : [a[1]];
    let s = 0;
    let ws = 0;
    for (let i = 0; i < v.length; i++) {
      if (typeof v[i] !== 'number' || typeof w[i] !== 'number') continue;
      s += (v[i] as number) * (w[i] as number);
      ws += w[i] as number;
    }
    if (!ws) throw new FormulaError('#DIV/0!');
    return s / ws;
  },
  ROUND: (a) => {
    const d = a.length > 1 ? num(a[1]) : 0;
    const f = 10 ** d;
    return Math.round(num(a[0]) * f + Number.EPSILON) / f;
  },
  ROUNDUP: (a) => { const f = 10 ** (a.length > 1 ? num(a[1]) : 0); return Math.ceil(num(a[0]) * f) / f; },
  ROUNDDOWN: (a) => { const f = 10 ** (a.length > 1 ? num(a[1]) : 0); return Math.floor(num(a[0]) * f) / f; },
  INT: (a) => Math.floor(num(a[0])),
  ABS: (a) => Math.abs(num(a[0])),
  SQRT: (a) => {
    const x = num(a[0]);
    if (x < 0) throw new FormulaError('#NUM!', 'Radice di un numero negativo');
    return Math.sqrt(x);
  },
  ROOT: (a) => {
    const x = num(a[0]);
    const n = num(a[1]);
    if (x < 0 && n % 2 === 1) return -Math.pow(-x, 1 / n);
    if (x < 0) throw new FormulaError('#NUM!');
    return Math.pow(x, 1 / n);
  },
  POWER: (a) => Math.pow(num(a[0]), num(a[1])),
  MOD: (a) => {
    const d = num(a[1]);
    if (d === 0) throw new FormulaError('#DIV/0!');
    const r = num(a[0]) % d;
    return r !== 0 && Math.sign(r) !== Math.sign(d) ? r + d : r;
  },
  PERCENT: (a) => {
    const d = num(a[1]);
    if (d === 0) throw new FormulaError('#DIV/0!');
    return (num(a[0]) / d) * 100;
  },
  PERCENTOF: (a) => (num(a[0]) * num(a[1])) / 100,
  VARPERC: (a) => {
    const from = num(a[0]);
    if (from === 0) throw new FormulaError('#DIV/0!');
    return ((num(a[1]) - from) / Math.abs(from)) * 100;
  },
  LOG: (a) => {
    const x = num(a[0]);
    if (x <= 0) throw new FormulaError('#NUM!');
    return a.length > 1 ? Math.log(x) / Math.log(num(a[1])) : Math.log10(x);
  },
  LN: (a) => {
    const x = num(a[0]);
    if (x <= 0) throw new FormulaError('#NUM!');
    return Math.log(x);
  },
  EXP: (a) => Math.exp(num(a[0])),
  SIN: (a) => Math.sin(num(a[0])),
  COS: (a) => Math.cos(num(a[0])),
  TAN: (a) => Math.tan(num(a[0])),
  RADIANS: (a) => (num(a[0]) * Math.PI) / 180,
  DEGREES: (a) => (num(a[0]) * 180) / Math.PI,
  FACT: (a) => factorial(num(a[0])),
  PI: () => Math.PI,
  IF: (a) => {
    const c = a[0];
    const truthy = typeof c === 'string' ? c !== '' : Array.isArray(c) ? c.length > 0 : Boolean(c);
    return (truthy ? a[1] ?? true : a[2] ?? false) as Value;
  },
  AND: (a) => a.flat().every(Boolean),
  OR: (a) => a.flat().some(Boolean),
  NOT: (a) => !a[0],
};

/** Italian names → canonical */
const ALIASES: Record<string, string> = {
  SOMMA: 'SUM', MEDIA: 'AVERAGE', AVG: 'AVERAGE', MINIMO: 'MIN', MASSIMO: 'MAX', CONTA: 'COUNT',
  'CONTA.NUMERI': 'COUNT', 'CONTA.VALORI': 'COUNTA', PRODOTTO: 'PRODUCT', MEDIANA: 'MEDIAN',
  'DEV.ST': 'STDEV', DEVST: 'STDEV', 'MEDIA.PONDERATA': 'WEIGHTEDAVG', MEDIAPONDERATA: 'WEIGHTEDAVG',
  ARROTONDA: 'ROUND', 'ARROTONDA.ECCESSO': 'ROUNDUP', 'ARROTONDA.DIFETTO': 'ROUNDDOWN', ASS: 'ABS',
  RADQ: 'SQRT', RADICE: 'ROOT', POTENZA: 'POWER', POW: 'POWER', RESTO: 'MOD', PERCENTUALE: 'PERCENT',
  'PERCENTUALE.DI': 'PERCENTOF', 'VARIAZIONE.PERC': 'VARPERC', LOG10: 'LOG', SEN: 'SIN',
  RADIANTI: 'RADIANS', GRADI: 'DEGREES', FATTORIALE: 'FACT', PIGRECO: 'PI', SE: 'IF', E: 'AND', O: 'OR', NON: 'NOT',
};

export const FUNCTION_HELP: { name: string; desc: string; example: string }[] = [
  { name: 'SOMMA', desc: 'Somma di numeri o intervalli', example: '=SOMMA(A1:A10)' },
  { name: 'MEDIA', desc: 'Media aritmetica', example: '=MEDIA(B2:B8)' },
  { name: 'MEDIA.PONDERATA', desc: 'Media pesata (es. voti × CFU)', example: '=MEDIA.PONDERATA(B2:B9; C2:C9)' },
  { name: 'MIN / MAX', desc: 'Valore minimo / massimo', example: '=MAX(A1:D1)' },
  { name: 'CONTA', desc: 'Quanti numeri ci sono', example: '=CONTA(A:A1)' },
  { name: 'PRODOTTO', desc: 'Moltiplica tutti i valori', example: '=PRODOTTO(A1:A3)' },
  { name: 'MEDIANA', desc: 'Valore centrale', example: '=MEDIANA(A1:A9)' },
  { name: 'DEV.ST', desc: 'Deviazione standard campionaria', example: '=DEV.ST(A1:A9)' },
  { name: 'ARROTONDA', desc: 'Arrotonda a n decimali', example: '=ARROTONDA(A1; 2)' },
  { name: 'RADQ / RADICE', desc: 'Radice quadrata / n-esima', example: '=RADICE(27; 3)' },
  { name: 'POTENZA', desc: 'Elevamento a potenza (anche con ^)', example: '=POTENZA(2; 8)' },
  { name: 'PERCENTUALE', desc: 'Quanto è A rispetto a B, in %', example: '=PERCENTUALE(30; 120)' },
  { name: 'PERCENTUALE.DI', desc: 'Il p% di un valore', example: '=PERCENTUALE.DI(B2; 22)' },
  { name: 'VARIAZIONE.PERC', desc: 'Variazione % da A a B', example: '=VARIAZIONE.PERC(80; 100)' },
  { name: 'RESTO', desc: 'Resto della divisione', example: '=RESTO(10; 3)' },
  { name: 'SE', desc: 'Condizione', example: '=SE(A1>=18; "Superato"; "Da ridare")' },
  { name: 'LOG / LN / EXP', desc: 'Logaritmi ed esponenziale', example: '=LOG(1000)' },
  { name: 'SEN / COS / TAN', desc: 'Trigonometria (radianti)', example: '=SEN(RADIANTI(30))' },
  { name: 'FATTORIALE', desc: 'n!', example: '=FATTORIALE(5)' },
];

export function evaluate(node: Node, r?: Resolver): Value | Value[] {
  switch (node.k) {
    case 'num': return node.v;
    case 'str': return node.v;
    case 'ref':
      if (!r) throw new FormulaError('#RIF!', 'Riferimenti di cella solo nelle tabelle');
      return r.cell(node.v);
    case 'range':
      if (!r) throw new FormulaError('#RIF!', 'Intervalli solo nelle tabelle');
      return r.range(node.a, node.b);
    case 'name':
      if (node.v === 'PI' || node.v === 'PIGRECO') return Math.PI;
      if (node.v === 'E') return Math.E;
      if (node.v === 'VERO' || node.v === 'TRUE') return true;
      if (node.v === 'FALSO' || node.v === 'FALSE') return false;
      throw new FormulaError('#NOME?', `Nome sconosciuto: ${node.v}`);
    case 'un': return -num(evaluate(node.a, r));
    case 'pct': return num(evaluate(node.a, r)) / 100;
    case 'fact': return factorial(num(evaluate(node.a, r)));
    case 'call': {
      const key = ALIASES[node.fn] ?? node.fn;
      const fn = FUNCS[key];
      if (!fn) throw new FormulaError('#NOME?', `Funzione sconosciuta: ${node.fn}`);
      return fn(node.args.map((a) => evaluate(a, r)));
    }
    case 'bin': {
      const { op } = node;
      if (op === '&') return String(scalar(evaluate(node.a, r))) + String(scalar(evaluate(node.b, r)));
      if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
        const a = scalar(evaluate(node.a, r));
        const b = scalar(evaluate(node.b, r));
        switch (op) {
          case '=': return a === b;
          case '<>': return a !== b;
          case '<': return a < b;
          case '>': return a > b;
          case '<=': return a <= b;
          default: return a >= b;
        }
      }
      const a = num(evaluate(node.a, r));
      // calculator-style percent: 200 + 10% = 220
      if ((op === '+' || op === '-') && node.b.k === 'pct') {
        const p = num(evaluate(node.b.a, r));
        return op === '+' ? a + (a * p) / 100 : a - (a * p) / 100;
      }
      const b = num(evaluate(node.b, r));
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/':
          if (b === 0) throw new FormulaError('#DIV/0!', 'Divisione per zero');
          return a / b;
        case '^': {
          const v = Math.pow(a, b);
          if (Number.isNaN(v)) throw new FormulaError('#NUM!');
          return v;
        }
      }
    }
  }
  throw new FormulaError('#ERRORE');
}

function scalar(v: Value | Value[]): Value {
  if (Array.isArray(v)) {
    if (v.length === 1) return v[0];
    throw new FormulaError('#VALORE!');
  }
  return v;
}

/** Removes floating point noise: 0.1 + 0.2 → 0.3 */
export function clean(n: number): number {
  if (!Number.isFinite(n)) return n;
  return parseFloat(n.toPrecision(12));
}

export function calc(expr: string, r?: Resolver): Value {
  const v = scalar(evaluate(parse(expr), r));
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new FormulaError('#NUM!', 'Risultato non finito');
    return clean(v);
  }
  return v;
}

export function formatNumber(n: number, decimals?: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (decimals !== undefined) {
    return n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(8).replace('.', ',');
  return n.toLocaleString('it-IT', { maximumFractionDigits: 10 });
}

export function formatValue(v: Value, decimals?: number): string {
  if (typeof v === 'number') return formatNumber(v, decimals);
  if (typeof v === 'boolean') return v ? 'VERO' : 'FALSO';
  return v;
}
