import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Heart, X } from 'lucide-react';

/* ——— Modal ——— */
export function Modal({
  title, onClose, children, footer, size, icon,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'wide' | 'full';
  icon?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal ' + (size ?? '')} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon}
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi"><X size={20} /></button>
        </div>
        {size === 'full' ? <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div> : children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ——— Toasts, confirm and prompt dialogs ——— */
interface Toast { id: number; text: string; error?: boolean }
interface ConfirmReq { title: string; message?: string; ok?: string; danger?: boolean; resolve: (v: boolean) => void }
interface PromptReq { title: string; label?: string; value?: string; ok?: string; resolve: (v: string | null) => void }

interface UI {
  toast: (text: string, error?: boolean) => void;
  confirm: (opts: Omit<ConfirmReq, 'resolve'>) => Promise<boolean>;
  prompt: (opts: Omit<PromptReq, 'resolve'>) => Promise<string | null>;
}

const UICtx = createContext<UI | null>(null);
export const useUI = () => {
  const c = useContext(UICtx);
  if (!c) throw new Error('UIProvider mancante');
  return c;
};

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null);
  const [promptReq, setPromptReq] = useState<PromptReq | null>(null);
  const [promptVal, setPromptVal] = useState('');
  const nextId = useRef(1);

  const toast = useCallback((text: string, error?: boolean) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), error ? 6000 : 3200);
  }, []);
  const confirm = useCallback((o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>((resolve) => setConfirmReq({ ...o, resolve })), []);
  const prompt = useCallback((o: Omit<PromptReq, 'resolve'>) => new Promise<string | null>((resolve) => {
    setPromptVal(o.value ?? '');
    setPromptReq({ ...o, resolve });
  }), []);

  const ui = useRef<UI>({ toast, confirm, prompt }).current;

  const closeConfirm = (v: boolean) => { confirmReq?.resolve(v); setConfirmReq(null); };
  const closePrompt = (v: string | null) => { promptReq?.resolve(v); setPromptReq(null); };

  return (
    <UICtx.Provider value={ui}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast' + (t.error ? ' error' : '')}>
            {t.error ? <AlertCircle size={18} /> : <Heart size={18} fill="currentColor" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {confirmReq && (
        <Modal
          title={confirmReq.title}
          onClose={() => closeConfirm(false)}
          footer={<>
            <button className="btn" onClick={() => closeConfirm(false)}>Annulla</button>
            <button className={'btn ' + (confirmReq.danger ? 'btn-danger' : 'btn-primary')} autoFocus onClick={() => closeConfirm(true)}>
              {confirmReq.ok ?? 'Conferma'}
            </button>
          </>}
        >
          {confirmReq.message && <p style={{ margin: 0, color: 'var(--text-2)' }}>{confirmReq.message}</p>}
        </Modal>
      )}
      {promptReq && (
        <Modal
          title={promptReq.title}
          onClose={() => closePrompt(null)}
          footer={<>
            <button className="btn" onClick={() => closePrompt(null)}>Annulla</button>
            <button className="btn btn-primary" onClick={() => closePrompt(promptVal)}>{promptReq.ok ?? 'Salva'}</button>
          </>}
        >
          <form onSubmit={(e) => { e.preventDefault(); closePrompt(promptVal); }}>
            <label className="field">
              {promptReq.label && <span>{promptReq.label}</span>}
              <input className="input" autoFocus value={promptVal} onChange={(e) => setPromptVal(e.target.value)} onFocus={(e) => e.target.select()} />
            </label>
          </form>
        </Modal>
      )}
    </UICtx.Provider>
  );
}

/* ——— Context menu ——— */
export interface MenuItem { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; divider?: boolean }

export function useMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const open = useCallback((e: { clientX: number; clientY: number; currentTarget?: EventTarget | null }, items: MenuItem[]) => {
    let x = e.clientX;
    let y = e.clientY;
    const el = e.currentTarget as HTMLElement | null;
    if (el && 'getBoundingClientRect' in el && (x === 0 && y === 0)) {
      const r = el.getBoundingClientRect();
      x = r.left;
      y = r.bottom;
    }
    setMenu({ x, y, items });
  }, []);
  const node = menu ? <MenuView {...menu} onClose={() => setMenu(null)} /> : null;
  return { open, node };
}

function MenuView({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
    const close = (e: Event) => { if (!el.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', close);
      window.addEventListener('scroll', onClose, true);
    });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [x, y, onClose]);
  return createPortal(
    <div className="menu" ref={ref} style={pos} role="menu">
      {items.map((it, i) => it.divider ? <hr key={i} /> : (
        <button key={i} className={it.danger ? 'danger' : ''} onClick={() => { onClose(); it.onClick(); }} role="menuitem">
          {it.icon}{it.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/* ——— Small pieces ——— */
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <HeartDoodle />}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function HeartDoodle({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 84 84" aria-hidden="true">
      <circle cx="42" cy="44" r="32" fill="var(--primary-soft)" />
      <path d="M42 60s-17-10-17-21c0-5.5 4-9.5 9-9.5 3.6 0 6.3 2 8 4.8 1.7-2.8 4.4-4.8 8-4.8 5 0 9 4 9 9.5C59 50 42 60 42 60z" fill="var(--primary)" opacity=".85" />
      <path d="M64 22s-6-3.6-6-7.4c0-1.9 1.4-3.3 3.2-3.3 1.3 0 2.2.7 2.8 1.7.6-1 1.5-1.7 2.8-1.7 1.8 0 3.2 1.4 3.2 3.3 0 3.8-6 7.4-6 7.4z" fill="var(--blue)" />
      <path d="M18 66s-4-2.4-4-5c0-1.3.9-2.2 2.1-2.2.9 0 1.5.5 1.9 1.1.4-.6 1-1.1 1.9-1.1 1.2 0 2.1.9 2.1 2.2 0 2.6-4 5-4 5z" fill="var(--blue)" opacity=".8" />
    </svg>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export const PALETTE = ['#e46f8e', '#f39cc0', '#f6b3c4', '#bfa8e8', '#9b8ae0', '#7fbfe8', '#5fa8dc', '#8fd0b0', '#4caf84', '#f6bf95', '#f2a35e', '#e8c56b', '#c4a77d', '#a8868f', '#6d5b85'];

export function Swatches({ value, onChange, colors = PALETTE }: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button key={c} type="button" className={'swatch' + (c === value ? ' active' : '')} style={{ background: c }} onClick={() => onChange(c)} aria-label={'Colore ' + c} />
      ))}
      <label className="swatch" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', position: 'relative', overflow: 'hidden' }} title="Colore personalizzato">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} /></div>;
}
