// Aussehen des Ganzkörper-Helden: Merkmal-Ebenen über dem Grundkörper und Ausrüstungs-Ebenen darüber.
// Alle Ebenen teilen dasselbe Raster (1024 × 1536, Kopfoberkante y ≈ 90, Kopfmitte x ≈ 511),
// die Köpfe der 12 Grundkörper liegen pixelgenau übereinander – eine Kopf-Ebene passt auf jeden Körper.
import { ITEMS, itemFile, type ItemDef } from './equipment';
import { RANKS, TIERS, TIER_LABEL, type BadgeStatus, type Tier } from './gamification';
import { CAMPAIGN, bossAt } from './rpg';

export type TraitCategory = 'hair' | 'beard' | 'scar' | 'paint' | 'eyes';

export const TRAIT_CATEGORIES: { id: TraitCategory; label: string; file: string; recolor: boolean; hint: string }[] = [
  { id: 'hair', label: 'Frisur', file: 'frisur', recolor: true, hint: 'nur die Haare, in neutralem hellem Grau mit Schattierung (Farbe kommt aus dem Code)' },
  { id: 'beard', label: 'Bart', file: 'bart', recolor: true, hint: 'nur der Bart, in neutralem hellem Grau mit Schattierung (Farbe kommt aus dem Code)' },
  { id: 'scar', label: 'Narbe', file: 'narbe', recolor: false, hint: 'nur die Narbe auf transparentem Grund, Hautton leicht heller/rötlicher als die Haut' },
  { id: 'paint', label: 'Kriegsbemalung', file: 'bemalung', recolor: false, hint: 'nur die Farbe auf dem Gesicht, mattes Pigment, Ränder leicht ausgefranst' },
  { id: 'eyes', label: 'Augen', file: 'augen', recolor: false, hint: 'nur das Accessoire mit Band/Bügel, so wie es auf dem Kopf sitzt' },
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
  // Noch nicht geliefert – erscheinen erst, wenn die Ebene da ist
  t('scar', 'auge', 'Narbe über dem Auge', START, 'senkrechte Narbe über das linke Auge (Braue bis Wange), Auge intakt'),
  t('scar', 'wange', 'Wangenschnitt', START, 'schräger Schnitt über die rechte Wange'),
  t('scar', 'nase', 'Nasenrücken', START, 'kurze quer verlaufende Narbe über den Nasenrücken'),
  t('paint', 'waid', 'Waid-Streifen', boss('britannia'), 'drei blaue Streifen quer über beide Wangen (britannisch)'),
  t('paint', 'blut', 'Blutbalken', badge('bosses', 'silver'), 'roter waagrechter Balken über die Augenpartie'),
  t('paint', 'gold', 'Goldlinien', rank(8), 'feine goldene Linien von der Stirn über die Wangen'),
  t('eyes', 'augenklappe', 'Augenklappe', badge('comeback'), 'schwarze Leder-Augenklappe über dem linken Auge mit Band um den Kopf'),
  t('eyes', 'brille', 'Brille', START, 'kleine runde Brille mit dünnem Metallrahmen'),
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
  return { hair: ok('hair', look?.hair), beard: ok('beard', look?.beard), hairColor, beardColor: look?.beardColor ? color(look.beardColor) : hairColor };
}

/** Alles, was über Bosse, Ränge und Abzeichen freigeschaltet ist (für „Neu“-Hinweise). */
export function unlockedLookKeys(ctx: UnlockContext, available: (tr: TraitDef) => boolean): string[] {
  return [
    ...TRAITS.filter((tr) => tr.unlock.kind !== 'start' && available(tr) && unlockStatus(tr.unlock, ctx).unlocked).map((tr) => `${tr.category}:${tr.id}`),
    ...HAIR_COLORS.filter((c) => c.unlock.kind !== 'start' && unlockStatus(c.unlock, ctx).unlocked).map((c) => `color:${c.id}`),
  ];
}

/** Belohnungen eines Bosses (für Kampf-Ergebnis und Feldzug-Karte). */
export function bossRewards(bossId: string, available: (tr: TraitDef) => boolean = () => true): string[] {
  return [
    ...TRAITS.filter((tr) => tr.unlock.kind === 'boss' && tr.unlock.bossId === bossId && available(tr)).map((tr) => `${TRAIT_CATEGORIES.find((c) => c.id === tr.category)!.label} „${tr.name}“`),
    ...HAIR_COLORS.filter((c) => c.unlock.kind === 'boss' && c.unlock.bossId === bossId).map((c) => `Farbe „${c.label}“`),
  ];
}

/** Kopfbedeckungen, unter denen die Frisur ausgeblendet wird (Kränze, Diademe und Kronen lassen sie sichtbar). */
const SHOWS_HAIR = new Set(['lorbeerkranz-triumphator', 'traubenkrone', 'diadem-zirkel']);
export const helmetHidesHair = (i: ItemDef) => i.slot === 'head' && !SHOWS_HAIR.has(i.id);

/** Ausrüstungs-Ebene auf der Figur (zusätzlich zum Item-Icon). */
export const figureFile = (i: ItemDef) => `${itemFile(i)}_figur`;
export const HEAD_ITEMS = ITEMS.filter((i) => i.slot === 'head');
