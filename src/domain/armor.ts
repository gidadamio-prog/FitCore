// Rüstungs-Sets: 36 Sets mit je 5 Teilen (Kopf, Brust, Arme, Hose, Stiefel) in vier Klassen.
// Freischaltung auf drei Wegen: verdienen (Start, Ränge, Bosse), kaufen (Markt, ab Rang je Klasse) und Beute nach Kämpfen.
import type { Rarity } from './equipment';

export type ArmorClass = 'stoff' | 'leder' | 'schwer' | 'boss';
export const ARMOR_CLASS_LABEL: Record<ArmorClass, string> = { stoff: 'Stoff', leder: 'Leder', schwer: 'Schwer', boss: 'Boss' };
export const ARMOR_CLASS_RARITY: Record<ArmorClass, Rarity> = { stoff: 'common', leder: 'rare', schwer: 'epic', boss: 'legendary' };
export const ARMOR_CLASS_COLOR: Record<ArmorClass, string> = { stoff: '#d9c7a0', leder: '#b0814c', schwer: '#c3cad6', boss: '#f0b43c' };
/** Ab diesem Rang im Markt kaufbar bzw. als Beute möglich (Boss-Sets nur durch Bosse) */
export const ARMOR_CLASS_MIN_RANK: Record<ArmorClass, number> = { stoff: 1, leder: 3, schwer: 5, boss: 99 };

export type ArmorSlot = 'head' | 'chest' | 'hands' | 'legs' | 'feet';
export const ARMOR_SLOTS: ArmorSlot[] = ['head', 'chest', 'hands', 'legs', 'feet'];

export interface ArmorSet {
  idx: number;
  /** Name als Wortanfang, z. B. „Legionärs“ → „Legionärs-Helm“ */
  prefix: string;
  /** Name des Sets, z. B. „Legionär“ */
  name: string;
  cls: ArmorClass;
  /** Stufe innerhalb der Klasse (0 …) – bestimmt den Preis */
  tier: number;
  head: string;
  chest: string;
  hands: string;
  legs: string;
  feet: string;
}

type Row = [prefix: string, name: string, head: string, chest?: string, hands?: string, legs?: string, feet?: string];
const CLOTH: Row[] = [
  ['Novizen', 'Novize', 'Kapuze'],
  ['Wanderer', 'Wanderer', 'Kapuze'],
  ['Gelehrten', 'Gelehrter', 'Kapuze', 'Robe'],
  ['Priester', 'Priester', 'Kapuze', 'Robe'],
  ['Auguren', 'Augur', 'Haube', 'Robe'],
  ['Sonnen', 'Sonnenpriester', 'Strahlenhaube', 'Robe'],
  ['Kräuter', 'Kräuterkundiger', 'Hut', 'Robe'],
  ['Magier', 'Magier', 'Hut', 'Robe'],
  ['Sterndeuter', 'Sterndeuter', 'Hut', 'Robe'],
  ['Hohepriester', 'Hohepriester', 'Haube', 'Robe'],
];
const LEATHER: Row[] = [
  ['Orakel', 'Orakel', 'Haube', 'Robe', 'Ärmel', 'Beinkleid'],
  ['Licht', 'Lichtbringer', 'Heiligenschein-Haube', 'Robe', 'Ärmel', 'Beinkleid'],
  ['Banditen', 'Bandit', 'Kopftuch'],
  ['Späher', 'Späher', 'Kapuze'],
  ['Wegelagerer', 'Wegelagerer', 'Kapuze'],
  ['Pelzjäger', 'Pelzjäger', 'Pelzkapuze'],
  ['Hain', 'Haingeist', 'Kapuze'],
  ['Hirsch', 'Hirschjäger', 'Geweihkapuze'],
  ['Kundschafter', 'Kundschafter', 'Lederkappe'],
  ['Wüsten', 'Wüstenreiter', 'Turban'],
];
const HEAVY: Row[] = [
  ['Waldläufer', 'Waldläufer', 'Hut', 'Rüstung', 'Armschienen', 'Lederhose', 'Stiefel'],
  ['Jagdmeister', 'Jagdmeister', 'Kapuze', 'Rüstung', 'Armschienen', 'Lederhose', 'Stiefel'],
  ['Druiden', 'Druide', 'Geweihkapuze', 'Rüstung', 'Armschienen', 'Beinkleid', 'Stiefel'],
  ['Waldkönigs', 'Waldkönig', 'Geweihkrone', 'Rüstung', 'Armschienen', 'Beinkleid', 'Stiefel'],
  ['Rekruten', 'Rekrut der Legion', 'Helm'],
  ['Legionärs', 'Legionär', 'Helm'],
  ['Zenturio', 'Zenturio', 'Helm'],
  ['Tribunen', 'Tribun', 'Helm'],
  ['Prätorianer', 'Prätorianer', 'Helm'],
  ['Adler', 'Adlerträger', 'Flügelhelm'],
];
const BOSS: Row[] = [
  ['Großkönigs', 'Großkönig', 'Krone', 'Ornat', 'Armschienen', 'Beinkleid', 'Stiefel'],
  ['Löwenkönigs', 'Löwenkönig', 'Krone', 'Ornat', 'Armschienen', 'Beinkleid', 'Stiefel'],
  ['Pharaonen', 'Pharao', 'Nemes', 'Ornat', 'Armschienen', 'Beinkleid', 'Stiefel'],
  ['Numider', 'Löwe von Numidien', 'Löwenhaupt', 'Panzer', 'Armschienen', 'Beinkleid', 'Stiefel'],
  ['Usurpatoren', 'Usurpator', 'Visierhelm', 'Panzer', 'Panzerhandschuhe', 'Beinschutz', 'Panzerstiefel'],
  ['Grenzwächter', 'Grenzwächter', 'Flügelhelm', 'Panzer', 'Panzerhandschuhe', 'Beinschutz', 'Panzerstiefel'],
];
const DEFAULTS: Record<Exclude<ArmorClass, 'boss'>, [string, string, string, string]> = {
  stoff: ['Gewand', 'Ärmel', 'Hose', 'Stiefel'],
  leder: ['Wams', 'Armschienen', 'Lederhose', 'Stiefel'],
  schwer: ['Panzer', 'Panzerhandschuhe', 'Beinschutz', 'Panzerstiefel'],
};

export const ARMOR_SETS: ArmorSet[] = (
  [
    ['stoff', CLOTH],
    ['leder', LEATHER],
    ['schwer', HEAVY],
    ['boss', BOSS],
  ] as [ArmorClass, Row[]][]
).flatMap(([cls, rows], ci) =>
  rows.map(([prefix, name, head, chest, hands, legs, feet], tier) => {
    const d = cls === 'boss' ? DEFAULTS.schwer : DEFAULTS[cls];
    return { idx: ci * 10 + tier, prefix, name, cls, tier, head, chest: chest ?? d[0], hands: hands ?? d[1], legs: legs ?? d[2], feet: feet ?? d[3] };
  }),
);

export const armorItemId = (idx: number, slot: ArmorSlot) => `armor-${String(idx).padStart(2, '0')}-${slot}`;
export function parseArmorId(id: string): { set: ArmorSet; slot: ArmorSlot } | null {
  const m = /^armor-(\d\d)-(head|chest|hands|legs|feet)$/.exec(id);
  const set = m ? ARMOR_SETS[Number(m[1])] : undefined;
  return set && m ? { set, slot: m[2] as ArmorSlot } : null;
}
export const armorPieceName = (set: ArmorSet, slot: ArmorSlot) => `${set.prefix}-${set[slot]}`;

const FILE_PART: Record<ArmorSlot, string> = { head: 'kopf', chest: 'brust', hands: 'arm_l', legs: 'hose', feet: 'stiefel_l' };
/** Icon-Datei (Inventar) eines Teils */
export const armorIconFile = (idx: number, slot: ArmorSlot) => `ruestung_${String(idx).padStart(2, '0')}_${FILE_PART[slot]}`;
export const armorFile = (idx: number, part: 'kopf' | 'brust' | 'hose' | 'arm_l' | 'arm_r' | 'stiefel_l' | 'stiefel_r') => `ruestung_${String(idx).padStart(2, '0')}_${part}`;

// ---------------------------------------------------------------------------
// Freischaltung
// ---------------------------------------------------------------------------

export const START_SET = 0;
/** Ränge 2–10 schenken je ein Set */
export const RANK_SETS: Record<number, number> = { 2: 1, 3: 12, 4: 4, 5: 24, 6: 13, 7: 25, 8: 9, 9: 27, 10: 29 };
/** Feldzug-Bosse schenken ein Set (Boss-Sets gibt es nur so) */
export const BOSS_SETS: Record<string, number> = {
  gallia: 15, germania: 17, britannia: 16, hispania: 26, dacia: 22, africa: 33, aegyptus: 32,
  armenia: 31, parthia: 11, pannonia: 28, persia: 30, 'pons-milvius': 34, 'limes-1': 35,
};

/** Preis eines Teils im Markt (Denare) */
export function armorPrice(set: ArmorSet): number {
  if (set.cls === 'stoff') return 40 + set.tier * 8;
  if (set.cls === 'leder') return 100 + set.tier * 12;
  if (set.cls === 'schwer') return 200 + set.tier * 22;
  return 0;
}
export const armorPurchaseId = (itemId: string) => itemId; // gespeichert in settings.purchases

export interface ArmorContext {
  rankLevel: number;
  defeatedBossIds: string[];
  /** Beute aus Kämpfen (Item-IDs) */
  loot: string[];
  purchases: string[];
}

/** Woher ein Set (ganz) stammt – oder null. */
export function setSource(set: ArmorSet, ctx: ArmorContext): string | null {
  if (set.idx === START_SET) return 'Start-Ausrüstung';
  const rank = Object.entries(RANK_SETS).find(([, i]) => i === set.idx);
  if (rank && ctx.rankLevel >= Number(rank[0])) return `Rang ${rank[0]}`;
  const boss = Object.entries(BOSS_SETS).find(([, i]) => i === set.idx);
  if (boss && ctx.defeatedBossIds.includes(boss[0])) return 'Boss besiegt';
  return null;
}

export function ownsArmorPiece(itemId: string, ctx: ArmorContext): boolean {
  const p = parseArmorId(itemId);
  if (!p) return false;
  return !!setSource(p.set, ctx) || ctx.loot.includes(itemId) || ctx.purchases.includes(itemId);
}

/** Wie man ein Teil bekommt (für gesperrte Teile im Inventar). */
export function armorHint(set: ArmorSet, ctx: Pick<ArmorContext, 'rankLevel'>, rankName: (lvl: number) => string, bossName: (id: string) => string): string {
  const ways: string[] = [];
  const rank = Object.entries(RANK_SETS).find(([, i]) => i === set.idx);
  if (rank) ways.push(`Set ab Rang ${rankName(Number(rank[0]))}`);
  const boss = Object.entries(BOSS_SETS).find(([, i]) => i === set.idx);
  if (boss) ways.push(`Set für den Sieg über ${bossName(boss[0])}`);
  if (set.cls !== 'boss') {
    const min = ARMOR_CLASS_MIN_RANK[set.cls];
    ways.push(ctx.rankLevel >= min ? `Markt ${armorPrice(set)} Denare oder Beute` : `Markt/Beute ab Rang ${rankName(min)}`);
  }
  return ways.join(' · ');
}

// ---------------------------------------------------------------------------
// Beute nach Kämpfen
// ---------------------------------------------------------------------------

export const LOOT_CHANCE = 0.35;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Beute eines Kampfes – reproduzierbar aus dem Kampfschlüssel. Je Kampf 35 % Chance auf ein Teil,
 * je besiegtem Boss ein weiteres sicheres Teil. Nur Teile, die man noch nicht hat, aus Klassen, die der Rang erlaubt.
 */
export function rollLoot(key: string, kills: number, ctx: ArmorContext): string[] {
  const pool = ARMOR_SETS.filter((s) => s.cls !== 'boss' && ctx.rankLevel >= ARMOR_CLASS_MIN_RANK[s.cls])
    .flatMap((s) => ARMOR_SLOTS.map((slot) => armorItemId(s.idx, slot)))
    .filter((id) => !ownsArmorPiece(id, ctx));
  const out: string[] = [];
  const rolls = (hash(key) < LOOT_CHANCE ? 1 : 0) + kills;
  for (let i = 0; i < rolls && pool.length; i++) {
    const k = Math.floor(hash(`${key}#${i}`) * pool.length);
    out.push(pool.splice(k, 1)[0]!);
  }
  return out;
}

/** Komplettes Set angelegt? → Set-Bonus (Leuchten in Klassenfarbe) */
export function fullArmorSet(loadout: Partial<Record<string, string | null>>): ArmorSet | null {
  const ids = ARMOR_SLOTS.map((s) => loadout[s]);
  const first = ids[0] ? parseArmorId(ids[0]) : null;
  if (!first) return null;
  return ARMOR_SLOTS.every((s, i) => ids[i] === armorItemId(first.set.idx, s)) ? first.set : null;
}
