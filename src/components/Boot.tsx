// Start-Absicherung: Diagnose bei hängendem Start, Fehlergrenze und Reparatur ohne Datenverlust.
import React, { useEffect, useState } from 'react';
import { db } from '@/data/db';
import { exportBackup, download } from '@/data/backup';

export const APP_VERSION = '1.16.0';

/** Service Worker abmelden und App-Cache leeren – IndexedDB (deine Daten) bleibt unangetastet. */
export async function forceAppUpdate() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignorieren */
  }
  try {
    const keys = (await caches?.keys?.()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignorieren */
  }
  location.reload();
}

async function emergencyBackup() {
  try {
    const b = await Promise.race([exportBackup(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Datenbank antwortet nicht')), 6000))]);
    download(`fitcore-notfall-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// Datenbankstatus global beobachten
export const bootState: { dbOpen: boolean; blocked: boolean; error: string | null; events: string[] } = { dbOpen: false, blocked: false, error: null, events: [] };
const log = (m: string) => bootState.events.push(`${new Date().toLocaleTimeString('de-DE')} ${m}`);
db.on('blocked', () => {
  bootState.blocked = true;
  log('DB blockiert (anderes Fenster)');
});
db.on('versionchange', () => {
  log('Versionswechsel durch anderes Fenster – Verbindung wird geschlossen');
});
db.open()
  .then(() => {
    bootState.dbOpen = true;
    log('DB geöffnet (v' + db.verno + ')');
  })
  .catch((e: unknown) => {
    bootState.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    log('DB-Fehler: ' + bootState.error);
  });

function RecoveryPanel({ title, detail }: { title: string; detail?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const btn = 'h-12 w-full rounded-xl px-4 text-sm font-medium';
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-sm" data-testid="recovery">
      <div className="font-brand text-2xl font-bold">
        Fit<span className="text-gold">Core</span>
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted">Deine Daten liegen sicher auf dem Gerät. Probier die Schritte der Reihe nach:</p>
      <ol className="list-decimal space-y-1 pl-5 text-muted">
        <li>Alle anderen FitCore-Fenster und Browser-Tabs mit FitCore schließen.</li>
        <li>„Neu laden“ tippen.</li>
        <li>Hilft das nicht: „App-Update erzwingen“ – lädt die App neu aus dem Internet, deine Daten bleiben erhalten.</li>
      </ol>
      <button className={`${btn} bg-primary text-primary-fg`} onClick={() => location.reload()}>
        Neu laden
      </button>
      <button className={`${btn} border bg-card`} onClick={() => forceAppUpdate()}>
        App-Update erzwingen (Daten bleiben)
      </button>
      <button className={`${btn} border bg-card`} onClick={async () => setMsg((await emergencyBackup()) ?? 'Backup wurde heruntergeladen.')}>
        Notfall-Backup herunterladen
      </button>
      {msg && <p className="text-xs text-warn">{msg}</p>}
      <details className="rounded-xl border p-3 text-xs text-muted" open>
        <summary className="cursor-pointer">Diagnose (für Screenshot)</summary>
        <div className="mt-2 space-y-0.5 font-mono">
          <div>Version: {APP_VERSION}</div>
          <div>Datenbank offen: {bootState.dbOpen ? 'ja' : 'nein'} · blockiert: {bootState.blocked ? 'ja' : 'nein'}</div>
          <div>Service Worker: {'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'aktiv' : 'nicht aktiv') : 'nicht verfügbar'}</div>
          <div>Online: {navigator.onLine ? 'ja' : 'nein'}</div>
          {detail && <div className="break-all text-danger">Fehler: {detail}</div>}
          {bootState.error && <div className="break-all text-danger">DB: {bootState.error}</div>}
          {bootState.events.slice(-6).map((e) => (
            <div key={e}>{e}</div>
          ))}
          <div className="break-all">{navigator.userAgent}</div>
        </div>
      </details>
    </div>
  );
}

/** Ladebildschirm, der nach 8 s Hilfe & Diagnose anbietet. */
export function BootScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (bootState.error) return <RecoveryPanel title="Die Datenbank konnte nicht geöffnet werden." detail={bootState.error} />;
  if (slow) return <RecoveryPanel title={bootState.blocked ? 'Ein anderes FitCore-Fenster blockiert den Start.' : 'Der Start dauert ungewöhnlich lange.'} />;
  return <div className="flex min-h-dvh items-center justify-center text-muted">Lade FitCore …</div>;
}

/** Fehlergrenze: zeigt statt einer leeren Seite Hilfe und Reparatur an. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    log('Absturz: ' + error.message);
  }
  render() {
    if (this.state.error) return <RecoveryPanel title="Beim Anzeigen ist ein Fehler aufgetreten." detail={`${this.state.error.name}: ${this.state.error.message}`} />;
    return this.props.children;
  }
}
