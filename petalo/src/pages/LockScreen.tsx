import { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { hashPin } from '../lib/crypto';

export function LockScreen({ hash, salt, onUnlock }: { hash: string; salt: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pin.length < 4 || busy) return;
    let alive = true;
    (async () => {
      setBusy(true);
      const h = await hashPin(pin, salt);
      if (!alive) return;
      setBusy(false);
      if (h === hash) onUnlock();
      else if (pin.length >= 6) {
        setError(true);
        setTimeout(() => { setError(false); setPin(''); }, 450);
      }
    })();
    return () => { alive = false; };
  }, [pin, hash, salt, onUnlock, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p));
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="lock">
      <div style={{ textAlign: 'center' }} className={error ? 'shake' : ''}>
        <div className="brand-mark" style={{ margin: '0 auto 14px', width: 64, height: 64, borderRadius: 22 }}><Lock size={28} /></div>
        <h2>Bentornata</h2>
        <p className="muted small">Inserisci il PIN per aprire Petalo</p>
        <div className="pin-dots">{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} onClick={() => setPin((p) => (p.length < 6 ? p + n : p))}>{n}</button>
          ))}
          <span />
          <button onClick={() => setPin((p) => (p.length < 6 ? p + '0' : p))}>0</button>
          <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Cancella"><Delete size={22} /></button>
        </div>
      </div>
    </div>
  );
}
