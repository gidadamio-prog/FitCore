// Kampfwerte und Kampfsimulation auf der Weltkarte. Stärke kommt aus Heldenstufe und Ausrüstung –
// Schaden am Boss entsteht nur im direkten Kampf (Belagerung über mehrere Tage).
import { ARMOR_SETS, parseArmorId, statClass, type ArmorClass, type ArmorSlot } from './armor';
import type { Rarity, SlotId } from './equipment';
import { WEAPON_WINDOWS, weaponById, weaponStats } from './weapons';
import { forgeFactor } from './forge';
import { REGIONS, regionIndex, type NodeType } from './world';

export interface Stats {
  atk: number;
  def: number;
  hp: number;
}

export const ARMOR_DEF: Record<ArmorClass, number> = { stoff: 2, leder: 4, schwer: 7, boss: 10, kueche: 4 };
export const SLOT_WEIGHT: Record<ArmorSlot, number> = { head: 1, chest: 1.6, hands: 0.8, legs: 1.2, feet: 0.8 };

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Werte eines einzelnen Teils (für Inventar-Anzeige) */
export function itemStats(id: string, rarity: Rarity | null, level = 0): Partial<Stats> {
  const f = forgeFactor(level);
  const a = parseArmorId(id);
  if (a) return { def: round1(ARMOR_DEF[statClass(a.set)] * SLOT_WEIGHT[a.slot] * f) };
  const w = weaponById(id);
  if (!w || !rarity) return {};
  const st = weaponStats(w);
  return { ...(st.atk != null ? { atk: Math.round(st.atk * f) } : {}), ...(st.def != null ? { def: Math.round(st.def * f) } : {}) };
}

/** Heldenwerte aus Stufe und getragener Ausrüstung (`worn` = Item-ID → getragene Seltenheit). */
export function heroStats(level: number, loadout: Partial<Record<SlotId, string | null>>, worn: (id: string) => Rarity | null, levels: (id: string) => number = () => 0): Stats {
  let atk = 6 + 1.6 * level;
  let def = 0.6 * level;
  let armor = 0;
  for (const id of Object.values(loadout)) {
    if (!id) continue;
    const s = itemStats(id, worn(id), levels(id));
    atk += s.atk ?? 0;
    if (parseArmorId(id)) armor += s.def ?? 0;
    else def += s.def ?? 0;
  }
  if (!loadout.main) atk += 2; // Fäuste
  def += armor;
  return { atk: Math.round(atk), def: Math.round(def), hp: Math.round(60 + 10 * level + 2 * armor) };
}

export const power = (s: Stats) => Math.round(s.atk * 2 + s.def * 1.5 + s.hp / 5);

/** Kampfgeist: an Tagen mit Training +15 % Angriff */
export const KAMPFGEIST = 0.15;

// ---------------------------------------------------------------------------
// Gegner
// ---------------------------------------------------------------------------

/** Referenz-Held einer Region: Mindeststufe und die dort übliche Ausrüstung */
export function referenceHero(regionIdx: number): Stats {
  const r = REGIONS[Math.max(0, Math.min(REGIONS.length - 1, regionIdx))]!;
  const cls: ArmorClass = regionIdx < 3 ? 'stoff' : regionIdx < 6 ? 'leder' : regionIdx < 9 ? 'schwer' : 'boss';
  // übliche Bewaffnung: Einhandwaffe + Schild der unteren Stufe des Beutefensters
  const q = WEAPON_WINDOWS[Math.max(0, Math.min(WEAPON_WINDOWS.length - 1, regionIdx))]![0];
  const level = r.minLevel + 1;
  const armor = (Object.keys(SLOT_WEIGHT) as ArmorSlot[]).reduce((a, s) => a + ARMOR_DEF[cls] * SLOT_WEIGHT[s], 0);
  return { atk: Math.round(6 + 1.6 * level + (5 + 2.2 * q)), def: Math.round(0.6 * level + armor + (4 + 1.3 * q)), hp: Math.round(60 + 10 * level + 2 * armor) };
}

export interface Foe extends Stats {
  name: string;
  kind: 'gegner' | 'elite' | 'boss';
}

const heroHit = (atk: number, def: number) => Math.max(atk * 0.25, atk - 0.5 * def);

/** Gegner so bemessen, dass der Referenz-Held einen Trupp in ~3–4 Runden besiegt und dabei ~40 % Leben verliert. */
export function foeFor(regionId: string, type: NodeType, name: string): Foe {
  const ref = referenceHero(regionIndex(regionId));
  const kind = type === 'hauptstadt' ? 'boss' : type === 'elite' ? 'elite' : 'gegner';
  const def = Math.round(ref.def * (kind === 'boss' ? 0.9 : kind === 'elite' ? 0.75 : 0.6));
  const perRound = heroHit(ref.atk, def);
  const rounds = kind === 'boss' ? 32 : kind === 'elite' ? 5.5 : 3.5;
  const hurt = kind === 'boss' ? 0.15 : kind === 'elite' ? 0.16 : 0.12;
  return { name, kind, def, hp: Math.round(perRound * rounds), atk: Math.round(hurt * ref.hp + 0.5 * ref.def) };
}

export function recommendedPower(regionId: string) {
  return power(referenceHero(regionIndex(regionId)));
}

// ---------------------------------------------------------------------------
// Kampf
// ---------------------------------------------------------------------------

export interface Blow {
  by: 'hero' | 'foe';
  dmg: number;
  heroHp: number;
  foeHp: number;
}

export interface FightResult {
  blows: Blow[];
  won: boolean;
  /** Schaden am Gegner insgesamt */
  dealt: number;
  heroHpEnd: number;
  foeHpStart: number;
  foeHpEnd: number;
}

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const MAX_ROUNDS = { gegner: 8, elite: 8, boss: 6 } as const;
/** Ein Belagerungsangriff nimmt höchstens diesen Anteil der Boss-Lebenspunkte – ein Boss braucht mindestens 4 Tage. */
export const SIEGE_CAP = 0.25;

/**
 * Runde für Runde: Held schlägt zuerst, ±10 % Streuung. Gegner/Elite: Sieg, wenn er fällt, sonst Rückzug.
 * Boss: Belagerung – `foeHp` ist das aktuelle Restleben; Schaden pro Angriff höchstens SIEGE_CAP × Max-LP.
 */
export function simulateFight(hero: Stats, foe: Foe, seed: string, opts: { kampfgeist?: boolean; foeHp?: number } = {}): FightResult {
  const r = rng(seed);
  const atk = hero.atk * (opts.kampfgeist ? 1 + KAMPFGEIST : 1);
  const start = opts.foeHp ?? foe.hp;
  const cap = foe.kind === 'boss' ? Math.ceil(foe.hp * SIEGE_CAP) : Infinity;
  let hHp = hero.hp;
  let fHp = start;
  let dealt = 0;
  const blows: Blow[] = [];
  for (let round = 0; round < MAX_ROUNDS[foe.kind] && hHp > 0 && fHp > 0 && dealt < cap; round++) {
    const d = Math.max(1, Math.round(heroHit(atk, foe.def) * (0.9 + 0.2 * r())));
    const dd = Math.min(d, fHp, cap - dealt);
    fHp -= dd;
    dealt += dd;
    blows.push({ by: 'hero', dmg: dd, heroHp: hHp, foeHp: fHp });
    if (fHp <= 0 || dealt >= cap) break;
    const e = Math.max(1, Math.round(Math.max(foe.atk * 0.2, foe.atk - 0.5 * hero.def) * (0.9 + 0.2 * r())));
    hHp = Math.max(0, hHp - e);
    blows.push({ by: 'foe', dmg: e, heroHp: hHp, foeHp: fHp });
  }
  return { blows, won: fHp <= 0, dealt, heroHpEnd: hHp, foeHpStart: start, foeHpEnd: fHp };
}

/** Grobe Siegchance über 40 Würfe (für die Anzeige vor dem Kampf) */
export function winChance(hero: Stats, foe: Foe, kampfgeist = false): number {
  let wins = 0;
  for (let i = 0; i < 40; i++) if (simulateFight(hero, foe, `p${i}`, { kampfgeist }).won) wins++;
  return wins / 40;
}

export { ARMOR_SETS };
