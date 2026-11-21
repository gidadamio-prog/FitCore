// Hinweis/Knopf zur Installation als App (Android: natives Install-Prompt; iOS: Anleitung „Zum Home-Bildschirm“).
import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button, Card } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function InstallPrompt({ always = false }: { always?: boolean }) {
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('fitcore-install-dismissed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (isStandalone()) return always ? <p className="text-sm text-muted">FitCore läuft als installierte App. ✓</p> : null;
  if (hidden && !always) return null;
  const ios = isIOS();
  if (!deferred && !ios && !always) return null;
  const dismiss = () => {
    try {
      localStorage.setItem('fitcore-install-dismissed', '1');
    } catch {
      /* egal */
    }
    setHidden(true);
  };
  return (
    <Card className="relative border-accent/40 bg-accent/[0.06]">
      {!always && (
        <button className="absolute right-2 top-2 p-2 text-muted" aria-label="Hinweis schließen" onClick={dismiss}>
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="pr-6 text-sm font-semibold">FitCore als App installieren</div>
      {deferred ? (
        <>
          <p className="mt-1 text-sm text-muted">Eigenes App-Symbol, Vollbild und offline nutzbar. Deine Daten bleiben auf dem Gerät.</p>
          <Button
            className="mt-3"
            onClick={async () => {
              await deferred?.prompt();
              await deferred?.userChoice.catch(() => undefined);
              deferred = null;
              force((n) => n + 1);
            }}
          >
            <Download className="h-4 w-4" /> Jetzt installieren
          </Button>
        </>
      ) : ios ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            In <b>Safari</b> unten auf <Share className="inline h-4 w-4" /> <b>Teilen</b> tippen.
          </li>
          <li>
            <b>„Zum Home-Bildschirm“</b> wählen und „Hinzufügen“ tippen.
          </li>
          <li>FitCore ab jetzt über das neue Symbol starten.</li>
        </ol>
      ) : (
        <p className="mt-1 text-sm text-muted">Im Browser-Menü (⋮) „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen. Funktioniert nur über HTTPS.</p>
      )}
    </Card>
  );
}
