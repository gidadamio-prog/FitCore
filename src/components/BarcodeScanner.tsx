// Kamerascanner: native BarcodeDetector-API, Fallback @zxing/browser, immer mit manueller Eingabe.
import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input } from './ui';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'unavailable' | 'denied'>('idle');
  const [engine, setEngine] = useState<string>('');
  const [manual, setManual] = useState('');
  const [err, setErr] = useState<string>();
  const stopRef = useRef<() => void>(() => undefined);
  const done = useRef(false);

  const handle = (code: string) => {
    if (done.current) return;
    const c = code.replace(/\D/g, '');
    if (c.length < 8) return;
    done.current = true;
    stopRef.current();
    if (navigator.vibrate) navigator.vibrate(60);
    onCode(c);
  };

  const start = async () => {
    setErr(undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const v = video.current!;
      v.srcObject = stream;
      await v.play();
      let raf = 0;
      let stopped = false;
      let zxingControls: { stop: () => void } | undefined;
      stopRef.current = () => {
        stopped = true;
        cancelAnimationFrame(raf);
        zxingControls?.stop();
        stream.getTracks().forEach((t) => t.stop());
      };
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (BD) {
        const supported = (await BD.getSupportedFormats?.()) ?? FORMATS;
        const det = new BD({ formats: FORMATS.filter((f) => supported.includes(f)) });
        setEngine('BarcodeDetector');
        setStatus('scanning');
        const loop = async () => {
          if (stopped) return;
          try {
            const r = await det.detect(v);
            if (r[0]?.rawValue) return handle(r[0].rawValue);
          } catch {
            /* nächster Frame */
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      } else {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        setEngine('ZXing');
        setStatus('scanning');
        zxingControls = await reader.decodeFromVideoElement(v, (res) => {
          if (res) handle(res.getText());
        });
      }
    } catch (e) {
      const name = (e as DOMException)?.name;
      setStatus(name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
  };

  useEffect(() => () => stopRef.current(), []);

  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        <video ref={video} className="h-full w-full object-cover" playsInline muted />
        {status === 'scanning' && <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80 shadow-[0_0_12px_rgb(var(--accent))]" />}
        {status !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-white/80">
            {status === 'denied' && <p>Kamerazugriff verweigert. Bitte Barcode manuell eingeben oder Berechtigung erteilen.</p>}
            {status === 'unavailable' && <p>Keine Kamera verfügbar (oder kein HTTPS). Bitte Barcode manuell eingeben.</p>}
            {(status === 'idle' || status === 'denied') && (
              <Button onClick={start} variant="secondary" className="bg-white/15 text-white">
                Kamera starten
              </Button>
            )}
            {status === 'starting' && <p>Kamera wird gestartet …</p>}
          </div>
        )}
      </div>
      {engine && <p className="text-xs text-muted">Scanner: {engine}</p>}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = manual.replace(/\D/g, '');
          if (c.length < 8 || c.length > 14) return setErr('Bitte 8–14 Ziffern eingeben.');
          stopRef.current();
          onCode(c);
        }}
      >
        <Field label="Barcode manuell eingeben" error={err} className="flex-1">
          {(id) => <Input id={id} inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="z. B. 4000417025005" />}
        </Field>
        <Button type="submit">Suchen</Button>
      </form>
    </div>
  );
}
