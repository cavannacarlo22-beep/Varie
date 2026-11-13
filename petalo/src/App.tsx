import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  BookHeart, Calculator, CalendarHeart, FolderHeart, GraduationCap, Home, ListChecks, Menu, MoreHorizontal,
  Settings as SettingsIcon, Sparkles, Type, Flower2,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { HeartsBackdrop, TinyHeart } from './components/Hearts';
import { UIProvider, useUI } from './components/ui';
import { db, ensureDefaults, requestPersistence } from './db/db';
import { getSettings, setSetting, useSettingsLoaded } from './db/settings';
import { collectDueReminders, showSystemNotification } from './lib/notify';
import { takeSnapshot } from './lib/backup';
import { todayISO } from './lib/dates';
import { LockScreen } from './pages/LockScreen';
import HomePage from './pages/Home';

const Agenda = lazy(() => import('./pages/Agenda'));
const Calcoli = lazy(() => import('./pages/Calcoli'));
const Liste = lazy(() => import('./pages/Liste'));
const Archivio = lazy(() => import('./pages/Archivio'));
const Quaderni = lazy(() => import('./pages/Quaderni'));
const Notebook = lazy(() => import('./pages/NotebookView'));
const FontLibrary = lazy(() => import('./pages/FontLibrary'));
const Studio = lazy(() => import('./pages/Studio'));
const Benessere = lazy(() => import('./pages/Benessere'));
const Impostazioni = lazy(() => import('./pages/Impostazioni'));

export const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarHeart },
  { to: '/calcoli', label: 'Calcoli matematici', short: 'Calcoli', icon: Calculator },
  { to: '/liste', label: 'Le mie liste', short: 'Liste', icon: ListChecks },
  { to: '/archivio', label: 'Archivio documenti', short: 'Archivio', icon: FolderHeart },
  { to: '/quaderni', label: 'Quaderni universitari', short: 'Quaderni', icon: BookHeart },
  { to: '/font', label: 'Libreria dei font', short: 'Font', icon: Type },
] as const;
export const NAV_EXTRA = [
  { to: '/studio', label: 'Studio ed esami', icon: GraduationCap },
  { to: '/benessere', label: 'Benessere', icon: Flower2 },
] as const;

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const today = todayISO();
  const pending = useLiveQuery(() => db.items.filter((i) => !i.done).count(), []);
  const todayEvents = useLiveQuery(() => db.events.where('date').equals(today).count(), [today]);
  return (
    <nav className={'sidebar' + (open ? ' open' : '')} aria-label="Menu principale">
      <div className="brand">
        <div className="brand-mark"><Sparkles size={20} /></div>
        <div className="brand-name">Petalo<small>il tuo spazio</small></div>
      </div>
      {NAV.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink key={to} to={to} end={'end' in rest} className="nav-link" onClick={onNavigate} title={label}>
          <Icon className="nav-ico" strokeWidth={1.8} />
          <span className="nav-label">{label}</span>
          {to === '/agenda' && !!todayEvents && <span className="badge soft">{todayEvents}</span>}
          {to === '/liste' && !!pending && <span className="badge soft">{pending}</span>}
        </NavLink>
      ))}
      <div className="nav-section">Extra</div>
      {NAV_EXTRA.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className="nav-link" onClick={onNavigate} title={label}>
          <Icon className="nav-ico" strokeWidth={1.8} />
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
      <NavLink to="/impostazioni" className="nav-link" onClick={onNavigate} title="Impostazioni">
        <SettingsIcon className="nav-ico" strokeWidth={1.8} />
        <span className="nav-label">Impostazioni</span>
      </NavLink>
      <div className="sidebar-foot"><TinyHeart /> <span>Salvato sul dispositivo</span></div>
    </nav>
  );
}

function TabBar({ onMore }: { onMore: () => void }) {
  return (
    <nav className="tabbar" aria-label="Navigazione rapida">
      <NavLink to="/" end><Home size={22} />Home</NavLink>
      <NavLink to="/agenda"><CalendarHeart size={22} />Agenda</NavLink>
      <NavLink to="/quaderni"><BookHeart size={22} />Quaderni</NavLink>
      <NavLink to="/liste"><ListChecks size={22} />Liste</NavLink>
      <button onClick={onMore}><MoreHorizontal size={22} />Altro</button>
    </nav>
  );
}

const TITLES: Record<string, string> = {
  '/': 'Home', '/agenda': 'Agenda', '/calcoli': 'Calcoli matematici', '/liste': 'Le mie liste',
  '/archivio': 'Archivio documenti', '/quaderni': 'Quaderni universitari', '/font': 'Libreria dei font',
  '/studio': 'Studio ed esami', '/benessere': 'Benessere', '/impostazioni': 'Impostazioni',
};

function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const base = '/' + (loc.pathname.split('/')[1] ?? '');
  const isNotebook = /^\/quaderni\/[^/]+/.test(loc.pathname);
  return (
    <div className={'app' + (isNotebook ? ' nb-mode' : '')}>
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open && <div className="overlay" style={{ zIndex: 29, background: 'rgba(75,44,56,.18)' }} onClick={() => setOpen(false)} />}
      <div className="main">
        {!isNotebook && (
          <header className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Apri menu"><Menu size={22} /></button>
            <div className="topbar-title">{TITLES[base] ?? 'Petalo'}</div>
            <div id="topbar-actions" className="row" />
          </header>
        )}
        <Suspense fallback={<div className="page muted">Un attimo…</div>}>{children}</Suspense>
      </div>
      <TabBar onMore={() => setOpen(true)} />
    </div>
  );
}

/** Background jobs: reminders, automatic snapshots, storage persistence. */
function Background() {
  const ui = useUI();
  useEffect(() => {
    void requestPersistence();
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const due = await collectDueReminders();
        for (const r of due) {
          ui.toast(`⏰ ${r.title} — ${r.body}`);
          await showSystemNotification(r.title, r.body);
        }
      } catch (e) {
        console.error(e);
      }
    };
    const snapshot = async () => {
      const s = await getSettings();
      if (s.autoSnapshot && Date.now() - s.lastSnapshotAt > 24 * 3600 * 1000) {
        try {
          await takeSnapshot();
          await setSetting('lastSnapshotAt', Date.now());
        } catch (e) {
          console.error('Snapshot non riuscito', e);
        }
      }
    };
    void tick();
    const t1 = setInterval(tick, 20_000);
    const t0 = setTimeout(snapshot, 8000);
    const t2 = setInterval(snapshot, 60 * 60 * 1000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; clearInterval(t1); clearTimeout(t0); clearInterval(t2); document.removeEventListener('visibilitychange', onVis); };
  }, [ui]);
  return null;
}

function Themed({ children }: { children: ReactNode }) {
  const s = useSettingsLoaded();
  const [unlocked, setUnlocked] = useState(false);
  const [lastActive, setLastActive] = useState(Date.now());

  useEffect(() => {
    if (!s) return;
    const root = document.documentElement;
    root.dataset.theme = s.theme;
    if (s.theme !== 'notte' && s.accent && s.theme === 'rosa') {
      root.style.setProperty('--primary', s.accent);
    } else {
      root.style.removeProperty('--primary');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', s.theme === 'notte' ? '#1f1820' : '#fff6f7');
  }, [s]);

  // auto-lock after inactivity
  useEffect(() => {
    if (!s?.pinHash || !s.lockAfterMinutes) return;
    const bump = () => setLastActive(Date.now());
    window.addEventListener('pointerdown', bump);
    window.addEventListener('keydown', bump);
    const t = setInterval(() => {
      if (Date.now() - lastActive > s.lockAfterMinutes * 60000) setUnlocked(false);
    }, 15000);
    const onVis = () => {
      if (document.visibilityState === 'hidden') setLastActive(Date.now());
      else if (Date.now() - lastActive > s.lockAfterMinutes * 60000) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', bump);
      window.removeEventListener('keydown', bump);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(t);
    };
  }, [s?.pinHash, s?.lockAfterMinutes, lastActive]);

  if (!s) return null;
  return (
    <>
      {s.hearts && <HeartsBackdrop />}
      {s.pinHash && !unlocked ? <LockScreen hash={s.pinHash} salt={s.pinSalt} onUnlock={() => { setUnlocked(true); setLastActive(Date.now()); }} /> : children}
    </>
  );
}

export default function App() {
  useEffect(() => { void ensureDefaults(); }, []);
  return (
    <UIProvider>
      <Themed>
        <HashRouter>
          <Background />
          <Shell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/calcoli" element={<Calcoli />} />
              <Route path="/liste" element={<Liste />} />
              <Route path="/liste/:listId" element={<Liste />} />
              <Route path="/archivio" element={<Archivio />} />
              <Route path="/archivio/:folderId" element={<Archivio />} />
              <Route path="/quaderni" element={<Quaderni />} />
              <Route path="/quaderni/:notebookId" element={<Notebook />} />
              <Route path="/quaderni/:notebookId/:noteId" element={<Notebook />} />
              <Route path="/font" element={<FontLibrary />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="/benessere" element={<Benessere />} />
              <Route path="/impostazioni" element={<Impostazioni />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </Shell>
        </HashRouter>
      </Themed>
    </UIProvider>
  );
}
