// Aussehen des Ganzkörper-Helden: Merkmal-Ebenen über dem Grundkörper und Ausrüstungs-Ebenen darüber.
// Alle Ebenen teilen dasselbe Raster (1024 × 1536, Kopfoberkante y ≈ 90, Kopfmitte x ≈ 511),
// die Köpfe der 12 Grundkörper liegen pixelgenau übereinander – eine Kopf-Ebene passt auf jeden Körper.
import { ARMOR_SETS, BOSS_SETS } from './armor';
import { RANKS, TIERS, TIER_LABEL, type BadgeStatus, type Tier } from './gamification';
import { CAMPAIGN, bossAt } from './rpg';

export type TraitCategory = 'hair' | 'beard' | 'scar' | 'tattoo' | 'eyes';

export const TRAIT_CATEGORIES: { id: TraitCategory; label: string; file: string; recolor: boolean; hint: string }[] = [
  { id: 'hair', label: 'Frisur', file: 'frisur', recolor: true, hint: 'nur die Haare, in neutralem hellem Grau mit Schattierung (Farbe kommt aus dem Code)' },
  { id: 'beard', label: 'Bart', file: 'bart', recolor: true, hint: 'nur der Bart, in neutralem hellem Grau mit Schattierung (Farbe kommt aus dem Code)' },
  { id: 'scar', label: 'Narbe', file: 'narbe', recolor: false, hint: 'nur die Narbe auf transparentem Grund' },
  { id: 'tattoo', label: 'Tattoo', file: 'tattoo', recolor: false, hint: 'Ganzkörper-Tattoo im Schablonen-Raster' },
  { id: 'eyes', label: 'Brille & Augenklappe', file: 'augen', recolor: false, hint: 'nur das Accessoire mit Band/Bügel, so wie es auf dem Kopf sitzt' },
];

export type Unlock =
  | { kind: 'start' }
  | { kind: 'boss'; bossId: string }
  | { kind: 'rank'; level: number }
  | { kind: 'badge'; badgeId: string; tier: Tier };

export interface TraitDef {
  id: string;
  category: TraitCategory;
  name: string;
  /** Bildbeschreibung fürs Briefing (nur für noch fehlende Ebenen nötig) */
  motif?: string;
  unlock: Unlock;
}

const START: Unlock = { kind: 'start' };
const boss = (bossId: string): Unlock => ({ kind: 'boss', bossId });
const rank = (level: number): Unlock => ({ kind: 'rank', level });
const badge = (badgeId: string, tier: Tier = 'bronze'): Unlock => ({ kind: 'badge', badgeId, tier });
const t = (category: TraitCategory, id: string, name: string, unlock: Unlock, motif?: string): TraitDef => ({ id, category, name, unlock, motif });

export const TRAITS: TraitDef[] = [
  // Frisuren – 5 zum Start, Rest über Bosse, Ränge und Abzeichen
  t('hair', 'kurz', 'Legionärsschnitt', START),
  t('hair', 'scheitel', 'Seitenscheitel', START),
  t('hair', 'rekrut', 'Rekrutenschnitt', START),
  t('hair', 'zurueck', 'Zurückgekämmt', START),
  t('hair', 'locken', 'Krause Locken', START),
  t('hair', 'wellenmaehne', 'Wellenmähne', boss('gallia')),
  t('hair', 'seitenzopf', 'Suebenzopf', boss('germania')),
  t('hair', 'flechtkrone', 'Flechtkrone', boss('britannia')),
  t('hair', 'sturm', 'Sturmfrisur', boss('hispania')),
  t('hair', 'lang', 'Lang und offen', boss('dacia')),
  t('hair', 'wildlocken', 'Wilde Locken', boss('africa')),
  t('hair', 'kamm', 'Kamm', boss('aegyptus')),
  t('hair', 'barbarendutt', 'Barbarendutt', boss('armenia')),
  t('hair', 'wellen', 'Lange Wellen', boss('parthia')),
  t('hair', 'tolle', 'Rebellentolle', boss('pannonia')),
  t('hair', 'sturmscheitel', 'Sturmscheitel', boss('persia')),
  t('hair', 'windschnitt', 'Windschnitt', boss('pons-milvius')),
  t('hair', 'wolfsmaehne', 'Wolfsmähne', boss('limes-1')),
  t('hair', 'undercut', 'Seiten rasiert', rank(2)),
  t('hair', 'nackenzopf', 'Nackenzopf', rank(4)),
  t('hair', 'kasten', 'Kastenschnitt', badge('workouts', 'silver')),
  t('hair', 'dutt', 'Kriegerdutt', badge('trainstreak')),
  t('hair', 'struwwel', 'Struwwelkopf', badge('prs', 'silver')),
  t('hair', 'zoepfe', 'Gladiatorenzöpfe', badge('colosseum')),
  // Bärte
  t('beard', 'dreitage', 'Dreitagebart', START),
  t('beard', 'kinnriemen', 'Kinnriemen', START),
  t('beard', 'vollbart', 'Vollbart', START),
  t('beard', 'kinnbart', 'Spitzer Kinnbart', START),
  t('beard', 'schnauzerbart', 'Schnauzer mit Bart', START),
  t('beard', 'zwirbel', 'Gallischer Zwirbel', boss('gallia')),
  t('beard', 'rauschebart', 'Rauschebart', boss('germania')),
  t('beard', 'zopfschnauzer', 'Zopfschnauzer', boss('britannia')),
  t('beard', 'kinnriemen-dicht', 'Dichter Kinnriemen', boss('hispania')),
  t('beard', 'wildbart', 'Wildbart', boss('dacia')),
  t('beard', 'backenbart', 'Backenbart', boss('africa')),
  t('beard', 'zwirbelzopf', 'Pharaonenzopf', boss('aegyptus')),
  t('beard', 'kriegsbart', 'Kriegsbart', boss('armenia')),
  t('beard', 'spitzbart', 'Langer Spitzbart', boss('parthia')),
  t('beard', 'zwirbelring', 'Zwirbel mit Ring', boss('pannonia')),
  t('beard', 'koenigsbart', 'Bart der Könige', boss('persia')),
  t('beard', 'zwirbelspitz', 'Zwirbel mit Spitz', boss('pons-milvius')),
  t('beard', 'dreizopf', 'Dreizopf', boss('limes-1')),
  t('beard', 'flaum', 'Flaum', rank(2)),
  t('beard', 'ringzoepfe', 'Ringzöpfe', rank(6)),
  t('beard', 'perlenbart', 'Perlenbart', rank(9)),
  t('beard', 'zopfbart', 'Zopfbart', badge('volume', 'silver')),
  t('beard', 'doppelzopf', 'Doppelzopf', badge('quests', 'silver')),
  t('hair', 'zerzaust', 'Zerzaust', badge('recipes')),
  t('hair', 'fransen', 'Fransen', badge('water')),
  t('hair', 'wuschel', 'Wuschelkopf', badge('protein')),
  // Tattoos – 2 zum Start, je Boss eines
  t('tattoo', 'blutstreifen', 'Blutstreifen', START),
  t('tattoo', 'kampfbaender', 'Kampfbänder', START),
  t('tattoo', 'runen', 'Kriegsrunen', boss('gallia')),
  t('tattoo', 'dornen', 'Dornenranken', boss('germania')),
  t('tattoo', 'flammen', 'Flammen', boss('britannia')),
  t('tattoo', 'saeule', 'Säulen des Herkules', boss('hispania')),
  t('tattoo', 'schlange', 'Drache der Daker', boss('dacia')),
  t('tattoo', 'loewe', 'Löwe', boss('africa')),
  t('tattoo', 'sol', 'Sol Invictus', boss('aegyptus')),
  t('tattoo', 'nordstern', 'Nordstern', boss('armenia')),
  t('tattoo', 'lichtadern', 'Lichtadern', boss('parthia')),
  t('tattoo', 'glutadern', 'Glutadern', boss('pannonia')),
  t('tattoo', 'lorbeer', 'Lorbeerranken', boss('persia')),
  t('tattoo', 'adler', 'Adler', boss('pons-milvius')),
  t('tattoo', 'zenturio', 'Zenturio', boss('limes-1')),
  // Narben – 3 zum Start, Rest über Ränge und Abzeichen
  t('scar', 'auge', 'Narbe über dem Auge', START),
  t('scar', 'wange', 'Wangenschnitt', START),
  t('scar', 'langer-schnitt', 'Langer Schnitt', START),
  t('scar', 'unterarm', 'Unterarmschnitte', rank(2)),
  t('scar', 'vierfachhieb', 'Vierfachhieb', rank(4)),
  t('scar', 'brustnaht', 'Brustnaht', rank(6)),
  t('scar', 'greifenkrallen', 'Greifenkrallen', rank(9)),
  t('scar', 'kratzer', 'Kratzer', badge('workouts')),
  t('scar', 'hiebe', 'Hiebe', badge('prs')),
  t('scar', 'schenkelhieb', 'Schenkelhieb', badge('cardio', 'silver')),
  t('scar', 'doppelnaht', 'Doppelnaht', badge('trainstreak', 'silver')),
  t('scar', 'brand', 'Brandnarbe', badge('comeback')),
  t('scar', 'baerenkralle', 'Bärenkralle', badge('colosseum')),
  t('scar', 'schulterkralle', 'Schulterkralle', badge('duels')),
  t('scar', 'blitz', 'Blitznarbe', badge('mastery')),
  // Brillen & Augenklappen – 3 zum Start
  t('eyes', 'drahtbrille', 'Drahtbrille', START),
  t('eyes', 'rundbrille', 'Rundbrille', START),
  t('eyes', 'augenklappe', 'Augenklappe', START),
  t('eyes', 'hornbrille', 'Hornbrille', rank(3)),
  t('eyes', 'lederklappe', 'Lederklappe', rank(5)),
  t('eyes', 'monokel', 'Monokel', rank(7)),
  t('eyes', 'kaisermaske', 'Kaisermaske', rank(10)),
  t('eyes', 'pilotenbrille', 'Pilotenbrille', badge('cardio')),
  t('eyes', 'schutzbrille', 'Schutzbrille', badge('volume')),
  t('eyes', 'schildklappe', 'Schildklappe', badge('duels', 'silver')),
  t('eyes', 'uhrwerkklappe', 'Uhrwerk-Klappe', badge('mastery', 'silver')),
  t('eyes', 'visier', 'Rotes Visier', badge('bosses', 'gold')),
];

export const traitFile = (tr: TraitDef) => `${TRAIT_CATEGORIES.find((c) => c.id === tr.category)!.file}_${tr.id}`;
export const traitById = (category: TraitCategory, id: string | null | undefined) => (id ? TRAITS.find((x) => x.category === category && x.id === id) : undefined);

export interface HairColor {
  id: string;
  label: string;
  hex: string;
  unlock: Unlock;
}
/** Haar- und Bartfarben (die grauen Ebenen werden per Verlaufsabbildung eingefärbt). Zum Start nur gedeckte Töne. */
export const HAIR_COLORS: HairColor[] = [
  { id: 'schwarz', label: 'Schwarz', hex: '#2a2420', unlock: START },
  { id: 'dunkelbraun', label: 'Dunkelbraun', hex: '#4a3424', unlock: START },
  { id: 'braun', label: 'Braun', hex: '#6e4c30', unlock: START },
  { id: 'hellbraun', label: 'Hellbraun', hex: '#94683f', unlock: START },
  { id: 'dunkelblond', label: 'Dunkelblond', hex: '#a8814f', unlock: START },
  { id: 'kupfer', label: 'Kupfer', hex: '#9a4f26', unlock: boss('gallia') },
  { id: 'waidblau', label: 'Waidblau', hex: '#2c3f6e', unlock: boss('britannia') },
  { id: 'rot', label: 'Rot', hex: '#8a2f1c', unlock: rank(3) },
  { id: 'blond', label: 'Blond', hex: '#c9a868', unlock: badge('logstreak', 'silver') },
  { id: 'grau', label: 'Grau', hex: '#86817a', unlock: rank(5) },
  { id: 'weiss', label: 'Weiß', hex: '#cfcac2', unlock: rank(8) },
  { id: 'platin', label: 'Platin', hex: '#ece0bd', unlock: badge('colosseum', 'silver') },
  { id: 'gold', label: 'Gold', hex: '#c8952e', unlock: badge('seasons') },
  { id: 'purpur', label: 'Kaiserpurpur', hex: '#5a1f4e', unlock: rank(10) },
];
export const DEFAULT_HAIR_COLOR = 'dunkelbraun';

/** Rüstungsfarben (färben den roten/purpurnen Stoff der Rüstung). „Original“ = ungefärbt. */
export const ARMOR_COLORS: HairColor[] = [
  { id: 'nachtblau', label: 'Nachtblau', hex: '#24365e', unlock: START },
  { id: 'rabenschwarz', label: 'Rabenschwarz', hex: '#2a2628', unlock: START },
  { id: 'waldgruen', label: 'Waldgrün', hex: '#2f5a34', unlock: rank(3) },
  { id: 'elfenbein', label: 'Elfenbein', hex: '#d8ccb0', unlock: badge('workouts', 'silver') },
  { id: 'himmelblau', label: 'Himmelblau', hex: '#4f86c0', unlock: badge('water', 'silver') },
  { id: 'smaragd', label: 'Smaragd', hex: '#1f7a5c', unlock: boss('germania') },
  { id: 'kupferrot', label: 'Kupferrot', hex: '#a3502a', unlock: boss('hispania') },
  { id: 'kaiserpurpur', label: 'Kaiserpurpur', hex: '#5b1f55', unlock: rank(6) },
  { id: 'koenigsblau', label: 'Königsblau', hex: '#2b3f9e', unlock: boss('persia') },
  { id: 'sonnengold', label: 'Sonnengold', hex: '#a8812f', unlock: rank(9) },
  { id: 'blutrot', label: 'Blutrot', hex: '#7e1414', unlock: badge('prs', 'gold') },
];
export const armorColorById = (id: string | null | undefined) => (id ? ARMOR_COLORS.find((c) => c.id === id) : undefined);

/** Verlaufsstufen (dunkel → Farbton → Glanz) für die SVG-Einfärbung. */
export function tintStops(hex: string): [number, number, number][] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const dark = lum > 0.6 ? 0.45 : 0.22;
  const mix = (a: number[], b: number[], f: number) => a.map((v, i) => v + (b[i]! - v) * f) as [number, number, number];
  return [c.map((v) => v * dark) as [number, number, number], mix(c.map((v) => v * 0.6), c, 0.5), c, mix(c, [1, 1, 1], 0.45)];
}

// ---------------------------------------------------------------------------
// Freischaltung
// ---------------------------------------------------------------------------

export interface UnlockContext {
  defeatedBossIds: string[];
  rankLevel: number;
  badges: Pick<BadgeStatus, 'id' | 'name' | 'tier'>[];
}

export function unlockStatus(u: Unlock, ctx: UnlockContext): { unlocked: boolean; hint: string } {
  if (u.kind === 'start') return { unlocked: true, hint: 'Von Anfang an' };
  if (u.kind === 'boss') {
    const b = u.bossId.startsWith('limes') ? bossAt(CAMPAIGN.length) : CAMPAIGN.find((x) => x.id === u.bossId)!;
    return { unlocked: ctx.defeatedBossIds.includes(u.bossId), hint: `Besiege ${b.name} (${b.province})` };
  }
  if (u.kind === 'rank') return { unlocked: ctx.rankLevel >= u.level, hint: `Ab Rang ${RANKS[u.level - 1]?.name ?? u.level}` };
  const b = ctx.badges.find((x) => x.id === u.badgeId);
  const have = b?.tier ? TIERS.indexOf(b.tier) >= TIERS.indexOf(u.tier) : false;
  return { unlocked: have, hint: `Abzeichen ${b?.name ?? u.badgeId} ${TIER_LABEL[u.tier]}` };
}

export interface HeroLook {
  hair?: string | null;
  beard?: string | null;
  scar?: string | null;
  tattoo?: string | null;
  eyes?: string | null;
  hairColor?: string;
  beardColor?: string;
}

/** Nur freigeschaltete Merkmale und Farben bleiben aktiv. */
export function normalizeLook(look: HeroLook | undefined, ctx: UnlockContext): Required<HeroLook> {
  const ok = (cat: TraitCategory, id: string | null | undefined) => {
    const tr = traitById(cat, id);
    return tr && unlockStatus(tr.unlock, ctx).unlocked ? tr.id : null;
  };
  const color = (id: string | undefined) => {
    const c = HAIR_COLORS.find((x) => x.id === id);
    return c && unlockStatus(c.unlock, ctx).unlocked ? c.id : DEFAULT_HAIR_COLOR;
  };
  const hairColor = color(look?.hairColor);
  return { hair: ok('hair', look?.hair), beard: ok('beard', look?.beard), scar: ok('scar', look?.scar), tattoo: ok('tattoo', look?.tattoo), eyes: ok('eyes', look?.eyes), hairColor, beardColor: look?.beardColor ? color(look.beardColor) : hairColor };
}

/** Alles, was über Bosse, Ränge und Abzeichen freigeschaltet ist (für „Neu“-Hinweise). */
export function unlockedLookKeys(ctx: UnlockContext, available: (tr: TraitDef) => boolean): string[] {
  return [
    ...TRAITS.filter((tr) => tr.unlock.kind !== 'start' && available(tr) && unlockStatus(tr.unlock, ctx).unlocked).map((tr) => `${tr.category}:${tr.id}`),
    ...HAIR_COLORS.filter((c) => c.unlock.kind !== 'start' && unlockStatus(c.unlock, ctx).unlocked).map((c) => `color:${c.id}`),
    ...ARMOR_COLORS.filter((c) => c.unlock.kind !== 'start' && unlockStatus(c.unlock, ctx).unlocked).map((c) => `armorcolor:${c.id}`),
  ];
}

/** Belohnungen eines Bosses (für Kampf-Ergebnis und Feldzug-Karte). */
export function bossRewards(bossId: string, available: (tr: TraitDef) => boolean = () => true): string[] {
  return [
    ...TRAITS.filter((tr) => tr.unlock.kind === 'boss' && tr.unlock.bossId === bossId && available(tr)).map((tr) => `${TRAIT_CATEGORIES.find((c) => c.id === tr.category)!.label} „${tr.name}“`),
    ...HAIR_COLORS.filter((c) => c.unlock.kind === 'boss' && c.unlock.bossId === bossId).map((c) => `Farbe „${c.label}“`),
    ...ARMOR_COLORS.filter((c) => c.unlock.kind === 'boss' && c.unlock.bossId === bossId).map((c) => `Rüstungsfarbe „${c.label}“`),
    ...(BOSS_SETS[bossId] != null ? [`Rüstung „${ARMOR_SETS[BOSS_SETS[bossId]!]!.name}“`] : []),
  ];
}

// ---------------------------------------------------------------------------
// Lage von Tattoos und Narben auf dem Körper
// ---------------------------------------------------------------------------

/** Bereiche des Tattoo-Schablonenrahmens (Anteile 0..1: x0, y0, x1, y1) – je Bereich auf den Körperbereich gelegt. */
export const TATTOO_TEMPLATE: Record<'torso' | 'armL' | 'armR' | 'legL' | 'legR', [number, number, number, number]> = {
  torso: [0.25, 0, 0.75, 0.5],
  armL: [0, 0, 0.25, 0.8],
  armR: [0.75, 0, 1, 0.8],
  legL: [0.25, 0.5, 0.5, 1],
  legR: [0.5, 0.5, 0.75, 1],
};

/** Gesicht im 2:3-Kasten (bei allen Körpern gleich): [links %, oben %, Breite %, Höhe %] */
export const FACE_BOX: [number, number, number, number] = [44.79, 8.25, 10.42, 9.11];

/** Wo jede Narbe sitzt: Bereich, Mittelpunkt (u, v als Anteil des Bereichs), Breite als Anteil der Bereichsbreite. */
export const SCAR_PLACE: Record<string, { part: 'face' | keyof typeof TATTOO_TEMPLATE; u: number; v: number; w: number }> = {
  auge: { part: 'face', u: 0.22, v: 0.37, w: 0.09 },
  wange: { part: 'face', u: 0.24, v: 0.6, w: 0.3 },
  kratzer: { part: 'face', u: 0.77, v: 0.6, w: 0.28 },
  'langer-schnitt': { part: 'torso', u: 0.5, v: 0.55, w: 0.85 },
  brustnaht: { part: 'torso', u: 0.45, v: 0.45, w: 0.7 },
  baerenkralle: { part: 'torso', u: 0.64, v: 0.35, w: 0.42 },
  hiebe: { part: 'torso', u: 0.4, v: 0.78, w: 0.42 },
  vierfachhieb: { part: 'torso', u: 0.32, v: 0.5, w: 0.38 },
  greifenkrallen: { part: 'torso', u: 0.5, v: 0.12, w: 1.15 },
  blitz: { part: 'armR', u: 0.5, v: 0.33, w: 0.5 },
  brand: { part: 'armL', u: 0.45, v: 0.55, w: 0.75 },
  unterarm: { part: 'armR', u: 0.55, v: 0.65, w: 0.6 },
  schulterkralle: { part: 'armL', u: 0.6, v: 0.24, w: 0.8 },
  schenkelhieb: { part: 'legL', u: 0.5, v: 0.36, w: 0.75 },
  doppelnaht: { part: 'legR', u: 0.5, v: 0.36, w: 0.8 },
};
