import { useEffect, useRef, useState } from 'react';
import { useSettings } from './data';

/** true, wenn Animationen reduziert werden sollen (Einstellung oder System). */
export function useReducedMotion() {
  const { reduceMotion } = useSettings();
  const [system, setSystem] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSystem(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduceMotion || system;
}

/** Zahl zählt weich hoch, statt zu springen. Der Endwert stimmt immer. */
export function useCountUp(value: number, ms = 700) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms, reduced]);
  return shown;
}
