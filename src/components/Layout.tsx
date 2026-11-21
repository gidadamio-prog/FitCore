import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, Dumbbell, Home, Settings, Utensils, Timer, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn, Button, Sheet } from './ui';
import { useActiveWorkout } from '@/hooks/data';
import { useUi } from '@/stores/ui';

const NAV = [
  { to: '/', label: 'Heute', icon: Home, end: true },
  { to: '/nutrition', label: 'Ernährung', icon: Utensils },
  { to: '/training', label: 'Training', icon: Dumbbell },
  { to: '/body', label: 'Körper', icon: Activity },
  { to: '/stats', label: 'Statistiken', icon: BarChart3 },
];

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function Layout() {
  const active = useActiveWorkout();
  const nav = useNavigate();
  const online = useOnline();
  const loc = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r p-4 md:flex">
        <div className="mb-4 px-2 text-lg font-bold tracking-tight">
          Fit<span className="text-accent">Core</span>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium', isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-fg/5 hover:text-fg')}>
            <n.icon className="h-5 w-5" /> {n.label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <NavLink to="/settings" className={({ isActive }) => cn('flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium', isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-fg/5')}>
          <Settings className="h-5 w-5" /> Einstellungen
        </NavLink>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-bg/85 px-4 backdrop-blur md:hidden">
          <span className="text-lg font-bold tracking-tight">
            Fit<span className="text-accent">Core</span>
          </span>
          <Button variant="ghost" size="icon" aria-label="Einstellungen und Profil" onClick={() => nav('/settings')}>
            <Settings className="h-5 w-5" />
          </Button>
        </header>
        {!online && (
          <div className="flex items-center gap-2 bg-warn/15 px-4 py-2 text-xs text-warn" role="status">
            <WifiOff className="h-4 w-4" /> Offline – lokale Daten funktionieren, Online-Suche ist pausiert.
          </div>
        )}
        {active && loc.pathname !== '/training/workout' && (
          <button onClick={() => nav('/training/workout')} className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-sm font-medium text-white">
            <Timer className="h-4 w-4" /> Laufendes Workout: {active.name} – fortsetzen
          </button>
        )}
        <main className="w-full flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 backdrop-blur md:hidden" aria-label="Hauptnavigation">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium', isActive ? 'text-accent' : 'text-muted')}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useUi();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn('pointer-events-auto max-w-md rounded-xl px-4 py-3 text-left text-sm shadow-lg', t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'success' ? 'bg-accent text-white' : 'bg-fg text-bg')}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

export function ConfirmHost() {
  const { confirmReq, closeConfirm } = useUi();
  return (
    <Sheet
      open={!!confirmReq}
      onClose={() => closeConfirm(false)}
      title={confirmReq?.title ?? ''}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={() => closeConfirm(false)}>
            Abbrechen
          </Button>
          <Button variant={confirmReq?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => closeConfirm(true)}>
            {confirmReq?.confirmLabel ?? 'Bestätigen'}
          </Button>
        </>
      }
    >
      <p className="whitespace-pre-line text-sm text-muted">{confirmReq?.text}</p>
    </Sheet>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
