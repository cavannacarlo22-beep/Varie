import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bell, BookOpen, Database, Download, HardDrive, History, Info, Lock, Palette, Share, ShieldCheck, Smartphone, Star, Trash2, Type, Upload, User, X,
} from 'lucide-react';
import { db, DATA_TABLES, requestPersistence } from '../db/db';
import { setSettings, useSettings, type Settings } from '../db/settings';
import { backupNeedsPassword, createBackup, restoreBackup, restoreSnapshot, storageEstimate, takeSnapshot } from '../lib/backup';
import { hashPin, randomSalt } from '../lib/crypto';
import { askNotificationPermission, notificationsSupported, showSystemNotification } from '../lib/notify';
import { download, fmtSize, pickFiles } from '../lib/files';
import { cssFamily, loadFont } from '../lib/fonts';
import { fmtRelative } from '../lib/dates';
import { FontPicker } from '../components/FontPicker';
import { Modal, Swatches, Switch, useUI } from '../components/ui';

const THEMES: { id: Settings['theme']; name: string; colors: string[] }[] = [
  { id: 'rosa', name: 'Rosa cipria', colors: ['#fff6f7', '#e46f8e', '#7fbfe8'] },
  { id: 'lavanda', name: 'Lavanda', colors: ['#f9f6fe', '#a084dc', '#7fbfe8'] },
  { id: 'cielo', name: 'Cielo', colors: ['#f5f9fd', '#5fa8dc', '#f09bb2'] },
  { id: 'pesca', name: 'Pesca', colors: ['#fff8f3', '#ec8f6a', '#7fbfe8'] },
  { id: 'notte', name: 'Notte rosa', colors: ['#1f1820', '#f08aa6', '#8ccaf0'] },
];

function Section({ icon, title, children, desc }: { icon: React.ReactNode; title: string; children: React.ReactNode; desc?: string }) {
  return (
    <section className="card">
      <div className="card-head" style={{ marginBottom: desc ? 4 : 14 }}><h3>{icon}{title}</h3></div>
      {desc && <p className="small muted" style={{ marginTop: 0 }}>{desc}</p>}
      <div className="stack">{children}</div>
    </section>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row between wrap" style={{ gap: 12, minHeight: 44 }}>
      <div className="grow" style={{ minWidth: 180 }}><div style={{ fontWeight: 600 }}>{label}</div>{hint && <div className="small muted">{hint}</div>}</div>
      {children}
    </div>
  );
}

export default function Impostazioni() {
  const s = useSettings();
  const ui = useUI();
  const [fontPop, setFontPop] = useState<HTMLElement | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported');
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
    void storageEstimate().then(setEst);
  }, []);

  const exportNow = async (password?: string) => {
    try {
      const { blob, name } = await createBackup(password);
      download(blob, name);
      await setSettings({ lastExportAt: Date.now() });
      ui.toast('Backup creato: conservalo in iCloud Drive, Google Drive o su una chiavetta');
    } catch (e) {
      console.error(e);
      ui.toast('Backup non riuscito', true);
    }
  };

  const restore = async () => {
    const [f] = await pickFiles('.zip,.petalo,application/zip', false);
    if (!f) return;
    let password: string | undefined;
    if (await backupNeedsPassword(f)) {
      const p = await ui.prompt({ title: 'Backup protetto', label: 'Password del backup' });
      if (p === null) return;
      password = p;
    }
    if (!(await ui.confirm({ title: 'Ripristinare il backup?', message: 'Tutti i dati attuali verranno sostituiti con quelli del backup. Prima del ripristino viene salvata una copia automatica.', ok: 'Ripristina', danger: true }))) return;
    try {
      await takeSnapshot();
      const m = await restoreBackup(f, password);
      ui.toast(`Backup del ${new Date(m.createdAt).toLocaleDateString('it-IT')} ripristinato`);
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'Ripristino non riuscito', true);
    }
  };

  const wipe = async () => {
    if (!(await ui.confirm({ title: 'Cancellare tutti i dati?', message: 'Appuntamenti, liste, quaderni, documenti e impostazioni verranno eliminati da questo dispositivo. Ti consiglio di creare prima un backup.', ok: 'Cancella tutto', danger: true }))) return;
    const t = await ui.prompt({ title: 'Conferma definitiva', label: 'Scrivi CANCELLA per confermare' });
    if (t?.trim().toUpperCase() !== 'CANCELLA') return;
    await db.transaction('rw', DATA_TABLES.map((x) => db.table(x)), async () => {
      for (const x of DATA_TABLES) await db.table(x).clear();
    });
    location.reload();
  };

  const days = s.lastExportAt ? Math.floor((Date.now() - s.lastExportAt) / 86400000) : null;

  return (
    <div className="page">
      <div className="page-head"><div><h1>Impostazioni</h1><p>Personalizza Petalo e tieni al sicuro i tuoi dati.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', alignItems: 'start' }}>
        <Section icon={<User size={18} />} title="Profilo">
          <label className="field"><span>Nome visualizzato</span><input className="input" defaultValue={s.name} onBlur={(e) => setSettings({ name: e.target.value.trim() })} placeholder="Il tuo nome" /></label>
          <label className="field"><span>Saluto personalizzato (vuoto = automatico)</span><input className="input" defaultValue={s.greeting === 'auto' ? '' : s.greeting} onBlur={(e) => setSettings({ greeting: e.target.value.trim() || 'auto' })} placeholder="Buongiorno / Buonasera…" /></label>
          <Row label="Frase motivazionale del giorno" hint="Disattiva per scrivere la tua"><Switch checked={s.rotateQuotes} onChange={(v) => setSettings({ rotateQuotes: v })} /></Row>
          {!s.rotateQuotes && <label className="field"><span>La tua frase</span><textarea className="textarea" defaultValue={s.quote} onBlur={(e) => setSettings({ quote: e.target.value.trim() || s.quote })} rows={2} /></label>}
        </Section>

        <Section icon={<Palette size={18} />} title="Aspetto">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => setSettings({ theme: t.id })} className="card" style={{ padding: 12, cursor: 'pointer', borderColor: s.theme === t.id ? 'var(--primary)' : undefined, boxShadow: s.theme === t.id ? 'var(--ring)' : undefined, textAlign: 'left' }}>
                <div className="row" style={{ gap: 4, marginBottom: 8 }}>{t.colors.map((c) => <span key={c} style={{ width: 22, height: 22, borderRadius: 8, background: c, border: '1px solid rgba(0,0,0,.08)' }} />)}</div>
                <b className="small">{t.name}</b>
              </button>
            ))}
          </div>
          {s.theme === 'rosa' && <div className="field"><span>Colore principale</span><Swatches value={s.accent} onChange={(c) => setSettings({ accent: c })} colors={['#e46f8e', '#d65a7f', '#f08aa6', '#c96f9e', '#e07a7a', '#b86b8f']} /></div>}
          <Row label="Cuoricini azzurri di sfondo"><Switch checked={s.hearts} onChange={(v) => setSettings({ hearts: v })} /></Row>
          <Row label="La settimana inizia di lunedì"><Switch checked={s.weekStartsMonday} onChange={(v) => setSettings({ weekStartsMonday: v })} /></Row>
        </Section>

        <Section icon={<Bell size={18} />} title="Notifiche e promemoria">
          <Row label="Promemoria degli appuntamenti" hint="Avvisi dentro l’app e, se consentito, notifiche di sistema"><Switch checked={s.notifications} onChange={(v) => setSettings({ notifications: v })} /></Row>
          <Row label="Permesso del browser" hint={perm === 'granted' ? 'Concesso' : perm === 'denied' ? 'Negato: riattivalo dalle impostazioni del browser' : perm === 'unsupported' ? (isIOS && !isStandalone ? 'Su iPad aggiungi Petalo alla schermata Home per riceverle' : 'Non supportato da questo browser') : 'Non ancora richiesto'}>
            <div className="row">
              {perm !== 'granted' && perm !== 'unsupported' && <button className="btn btn-sm btn-soft" onClick={async () => setPerm(await askNotificationPermission())}>Consenti</button>}
              {perm === 'granted' && <button className="btn btn-sm" onClick={() => showSystemNotification('Petalo', 'Le notifiche funzionano 💗')}>Prova</button>}
            </div>
          </Row>
          <Row label="Promemoria predefinito per i nuovi impegni">
            <select className="select" style={{ width: 'auto' }} value={s.defaultReminder} onChange={(e) => setSettings({ defaultReminder: Number(e.target.value) })}>
              {[[0, 'All’orario'], [5, '5 min prima'], [10, '10 min prima'], [15, '15 min prima'], [30, '30 min prima'], [60, '1 ora prima'], [1440, '1 giorno prima']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Row>
          <div className="notice"><Info size={18} /><span>Le notifiche del browser arrivano mentre Petalo è aperto o in background. Per avvisi garantiti anche ad app chiusa, in ogni appuntamento c’è il pulsante <b>Calendario Apple</b>, che lo aggiunge al calendario dell’iPad con il suo promemoria.</span></div>
        </Section>

        <Section icon={<BookOpen size={18} />} title="Quaderni">
          <Row label="Carattere predefinito">
            <button className="btn" style={{ fontFamily: cssFamily(s.editorFont) }} onClick={(e) => setFontPop(e.currentTarget)}><Type size={16} />{s.editorFont}</button>
          </Row>
          <Row label="Dimensione del testo"><div className="row"><input type="range" min={12} max={26} value={s.editorFontSize} onChange={(e) => setSettings({ editorFontSize: Number(e.target.value) })} /><b>{s.editorFontSize}px</b></div></Row>
          <Row label="Interlinea"><div className="row"><input type="range" min={1} max={2.5} step={0.05} value={s.editorLineHeight} onChange={(e) => setSettings({ editorLineHeight: Number(e.target.value) })} /><b>{s.editorLineHeight.toFixed(2).replace('.', ',')}</b></div></Row>
          <Row label="Larghezza del foglio">
            <div className="seg">{(['narrow', 'normal', 'wide'] as const).map((w) => <button key={w} className={s.editorWidth === w ? 'active' : ''} onClick={() => setSettings({ editorWidth: w })}>{{ narrow: 'Stretto', normal: 'Normale', wide: 'Largo' }[w]}</button>)}</div>
          </Row>
          <Row label="Controllo ortografico"><Switch checked={s.spellcheck} onChange={(v) => setSettings({ spellcheck: v })} /></Row>
          <Row label="Disegno: solo Apple Pencil" hint="Con le dita scorri la pagina, con la Pencil scrivi (puoi appoggiare il palmo)"><Switch checked={s.pencilOnly} onChange={(v) => setSettings({ pencilOnly: v })} /></Row>
          <div className="field"><span><Star size={13} style={{ verticalAlign: -2 }} /> Font preferiti</span>
            <div className="chips">
              {s.favoriteFonts.map((f) => <FavChip key={f} family={f} onRemove={() => setSettings({ favoriteFonts: s.favoriteFonts.filter((x) => x !== f) })} />)}
              {s.favoriteFonts.length === 0 && <span className="small muted">Aggiungili dalla Libreria dei font con la stellina.</span>}
            </div>
          </div>
        </Section>

        <Section icon={<Database size={18} />} title="Backup e ripristino" desc="I dati restano sul tuo dispositivo (nessun server). Crea un backup completo — con tutti i documenti — e salvalo in iCloud Drive o Google Drive: così non perdi nulla anche se cambi iPad o computer.">
          {days !== null && days >= s.backupReminderDays && <div className="notice warn"><Info size={18} /><span>L’ultimo backup scaricato risale a {days} giorni fa.</span></div>}
          {days === null && <div className="notice warn"><Info size={18} /><span>Non hai ancora scaricato un backup. Fallo ogni tanto: è il modo più sicuro per non perdere nulla.</span></div>}
          <div className="row wrap">
            <button className="btn btn-primary" onClick={() => exportNow()}><Download size={16} />Scarica backup completo</button>
            <button className="btn" onClick={() => setBackupOpen(true)}><Lock size={16} />Backup con password</button>
            <button className="btn" onClick={restore}><Upload size={16} />Ripristina</button>
          </div>
          {s.lastExportAt > 0 && <span className="small muted">Ultimo backup: {fmtRelative(s.lastExportAt)}</span>}
          <Row label="Copie automatiche giornaliere" hint="Una copia al giorno di appunti, agenda e liste dentro l’app (le ultime 10). I file dell’archivio sono inclusi nel backup completo."><Switch checked={s.autoSnapshot} onChange={(v) => setSettings({ autoSnapshot: v })} /></Row>
          {snapshots.length > 0 && (
            <div>
              <div className="label" style={{ marginBottom: 6 }}><History size={13} style={{ verticalAlign: -2 }} /> Copie automatiche</div>
              {snapshots.map((sn) => (
                <div key={sn.id} className="list-row" style={{ minHeight: 44 }}>
                  <span className="grow small">{new Date(sn.createdAt).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} <span className="muted">· {fmtSize(sn.size)}</span></span>
                  <button className="btn btn-sm btn-ghost" onClick={async () => {
                    if (await ui.confirm({ title: 'Ripristinare questa copia?', message: 'Appunti, agenda, liste e impostazioni torneranno a quel momento.', ok: 'Ripristina', danger: true })) {
                      await takeSnapshot();
                      await restoreSnapshot(sn.id!);
                      ui.toast('Copia ripristinata');
                    }
                  }}>Ripristina</button>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={async () => { await takeSnapshot(); await setSettings({ lastSnapshotAt: Date.now() }); ui.toast('Copia creata'); }}>Crea una copia adesso</button>
        </Section>

        <Section icon={<ShieldCheck size={18} />} title="Sicurezza e privacy">
          <Row label="Blocco con PIN" hint={s.pinHash ? 'Attivo' : 'Chiede un PIN quando apri Petalo'}>
            {s.pinHash ? <button className="btn btn-sm btn-danger" onClick={async () => { if (await ui.confirm({ title: 'Disattivare il PIN?', ok: 'Disattiva' })) await setSettings({ pinHash: '', pinSalt: '' }); }}>Disattiva</button>
              : <button className="btn btn-sm btn-soft" onClick={() => setPinOpen(true)}>Imposta PIN</button>}
          </Row>
          {s.pinHash && (
            <Row label="Blocca dopo inattività">
              <select className="select" style={{ width: 'auto' }} value={s.lockAfterMinutes} onChange={(e) => setSettings({ lockAfterMinutes: Number(e.target.value) })}>
                <option value={0}>Solo all’apertura</option><option value={1}>1 minuto</option><option value={5}>5 minuti</option><option value={15}>15 minuti</option><option value={60}>1 ora</option>
              </select>
            </Row>
          )}
          <div className="notice"><ShieldCheck size={18} /><span>Nessun dato lascia il dispositivo: niente account, niente server, niente tracciamento. L’unica connessione esterna è il download dei font da Google Fonts. Il PIN protegge l’apertura dell’app; per la massima protezione usa anche il blocco del dispositivo e i backup con password (cifratura AES-256).</span></div>
        </Section>

        <Section icon={<HardDrive size={18} />} title="Spazio e salvataggio">
          <Row label="Archiviazione permanente" hint={persisted ? 'Attiva: il browser non cancellerà i dati per liberare spazio' : 'Non garantita dal browser'}>
            {!persisted && <button className="btn btn-sm btn-soft" onClick={async () => { const ok = await requestPersistence(); setPersisted(ok); ui.toast(ok ? 'Archiviazione permanente attiva' : 'Il browser non l’ha concessa: installa Petalo come app'); }}>Richiedi</button>}
            {persisted && <span className="badge blue">✓</span>}
          </Row>
          {est && <Row label="Spazio usato" hint={est.quota ? `su ${fmtSize(est.quota)} disponibili` : undefined}><b>{fmtSize(est.usage)}</b></Row>}
          {isIOS && !isStandalone && (
            <div className="notice warn"><Smartphone size={18} /><span><b>Importante su iPad:</b> apri Petalo in Safari, tocca <Share size={13} style={{ verticalAlign: -2 }} /> <b>Condividi → Aggiungi alla schermata Home</b>. Così diventa un’app a schermo intero, funziona offline, riceve le notifiche e Safari non cancella i dati dopo settimane di inutilizzo.</span></div>
          )}
          {isStandalone && <div className="notice"><Smartphone size={18} /><span>Petalo è installata come app: funziona anche offline.</span></div>}
        </Section>

        <Section icon={<Trash2 size={18} />} title="Zona pericolosa">
          <Row label="Cancella tutti i dati" hint="Elimina tutto da questo dispositivo"><button className="btn btn-sm btn-danger" onClick={wipe}>Cancella tutto</button></Row>
        </Section>
      </div>

      {fontPop && <FontPicker anchor={fontPop} current={s.editorFont} onClose={() => setFontPop(null)} onPick={(f) => { void loadFont(f); void setSettings({ editorFont: f }); }} />}
      {pinOpen && <PinDialog onClose={() => setPinOpen(false)} />}
      {backupOpen && <PasswordBackup onClose={() => setBackupOpen(false)} onExport={(p) => { setBackupOpen(false); void exportNow(p); }} />}
    </div>
  );
}

function FavChip({ family, onRemove }: { family: string; onRemove: () => void }) {
  useEffect(() => { void loadFont(family); }, [family]);
  return <span className="chip" style={{ fontFamily: cssFamily(family) }}>{family}<button className="icon-btn sm" style={{ width: 22, height: 22 }} onClick={onRemove} aria-label="Rimuovi"><X size={12} /></button></span>;
}

function PinDialog({ onClose }: { onClose: () => void }) {
  const ui = useUI();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const save = async () => {
    if (!/^\d{4,6}$/.test(a)) { ui.toast('Il PIN deve avere da 4 a 6 cifre', true); return; }
    if (a !== b) { ui.toast('I due PIN non coincidono', true); return; }
    const salt = randomSalt();
    await setSettings({ pinHash: await hashPin(a, salt), pinSalt: salt });
    ui.toast('PIN impostato');
    onClose();
  };
  return (
    <Modal title="Imposta un PIN" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={save}>Salva</button></>}>
      <div className="stack">
        <input ref={ref} className="input" type="password" inputMode="numeric" autoFocus maxLength={6} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} placeholder="Nuovo PIN (4–6 cifre)" />
        <input className="input" type="password" inputMode="numeric" maxLength={6} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} placeholder="Ripeti il PIN" onKeyDown={(e) => e.key === 'Enter' && save()} />
        <p className="small muted" style={{ margin: 0 }}>Se dimentichi il PIN dovrai ripristinare un backup: annotalo in un posto sicuro.</p>
      </div>
    </Modal>
  );
}

function PasswordBackup({ onClose, onExport }: { onClose: () => void; onExport: (p: string) => void }) {
  const ui = useUI();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const go = () => {
    if (a.length < 6) { ui.toast('Usa almeno 6 caratteri', true); return; }
    if (a !== b) { ui.toast('Le password non coincidono', true); return; }
    onExport(a);
  };
  return (
    <Modal title="Backup protetto da password" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" onClick={go}>Crea backup</button></>}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>Il file viene cifrato con AES-256: senza password nessuno può leggerlo. Se la dimentichi, il backup non è recuperabile.</p>
        <input className="input" type="password" autoFocus value={a} onChange={(e) => setA(e.target.value)} placeholder="Password" />
        <input className="input" type="password" value={b} onChange={(e) => setB(e.target.value)} placeholder="Ripeti la password" onKeyDown={(e) => e.key === 'Enter' && go()} />
      </div>
    </Modal>
  );
}
