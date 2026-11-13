import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser, Hand, Highlighter, PenLine, Redo2, Trash2, Undo2 } from 'lucide-react';
import { useSettings, setSetting } from '../db/settings';

export type Tool = 'pen' | 'highlighter' | 'eraser';
export interface Stroke { tool: 'pen' | 'highlighter'; color: string; size: number; points: [number, number, number][] }

export interface DrawingHandle {
  /** PNG of the strokes (optionally over the background) at logical size × scale */
  toDataURL: (withBackground?: boolean, scale?: number) => string;
  strokes: () => Stroke[];
  isEmpty: () => boolean;
  undo: () => void;
  clear: () => void;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, k: number) {
  const pts = s.points;
  if (!pts.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  if (s.tool === 'highlighter') {
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = 'multiply';
    ctx.lineCap = 'butt';
    ctx.lineWidth = s.size * 4 * k;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * k, pts[0][1] * k);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * k, pts[i][1] * k);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * k, pts[0][1] * k, (s.size * k * (0.5 + pts[0][2] * 0.6)) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // variable width: draw segments with mid-point smoothing
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, p0] = pts[i - 1];
    const [x1, y1, p1] = pts[i];
    const prev = pts[i - 2] ?? pts[i - 1];
    const mx0 = (prev[0] + x0) / 2;
    const my0 = (prev[1] + y0) / 2;
    const mx1 = (x0 + x1) / 2;
    const my1 = (y0 + y1) / 2;
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.6, s.size * (0.45 + ((p0 + p1) / 2) * 0.75)) * k;
    ctx.moveTo((i === 1 ? x0 : mx0) * k, (i === 1 ? y0 : my0) * k);
    ctx.quadraticCurveTo(x0 * k, y0 * k, mx1 * k, my1 * k);
    if (i === pts.length - 1) ctx.lineTo(x1 * k, y1 * k);
    ctx.stroke();
  }
  ctx.restore();
}

function hit(s: Stroke, x: number, y: number, r: number) {
  const rr = (r + s.size) ** 2;
  return s.points.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < rr);
}

export const COLORS = ['#2b2b33', '#e46f8e', '#c94f71', '#5fa8dc', '#7fbfe8', '#9b8ae0', '#4caf84', '#f2a35e', '#e8c56b', '#ffffff'];
const HL_COLORS = ['#ffe066', '#ffb3c7', '#a7d8ff', '#c8f0b5', '#e0ccff'];

interface Props {
  width: number;
  height: number;
  background?: HTMLCanvasElement | HTMLImageElement | null;
  /** CSS background for the drawing surface (paper) */
  paper?: string;
  initial?: Stroke[];
  toolbar?: boolean;
  /** external tool state (to share one toolbar among many pages) */
  tool?: { tool: Tool; color: string; size: number };
  onChange?: (strokes: Stroke[]) => void;
  className?: string;
  fit?: 'contain' | 'width';
}

export const DrawingCanvas = forwardRef<DrawingHandle, Props>(function DrawingCanvas(
  { width, height, background, paper, initial, toolbar = true, tool: extTool, onChange, fit = 'contain' }, ref,
) {
  const settings = useSettings();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>(initial ? structuredClone(initial) : []);
  const redo = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [view, setView] = useState({ w: width, h: height });
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);
  const [, force] = useState(0);
  const t = extTool ?? { tool, color, size };
  const pencilOnly = settings.pencilOnly;

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const k = c.width / width;
    for (const s of strokes.current) drawStroke(ctx, s, k);
    if (current.current) drawStroke(ctx, current.current, k);
  }, [width]);

  // fit to container
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const scale = fit === 'width' ? r.width / width : Math.min(r.width / width, r.height / height);
      setView({ w: Math.max(50, width * scale), h: Math.max(50, height * scale) });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [width, height, fit]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(view.w * dpr);
    c.height = Math.round(view.h * dpr);
    redraw();
  }, [view, redraw]);

  useImperativeHandle(ref, () => ({
    toDataURL: (withBackground = false, scale = 2) => {
      const c = document.createElement('canvas');
      c.width = Math.round(width * scale);
      c.height = Math.round(height * scale);
      const ctx = c.getContext('2d')!;
      if (withBackground && background) ctx.drawImage(background, 0, 0, c.width, c.height);
      for (const s of strokes.current) drawStroke(ctx, s, scale);
      return c.toDataURL('image/png');
    },
    strokes: () => strokes.current,
    isEmpty: () => strokes.current.length === 0,
    undo: () => undoRef.current(),
    clear: () => clearRef.current(),
  }), [width, height, background]);
  const undoRef = useRef<() => void>(() => {});
  const clearRef = useRef<() => void>(() => {});

  const toLocal = (e: PointerEvent | React.PointerEvent): [number, number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    return [((e.clientX - r.left) / r.width) * width, ((e.clientY - r.top) / r.height) * height, pressure];
  };

  const changed = () => {
    onChange?.(strokes.current);
    force((n) => n + 1);
  };

  const onDown = (e: React.PointerEvent) => {
    if (pencilOnly && e.pointerType === 'touch') return; // palm rejection: fingers scroll, Pencil draws
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toLocal(e);
    if (t.tool === 'eraser') {
      const before = strokes.current.length;
      strokes.current = strokes.current.filter((s) => !hit(s, p[0], p[1], t.size * 3));
      if (strokes.current.length !== before) { redraw(); changed(); }
      current.current = { tool: 'pen', color: 'eraser', size: t.size, points: [p] };
      return;
    }
    current.current = { tool: t.tool, color: t.color, size: t.size, points: [p] };
    redo.current = [];
    redraw();
  };
  const onMove = (e: React.PointerEvent) => {
    const cur = current.current;
    if (!cur) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    if (t.tool === 'eraser') {
      const before = strokes.current.length;
      for (const ev of events) {
        const p = toLocal(ev);
        strokes.current = strokes.current.filter((s) => !hit(s, p[0], p[1], t.size * 3));
      }
      if (strokes.current.length !== before) { redraw(); changed(); }
      return;
    }
    for (const ev of events) cur.points.push(toLocal(ev));
    redraw();
  };
  const onUp = () => {
    const cur = current.current;
    current.current = null;
    if (!cur || cur.color === 'eraser') return;
    strokes.current.push(cur);
    redraw();
    changed();
  };

  const undo = () => {
    const s = strokes.current.pop();
    if (s) { redo.current.push(s); redraw(); changed(); }
  };
  const redoFn = () => {
    const s = redo.current.pop();
    if (s) { strokes.current.push(s); redraw(); changed(); }
  };
  const clear = () => {
    if (!strokes.current.length) return;
    redo.current = [...strokes.current].reverse();
    strokes.current = [];
    redraw();
    changed();
  };

  undoRef.current = undo;
  clearRef.current = clear;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
      {toolbar && !extTool && (
        <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
          onUndo={undo} onRedo={redoFn} onClear={clear} pencilOnly={pencilOnly} />
      )}
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: fit === 'width' ? 'start center' : 'center', width: '100%' }}>
        <div style={{ position: 'relative', width: view.w, height: view.h, background: paper ?? 'transparent', borderRadius: 8, boxShadow: paper ? 'var(--shadow)' : undefined, touchAction: pencilOnly ? 'pan-x pan-y pinch-zoom' : 'none' }}>
          {background && <BgCanvas source={background} w={view.w} h={view.h} />}
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: pencilOnly ? 'pan-x pan-y pinch-zoom' : 'none', cursor: t.tool === 'eraser' ? 'cell' : 'crosshair' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={(e) => e.buttons === 0 && onUp()} />
        </div>
      </div>
    </div>
  );
});

function BgCanvas({ source, w, h }: { source: HTMLCanvasElement | HTMLImageElement; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  }, [source, w, h]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 8 }} />;
}

export function DrawToolbar({ tool, setTool, color, setColor, size, setSize, onUndo, onRedo, onClear, pencilOnly }: {
  tool: Tool; setTool: (t: Tool) => void; color: string; setColor: (c: string) => void; size: number; setSize: (n: number) => void;
  onUndo?: () => void; onRedo?: () => void; onClear?: () => void; pencilOnly: boolean;
}) {
  const colors = tool === 'highlighter' ? HL_COLORS : COLORS;
  return (
    <div className="draw-tools">
      <button className={'tb-btn' + (tool === 'pen' ? ' active' : '')} onClick={() => { setTool('pen'); if (HL_COLORS.includes(color)) setColor(COLORS[0]); }} title="Penna"><PenLine size={18} /></button>
      <button className={'tb-btn' + (tool === 'highlighter' ? ' active' : '')} onClick={() => { setTool('highlighter'); if (!HL_COLORS.includes(color)) setColor(HL_COLORS[0]); }} title="Evidenziatore"><Highlighter size={18} /></button>
      <button className={'tb-btn' + (tool === 'eraser' ? ' active' : '')} onClick={() => setTool('eraser')} title="Gomma (cancella il tratto)"><Eraser size={18} /></button>
      <span style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 4px' }} />
      {colors.map((c) => (
        <button key={c} className={'swatch' + (color === c ? ' active' : '')} style={{ background: c, width: 28, height: 28 }} onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }} aria-label={'Colore ' + c} />
      ))}
      <span style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 4px' }} />
      {[1.5, 3, 5, 9].map((s) => (
        <button key={s} className={'pen-size' + (size === s ? ' active' : '')} onClick={() => setSize(s)} aria-label={'Spessore ' + s}>
          <i style={{ width: s + 2, height: s + 2 }} />
        </button>
      ))}
      <span style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 4px' }} />
      {onUndo && <button className="tb-btn" onClick={onUndo} title="Annulla"><Undo2 size={18} /></button>}
      {onRedo && <button className="tb-btn" onClick={onRedo} title="Ripeti"><Redo2 size={18} /></button>}
      {onClear && <button className="tb-btn" onClick={onClear} title="Cancella tutto"><Trash2 size={18} /></button>}
      <button className={'tb-btn' + (pencilOnly ? ' active' : '')} onClick={() => setSetting('pencilOnly', !pencilOnly)}
        title={pencilOnly ? 'Solo Apple Pencil: le dita scorrono la pagina' : 'Disegno anche con le dita'}>
        <Hand size={18} />{pencilOnly ? <span className="tiny" style={{ marginLeft: 4 }}>Solo Pencil</span> : null}
      </button>
    </div>
  );
}
