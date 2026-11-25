// Schmiede: Verbesserung +1 … +10 ohne Fehlschlag, Material aus Kämpfen, Truhen, Bossen und Zerlegen.
// Alles wird aus Logs abgeleitet (worldLog für gewonnenes Material, forgeLog für Verbessern/Zerlegen).
import { hash } from './armor';
import type { Rarity } from './equipment';
import type { WorldEvent } from './world';

export type Mat = 'eisen' | 'silber' | 'gold' | 'reliquie';
export type Mats = Partial<Record<Mat, number>>;
export const MATS: { id: Mat; label: string; color: string }[] = [
  { id: 'eisen', label: 'Eisen', color: '#9aa3ad' },
  { id: 'silber', label: 'Silber', color: '#d7dde4' },
  { id: 'gold', label: 'Gold', color: '#e3b341' },
  { id: 'reliquie', label: 'Reliquie', color: '#c0392b' },
];
export const matLabel = (m: Mat) => MATS.find((x) => x.id === m)!.label;
/** „3 Eisen, 1 Silber“ */
export const matText = (m: Mats | undefined) =>
  (Object.entries(m ?? {}) as [Mat, number][])
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${matLabel(k)}`)
    .join(', ');

export type ForgeEvent = { k: 'upgrade'; at: string; id: string; to: number; cost: Mats } | { k: 'dismantle'; at: string; id: string; gain: Mats };

export const MAX_FORGE_LEVEL = 10;
/** +6 % auf Angriff und Abwehr je Stufe (+10 = +60 %) */
export const FORGE_BONUS = 0.06;
export const forgeFactor = (level: number) => 1 + FORGE_BONUS * Math.max(0, Math.min(MAX_FORGE_LEVEL, level));

/** Kosten für die Stufe `to` (1–10). Boss-Teile brauchen ab +6 zusätzlich eine Reliquie. */
export function upgradeCost(to: number, unique: boolean): Mats {
  const c: Mats =
    to <= 3 ? { eisen: to + 1 } : to <= 6 ? { eisen: 3, silber: to - 3 } : to <= 9 ? { silber: 2, gold: to - 6 } : { gold: 4, reliquie: 1 };
  if (unique && to >= 6) c.reliquie = (c.reliquie ?? 0) + 1;
  return c;
}

/** Material beim Zerlegen: nach Seltenheit, dazu etwas zurück für bereits investierte Stufen */
export function dismantleGain(rarity: Rarity, level: number): Mats {
  const base: Mats = rarity === 'common' ? { eisen: 2 } : rarity === 'rare' ? { eisen: 3, silber: 1 } : rarity === 'epic' ? { silber: 2, gold: 1 } : { gold: 2 };
  if (level > 0) base.eisen = (base.eisen ?? 0) + Math.ceil(level / 2);
  if (level >= 4) base.silber = (base.silber ?? 0) + Math.floor((Math.min(level, 6) - 3) / 2);
  if (level >= 7) base.gold = (base.gold ?? 0) + Math.floor((level - 6) / 2);
  return base;
}

export type MatSource = 'gegner' | 'elite' | 'truhe' | 'boss' | 'belagerung';

/** Material aus Kampf/Truhe – je höher die Region, desto edler (deterministisch je Schlüssel). */
export function matsFor(source: MatSource, regionIdx: number, key: string): Mats {
  const r = (n: number) => hash(`${key}#mat${n}`);
  const m: Mats = {};
  const add = (k: Mat, n: number) => n > 0 && (m[k] = (m[k] ?? 0) + n);
  if (source === 'gegner') {
    add('eisen', 1 + (r(1) < 0.5 ? 1 : 0));
    if (regionIdx >= 3 && r(2) < 0.3) add('silber', 1);
    if (regionIdx >= 7 && r(3) < 0.15) add('gold', 1);
  } else if (source === 'elite') {
    add('eisen', 2);
    add('silber', 1 + (regionIdx >= 4 ? 1 : 0));
    if (regionIdx >= 6 && r(3) < 0.4) add('gold', 1);
  } else if (source === 'truhe') {
    add('eisen', 2);
    if (r(2) < 0.6) add('silber', 1);
    if (regionIdx >= 4 && r(3) < 0.3) add('gold', 1);
  } else if (source === 'boss') {
    add('silber', 2);
    add('gold', 2);
    add('reliquie', 1);
  } else {
    add('eisen', 1);
  }
  return m;
}

export const addMats = (a: Mats, b: Mats, sign = 1): Mats => {
  const out: Mats = { ...a };
  for (const [k, v] of Object.entries(b) as [Mat, number][]) out[k] = (out[k] ?? 0) + sign * v;
  return out;
};
export const canAfford = (have: Mats, cost: Mats) => (Object.entries(cost) as [Mat, number][]).every(([k, v]) => (have[k] ?? 0) >= v);

/** Materialbestand: gewonnen auf der Karte + aus Zerlegen − verbraucht beim Verbessern */
export function matBalance(worldLog: WorldEvent[], forgeLog: ForgeEvent[]): Record<Mat, number> {
  let m: Mats = {};
  for (const e of worldLog) if ('mats' in e && e.mats) m = addMats(m, e.mats);
  for (const e of forgeLog) m = e.k === 'upgrade' ? addMats(m, e.cost, -1) : addMats(m, e.gain);
  return { eisen: m.eisen ?? 0, silber: m.silber ?? 0, gold: m.gold ?? 0, reliquie: m.reliquie ?? 0 };
}

/** Aktuelle Schmiedestufe je Teil (Zerlegen setzt zurück) */
export function forgeLevels(forgeLog: ForgeEvent[]): Map<string, number> {
  const lv = new Map<string, number>();
  for (const e of forgeLog) {
    if (e.k === 'upgrade') lv.set(e.id, e.to);
    else lv.delete(e.id);
  }
  return lv;
}

/** Zerlegte Teile (ein Eintrag je Zerlegen) */
export const dismantled = (forgeLog: ForgeEvent[]) => forgeLog.filter((e) => e.k === 'dismantle').map((e) => e.id);

/** Beute- und Kaufliste nach Zerlegen: jedes Zerlegen nimmt ein Exemplar weg (zuerst aus der Beute). */
export function effectiveLists(loot: string[], purchases: string[], gone: string[]) {
  const l = [...loot];
  const p = [...purchases];
  for (const id of gone) {
    const i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    else {
      const j = p.indexOf(id);
      if (j >= 0) p.splice(j, 1);
    }
  }
  return { loot: l, purchases: p };
}

/** Garantie: nach so vielen Siegen/Truhen ohne Ausrüstung fällt beim nächsten sicher etwas */
export const PITY = 5;
export function lootDrought(worldLog: WorldEvent[]): number {
  let n = 0;
  for (let i = worldLog.length - 1; i >= 0; i--) {
    const e = worldLog[i]!;
    if (e.k === 'fight' && !e.won) continue;
    if (e.k !== 'fight' && e.k !== 'chest') continue;
    if (e.loot.length) break;
    n++;
  }
  return n;
}
