// Waffen: 12 Waffenarten in Stufen (Bilder aus den Waffen-Blättern) plus 10 Boss-Unikate.
// Stärke wächst mit der Qualitätsstufe q (0–9). Zugang wie bei der Rüstung: Start-Ausrüstung je Klasse,
// Markt nach Rang, Beute nach Regionsfenster, Abzeichen und Boss-Siege.
import type { HeroClassId } from './rpg';

export type WeaponArt = 'schwert' | 'dolch' | 'axt' | 'kolben' | 'saebel' | 'faust' | 'bogen' | 'streitaxt' | 'kriegshammer' | 'stangenwaffe' | 'schild' | 'buch';

export interface WeaponArtDef {
  id: WeaponArt;
  label: string;
  slot: 'main' | 'off';
  twoHanded: boolean;
  /** Angriffsfaktor (Haupthand) bzw. Abwehrfaktor (Nebenhand) */
  mult: number;
  names: string[];
}

export const WEAPON_ARTS: WeaponArtDef[] = [
  { id: 'schwert', label: 'Schwert', slot: 'main', twoHanded: false, mult: 1, names: ['Holzschwert', 'Eisenschwert', 'Legionärsschwert', 'Zenturionenklinge', 'Adlerschwert', 'Prätorianerklinge', 'Blutklinge', 'Feuerklinge', 'Kaiserklinge', 'Klinge des Imperators'] },
  { id: 'dolch', label: 'Dolch', slot: 'main', twoHanded: false, mult: 0.9, names: ['Eisendolch', 'Soldatendolch', 'Bronzedolch', 'Ährendolch', 'Rubindolch', 'Adlerdolch', 'Schattendolch', 'Runendolch', 'Glutdolch', 'Phönixdolch'] },
  { id: 'axt', label: 'Beil', slot: 'main', twoHanded: false, mult: 1.05, names: ['Holzfällerbeil', 'Kriegsbeil', 'Adlerbeil', 'Glutbeil', 'Phönixbeil'] },
  { id: 'kolben', label: 'Streitkolben', slot: 'main', twoHanded: false, mult: 1.05, names: ['Stachelkeule', 'Bronzekolben', 'Lorbeerkolben', 'Glutkolben', 'Phönixkolben'] },
  { id: 'saebel', label: 'Säbel', slot: 'main', twoHanded: false, mult: 1, names: ['Krummsäbel', 'Reitersäbel', 'Adlersäbel', 'Glutsäbel', 'Phönixsäbel'] },
  { id: 'faust', label: 'Kampffäuste', slot: 'main', twoHanded: true, mult: 1.3, names: ['Faustbinden', 'Lederfäuste', 'Eisenfäuste', 'Lorbeerfäuste', 'Adlerfäuste', 'Krallenfäuste', 'Glutfäuste', 'Klingenfäuste', 'Sonnenfäuste', 'Phönixfäuste'] },
  { id: 'bogen', label: 'Bogen', slot: 'main', twoHanded: true, mult: 1.3, names: ['Jagdbogen', 'Eisenbogen', 'Legionsbogen', 'Glutbogen', 'Phönixbogen'] },
  { id: 'streitaxt', label: 'Streitaxt', slot: 'main', twoHanded: true, mult: 1.4, names: ['Doppelaxt', 'Kriegsaxt', 'Adleraxt', 'Glutaxt', 'Phönixaxt'] },
  { id: 'kriegshammer', label: 'Kriegshammer', slot: 'main', twoHanded: true, mult: 1.45, names: ['Kriegskeule', 'Eisenhammer', 'Adlerhammer', 'Gluthammer', 'Phönixhammer'] },
  { id: 'stangenwaffe', label: 'Stangenwaffe', slot: 'main', twoHanded: true, mult: 1.35, names: ['Speer', 'Pilum', 'Lanze', 'Hellebarde', 'Adlerlanze', 'Sichelspeer', 'Dreispitz', 'Glutglefe', 'Klingenglefe', 'Phönixstandarte'] },
  { id: 'schild', label: 'Schild', slot: 'off', twoHanded: false, mult: 1, names: ['Holzschild', 'Beschlagener Schild', 'Hoplitenschild', 'Zenturionenschild', 'Adlerschild', 'Scutum', 'Prätorianerschild', 'Glutschild', 'Klingenschild', 'Schild des Imperators'] },
  { id: 'buch', label: 'Foliant', slot: 'off', twoHanded: false, mult: 0.6, names: ['Wanderbuch', 'Tempelbuch', 'Sternenfolio', 'Adlerfolio', 'Kettenfolio', 'Runenfolio', 'Kaiserfolio', 'Siegelfolio', 'Adlerkodex', 'Kodex des Lichts'] },
];

/** Qualitätsstufe je Bild: 10er-Reihen 0–9, 5er-Reihen verteilt auf 0, 2, 5, 7, 9 */
export const qualityOf = (count: number, k: number) => (count === 10 ? k : [0, 2, 5, 7, 9][k]!);

export interface BossWeaponDef {
  idx: number;
  name: string;
  /** Region, deren Boss die Waffe trägt */
  region: string;
  slot: 'main' | 'off';
  twoHanded: boolean;
  mult: number;
  q: number;
  motif: string;
}

export const BOSS_WEAPONS: BossWeaponDef[] = [
  { idx: 0, name: 'Klingenfächer der Pharaonin', region: 'sobekdelta', slot: 'main', twoHanded: false, mult: 1.15, q: 7, motif: 'Fächer' },
  { idx: 1, name: 'Kettensichel von Numantia', region: 'hirtenland', slot: 'main', twoHanded: false, mult: 1.15, q: 5, motif: 'Kettensichel' },
  { idx: 2, name: 'Löwenkreis', region: 'loewensteppe', slot: 'main', twoHanded: false, mult: 1.15, q: 6, motif: 'Chakram' },
  { idx: 3, name: 'Zepter des Palatiums', region: 'kaiserstadt', slot: 'main', twoHanded: true, mult: 1.55, q: 9, motif: 'Ringstab' },
  { idx: 4, name: 'Horn des Etzel', region: 'hunnensteppe', slot: 'off', twoHanded: false, mult: 1.2, q: 9, motif: 'Kriegshorn' },
  { idx: 5, name: 'Parthische Armbrust', region: 'reiterwueste', slot: 'main', twoHanded: true, mult: 1.5, q: 8, motif: 'Armbrust' },
  { idx: 6, name: 'Nebelklingen', region: 'nebelinseln', slot: 'main', twoHanded: false, mult: 1.15, q: 4, motif: 'Wurfklingen' },
  { idx: 7, name: 'Adlerflegel von Artaxata', region: 'gipfelreich', slot: 'main', twoHanded: false, mult: 1.2, q: 7, motif: 'Flegel' },
  { idx: 8, name: 'Falx der Drachenberge', region: 'drachenberge', slot: 'main', twoHanded: true, mult: 1.5, q: 5, motif: 'Doppelsichel' },
  { idx: 9, name: 'Siegel der Könige', region: 'koenigsthron', slot: 'off', twoHanded: false, mult: 1.25, q: 9, motif: 'Talisman' },
];

export interface WeaponInfo {
  id: string;
  name: string;
  art: WeaponArt | 'boss';
  /** Bildnummer innerhalb der Reihe */
  k: number;
  q: number;
  slot: 'main' | 'off';
  twoHanded: boolean;
  mult: number;
  file: string;
  boss?: BossWeaponDef;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const weaponId = (art: WeaponArt | 'boss', k: number) => `waffe-${art}-${pad(k)}`;

export const WEAPONS: WeaponInfo[] = [
  ...WEAPON_ARTS.flatMap((a) =>
    a.names.map((name, k): WeaponInfo => ({
      id: weaponId(a.id, k),
      name,
      art: a.id,
      k,
      q: qualityOf(a.names.length, k),
      slot: a.slot,
      twoHanded: a.twoHanded,
      mult: a.mult,
      file: a.id === 'faust' ? `waffe_faust_${pad(k)}_R` : `waffe_${a.id}_${pad(k)}`,
    })),
  ),
  ...BOSS_WEAPONS.map((b): WeaponInfo => ({ id: weaponId('boss', b.idx), name: b.name, art: 'boss', k: b.idx, q: b.q, slot: b.slot, twoHanded: b.twoHanded, mult: b.mult, file: `waffe_bosswaffe_${pad(b.idx)}`, boss: b })),
];
const BY_ID = new Map(WEAPONS.map((w) => [w.id, w]));
export const weaponById = (id: string | null | undefined) => (id ? BY_ID.get(id) : undefined);
export const artById = (art: WeaponInfo['art']) => WEAPON_ARTS.find((a) => a.id === art);

/** Start-Waffen je Klasse (Stufe I) */
export const START_WEAPONS: Record<HeroClassId, { main: string; off?: string }> = {
  legionar: { main: weaponId('schwert', 0), off: weaponId('schild', 0) },
  gladiator: { main: weaponId('stangenwaffe', 0) },
  cursor: { main: weaponId('dolch', 0), off: weaponId('buch', 0) },
  strategos: { main: weaponId('kolben', 0), off: weaponId('buch', 0) },
};

/** Abzeichen → Waffe je Stufe (Bronze, Silber, Gold) */
export const BADGE_WEAPONS: Record<string, [string, string, string]> = {
  prs: [weaponId('schwert', 2), weaponId('schwert', 5), weaponId('schwert', 8)],
  volume: [weaponId('kriegshammer', 1), weaponId('kriegshammer', 2), weaponId('kriegshammer', 3)],
  logstreak: [weaponId('buch', 2), weaponId('buch', 5), weaponId('buch', 8)],
  recipes: [weaponId('kolben', 1), weaponId('kolben', 2), weaponId('kolben', 3)],
  workouts: [weaponId('schild', 2), weaponId('schild', 5), weaponId('schild', 8)],
  water: [weaponId('bogen', 1), weaponId('bogen', 2), weaponId('bogen', 3)],
  mealhits: [weaponId('dolch', 2), weaponId('dolch', 5), weaponId('dolch', 8)],
  comeback: [weaponId('streitaxt', 1), weaponId('streitaxt', 2), weaponId('streitaxt', 3)],
  studio: [weaponId('faust', 2), weaponId('faust', 5), weaponId('faust', 8)],
};

// ---------------------------------------------------------------------------
// Werte, Markt, Beute
// ---------------------------------------------------------------------------

/** Angriff einer Haupthandwaffe bzw. Abwehr einer Nebenhand */
export function weaponStats(w: WeaponInfo): { atk?: number; def?: number } {
  if (w.slot === 'main') return { atk: Math.round((5 + 2.2 * w.q) * w.mult) };
  if (w.art === 'buch') return { atk: Math.round(1.5 + 0.8 * w.q), def: Math.round((4 + 1.3 * w.q) * w.mult) };
  if (w.boss) return { atk: Math.round(1 + 0.6 * w.q), def: Math.round((4 + 1.3 * w.q) * w.mult) };
  return { def: Math.round((4 + 1.3 * w.q) * w.mult) };
}

/** Seltenheit aus der Qualität (Rahmenfarbe im Inventar) */
export const weaponRarity = (w: WeaponInfo) => (w.boss || w.q >= 9 ? 'legendary' : w.q >= 6 ? 'epic' : w.q >= 3 ? 'rare' : 'common');

/** Im Markt bis zu dieser Qualität käuflich: Rang 1 → I, Rang 3 → II, Rang 5 → III, Rang 7 → IV, Rang 9 → V */
export const shopMaxQuality = (rankLevel: number) => Math.floor((rankLevel - 1) / 2);
export const minRankForQuality = (q: number) => 2 * q + 1;
export const weaponPrice = (w: WeaponInfo) => Math.round((30 + 22 * w.q) * (w.twoHanded ? 1.4 : 1));
export const isBuyable = (w: WeaponInfo) => !w.boss && w.q <= shopMaxQuality(10);

/** Beutefenster der Waffen je Region (Qualität von–bis); die obere Grenze ist selten (Elite, Truhe, Boss). */
export const WEAPON_WINDOWS: [number, number][] = [
  [0, 2], [1, 3], [1, 3], [2, 4], [3, 5], [4, 6], [4, 6], [5, 7], [6, 8], [6, 8], [7, 9], [8, 9],
];
export function weaponLootIds(regionIdx: number, source: 'gegner' | 'elite' | 'truhe' | 'boss'): string[] {
  const [from, to] = WEAPON_WINDOWS[Math.max(0, Math.min(WEAPON_WINDOWS.length - 1, regionIdx))]!;
  const top = source === 'gegner' ? to - 1 : to;
  return WEAPONS.filter((w) => !w.boss && w.q >= from && w.q <= top).map((w) => w.id);
}
/** Erste Region, in der eine Qualität als Beute fallen kann */
export const firstLootRegion = (q: number) => WEAPON_WINDOWS.findIndex(([, to]) => q <= to);

export interface WeaponContext {
  classId?: HeroClassId;
  purchases: string[];
  loot: string[];
  defeatedBossIds: string[];
  /** Abzeichen-ID → erreichte Stufe 0–3 */
  badgeTiers: Record<string, number>;
  /** Boss-ID der Region */
  bossOfRegion: (regionId: string) => string;
}

export function ownsWeapon(w: WeaponInfo, c: WeaponContext): boolean {
  if (c.classId) {
    const st = START_WEAPONS[c.classId];
    if (st.main === w.id || st.off === w.id) return true;
  }
  if (c.purchases.includes(w.id) || c.loot.includes(w.id)) return true;
  if (w.boss && c.defeatedBossIds.includes(c.bossOfRegion(w.boss.region))) return true;
  for (const [badge, ids] of Object.entries(BADGE_WEAPONS)) {
    const t = c.badgeTiers[badge] ?? 0;
    if (ids.slice(0, t).includes(w.id)) return true;
  }
  return false;
}

/** Würfelt eine Waffe aus dem Fenster (deterministisch über `roll` ∈ [0,1)), ohne Besessenes. */
export function pickWeapon(ids: string[], c: WeaponContext, roll: number): string | null {
  const pool = ids.filter((id) => !ownsWeapon(weaponById(id)!, c));
  return pool.length ? pool[Math.floor(roll * pool.length)]! : null;
}

/** Klartext fürs Kartenblatt, z. B. „Waffen I–III“ */
export function weaponLootLabel(regionIdx: number): string {
  const R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const [a, b] = WEAPON_WINDOWS[Math.max(0, Math.min(WEAPON_WINDOWS.length - 1, regionIdx))]!;
  return `Waffen ${R[a]}–${R[b]}`;
}
