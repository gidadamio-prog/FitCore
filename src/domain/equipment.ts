// Ausrüstung: Slots, Gegenstände (Waffen und Rüstung), Seltenheit, Zweihand-Regel und Erscheinungsbild.
import type { BadgeStatus } from './gamification';
import type { HeroClassId } from './rpg';
import { CAMPAIGN } from './rpg';
import { BADGE_WEAPONS, START_WEAPONS, WEAPONS, firstLootRegion, isBuyable, minRankForQuality, ownsWeapon, weaponById, weaponPrice, weaponRarity, type WeaponContext } from './weapons';
import { REGIONS } from './world';
import { effectiveLists } from './forge';
import { ARMOR_CLASS_RARITY, ARMOR_SETS, ARMOR_SLOTS, START_SET, armorHint, armorIconFile, armorItemId, armorPieceName, ownsArmorPiece, parseArmorId, type ArmorContext } from './armor';

export type SlotId = 'main' | 'off' | 'head' | 'chest' | 'hands' | 'legs' | 'feet';
export const SLOTS: { id: SlotId; label: string; file: string }[] = [
  { id: 'main', label: 'Haupthand', file: 'haupthand' },
  { id: 'off', label: 'Nebenhand', file: 'nebenhand' },
  { id: 'head', label: 'Kopf', file: 'kopf' },
  { id: 'chest', label: 'Brust', file: 'brust' },
  { id: 'hands', label: 'Arme', file: 'arme' },
  { id: 'legs', label: 'Hose', file: 'hose' },
  { id: 'feet', label: 'Stiefel', file: 'stiefel' },
];
export const slotLabel = (s: SlotId) => SLOTS.find((x) => x.id === s)!.label;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär' };
export const RARITY_COLOR: Record<Rarity, string> = { common: '#9a9a9a', rare: '#3b8fe0', epic: '#a35bea', legendary: '#f08a24' };
/** Mindestrang (1–10), ab dem eine Seltenheit getragen werden darf */
export const RARITY_MIN_RANK: Record<Rarity, number> = { common: 1, rare: 1, epic: 5, legendary: 7 };

export type ItemCategory = 'kraft' | 'ausdauer' | 'ernaehrung' | 'disziplin' | 'ruhm';
export const CATEGORY_LABEL: Record<ItemCategory, string> = { kraft: 'Kraft', ausdauer: 'Ausdauer', ernaehrung: 'Ernährung', disziplin: 'Disziplin', ruhm: 'Ruhm' };
export const CATEGORY_AURA: Record<ItemCategory, string> = { kraft: '#e0462f', ausdauer: '#34b4d9', ernaehrung: '#6cc04a', disziplin: '#d9b44a', ruhm: '#b05be0' };

export type EffectId =
  | 'sparks' | 'quake' | 'ink' | 'steam' | 'shine' | 'water' | 'balance' | 'fire' | 'spin' | 'plume' | 'leaves' | 'grapes' | 'orbit'
  | 'powder' | 'sand' | 'chalk' | 'tape' | 'crests' | 'trail' | 'stomp' | 'shadow';

export interface ItemDef {
  id: string;
  name: string;
  slot: SlotId;
  twoHanded?: boolean;
  /** Bildmotiv für das Grafik-Briefing */
  motif: string;
  source: { kind: 'weapon'; weaponId: string } | { kind: 'armor'; setIdx: number };
  /** eigene Icon-Datei (Rüstungsteile nutzen ihre Figur-Ebene) */
  icon?: string;
  category?: ItemCategory;
  effect?: EffectId;
  effectText?: string;
}

/** Waffen aus den Waffen-Blättern (12 Arten in Stufen + 10 Boss-Unikate) */
const WEAPON_ITEMS: ItemDef[] = WEAPONS.map((w) => ({ id: w.id, name: w.name, slot: w.slot, twoHanded: w.twoHanded, motif: '', source: { kind: 'weapon', weaponId: w.id }, icon: w.file }));
/** Rüstungsteile aus den 36 Sets */
const ARMOR_ITEMS: ItemDef[] = ARMOR_SETS.flatMap((set) =>
  ARMOR_SLOTS.map((slot): ItemDef => ({ id: armorItemId(set.idx, slot), name: armorPieceName(set, slot), slot, motif: '', source: { kind: 'armor', setIdx: set.idx }, icon: armorIconFile(set.idx, slot) })),
);
export const ITEMS: ItemDef[] = [...WEAPON_ITEMS, ...ARMOR_ITEMS];
const ITEM_MAP = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id: string | null | undefined) => (id ? ITEM_MAP.get(id) : undefined);
export const itemFile = (i: ItemDef) => i.icon ?? `${SLOTS.find((s) => s.id === i.slot)!.file}_${i.id}`;
/** Abzeichen → freigeschaltete Waffen (bis zur erreichten Stufe) */
export const badgeTiers = (badges: BadgeStatus[]) => Object.fromEntries(badges.map((b) => [b.id, b.tier ? ['bronze', 'silver', 'gold'].indexOf(b.tier) + 1 : 0]));
export const badgeWeaponIds = (badges: BadgeStatus[]) => {
  const t = badgeTiers(badges);
  return Object.entries(BADGE_WEAPONS).flatMap(([id, ws]) => ws.slice(0, t[id] ?? 0));
};
export const bossOfRegionId = (regionId: string) => REGIONS.find((r) => r.id === regionId)?.bossId ?? regionId;

export interface OwnedItem {
  def: ItemDef;
  /** freigeschaltete Seltenheit (null = gesperrt) */
  unlocked: Rarity | null;
  /** Seltenheit, mit der das Teil bei deinem Rang getragen wird (null = noch nicht tragbar) */
  worn: Rarity | null;
  /** nächste höhere Seltenheit, die erst ein höherer Rang erlaubt */
  rankLocked: Rarity | null;
  /** Fortschritt zur Freischaltung (Abzeichen) */
  hint?: string;
}

export interface InventoryExtra {
  defeatedBossIds: string[];
  loot: string[];
  /** zerlegte Teile (je Zerlegen ein Eintrag) */
  dismantled?: string[];
  rankName?: (lvl: number) => string;
  bossName?: (id: string) => string;
}

export function inventory(badges: BadgeStatus[], classId: HeroClassId | undefined, rankLevel: number, allPurchases: string[], extraIn: InventoryExtra = { defeatedBossIds: [], loot: [] }): OwnedItem[] {
  const eff = effectiveLists(extraIn.loot, allPurchases, extraIn.dismantled ?? []);
  const purchases = eff.purchases;
  const extra = { ...extraIn, loot: eff.loot };
  const bt = badgeTiers(badges);
  const ctx: ArmorContext = { rankLevel, defeatedBossIds: extra.defeatedBossIds, loot: extra.loot, purchases };
  return ITEMS.flatMap((def): OwnedItem[] => {
    if (def.source.kind === 'armor') {
      const set = ARMOR_SETS[def.source.setIdx]!;
      const own = ownsArmorPiece(def.id, ctx);
      const r = own ? ARMOR_CLASS_RARITY[set.cls] : null;
      return [{ def, unlocked: r, worn: r, rankLocked: null, hint: own ? undefined : armorHint(set, ctx, extra.rankName ?? ((l) => `${l}`), extra.bossName ?? ((b) => b)) }];
    }
    const w = weaponById(def.source.weaponId)!;
    const wc: WeaponContext = { classId, purchases, loot: extra.loot, defeatedBossIds: extra.defeatedBossIds, badgeTiers: bt, bossOfRegion: bossOfRegionId };
    const own = ownsWeapon(w, wc);
    const r: Rarity | null = own ? weaponRarity(w) : null;
    return [{ def, unlocked: r, worn: r, rankLocked: null, hint: own ? undefined : weaponHint(w, rankLevel, extra) }];
  });
}

/** Wie man an eine Waffe kommt (für gesperrte Einträge) */
export function weaponHint(w: NonNullable<ReturnType<typeof weaponById>>, rankLevel: number, extra: InventoryExtra): string {
  if (w.boss) {
    const region = REGIONS.find((r) => r.id === w.boss!.region);
    const boss = CAMPAIGN.find((b) => b.id === region?.bossId);
    return `Beute von ${boss?.name ?? 'einem Boss'} (${region?.capital ?? ''})`;
  }
  const parts: string[] = [];
  if (isBuyable(w)) parts.push(rankLevel >= minRankForQuality(w.q) ? `Markt · ${weaponPrice(w)} Denare` : `Markt ab Rang ${extra.rankName?.(minRankForQuality(w.q)) ?? minRankForQuality(w.q)}`);
  const r = firstLootRegion(w.q);
  if (r >= 0) parts.push(`Beute ab ${REGIONS[r]!.name}`);
  const badge = Object.entries(BADGE_WEAPONS).find(([, ids]) => ids.includes(w.id));
  if (badge) parts.push(`Abzeichen-Belohnung`);
  return parts.join(' · ');
}

export type Loadout = Partial<Record<SlotId, string | null>>;

export function defaultLoadout(classId: HeroClassId): Loadout {
  const l: Loadout = {};
  const st = START_WEAPONS[classId];
  l.main = st.main;
  if (st.off) l.off = st.off;
  // Start-Rüstung (ohne Kopf, damit die Frisur sichtbar bleibt)
  for (const s of ['chest', 'hands', 'legs', 'feet'] as const) l[s] = armorItemId(START_SET, s);
  return l;
}

/** Gültige Ausrüstung: nur tragbare Teile im richtigen Slot, Zweihand blockiert die Nebenhand. */
export function normalizeLoadout(loadout: Loadout | undefined, inv: OwnedItem[], classId: HeroClassId): Record<SlotId, string | null> {
  const wearable = new Map(inv.filter((o) => o.worn).map((o) => [o.def.id, o]));
  const def = defaultLoadout(classId);
  // Gespeicherte Teile, die es nicht mehr gibt (alte Rüstung), fallen auf die Start-Ausrüstung zurück
  const stored = Object.fromEntries(Object.entries(loadout ?? {}).filter(([, id]) => id == null || itemById(id))) as Loadout;
  const base = { ...def, ...stored };
  const out = {} as Record<SlotId, string | null>;
  for (const s of SLOTS) {
    const id = base[s.id];
    const o = id ? wearable.get(id) : undefined;
    out[s.id] = o && o.def.slot === s.id ? o.def.id : null;
  }
  if (out.main && itemById(out.main)?.twoHanded) out.off = null;
  return out;
}

export interface EquipResult {
  loadout: Record<SlotId, string | null>;
  /** Hinweis, wenn durch die Zweihand-Regel etwas abgelegt wurde */
  notice?: string;
}

export function equipItem(current: Record<SlotId, string | null>, item: ItemDef, inv: OwnedItem[], classId: HeroClassId): EquipResult {
  const o = inv.find((x) => x.def.id === item.id);
  if (!o?.worn) throw new Error(o?.unlocked ? `${item.name} ist erst ab einem höheren Rang tragbar.` : `${item.name} ist noch nicht freigeschaltet.`);
  const next = { ...current, [item.slot]: item.id };
  let notice: string | undefined;
  if (item.slot === 'main' && item.twoHanded && current.off) {
    next.off = null;
    notice = `Zweihandwaffe: ${itemById(current.off)?.name ?? 'Nebenhand'} wurde abgelegt.`;
  }
  if (item.slot === 'off' && current.main && itemById(current.main)?.twoHanded) {
    const oneHanded = inv.filter((x) => x.worn && x.def.slot === 'main' && !x.def.twoHanded).map((x) => x.def);
    const fallback = oneHanded.find((i) => i.id === START_WEAPONS[classId].main) ?? oneHanded[0];
    next.main = fallback?.id ?? null;
    notice = `${itemById(current.main)?.name} braucht beide Hände – ${fallback ? `gegen ${fallback.name} getauscht` : 'abgelegt'}.`;
  }
  return { loadout: next, notice };
}

export function unequip(current: Record<SlotId, string | null>, slot: SlotId): Record<SlotId, string | null> {
  return { ...current, [slot]: null };
}

export { parseArmorId };

/** Waffen-Aura: Haupt- und Nebenhand aus derselben Kategorie */
export function setAura(loadout: Record<SlotId, string | null>): ItemCategory | null {
  const count = new Map<ItemCategory, number>();
  for (const id of Object.values(loadout)) {
    const c = itemById(id)?.category;
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  let best: ItemCategory | null = null;
  for (const [c, n] of count) if (n >= 2 && (!best || n > (count.get(best) ?? 0))) best = c;
  return best;
}

// ---------------------------------------------------------------------------
// Erscheinungsbild nach Rang
// ---------------------------------------------------------------------------

export const APPEARANCE_STAGES = [
  { stage: 1, ranks: [1, 2], name: 'Rekrut', look: 'einfache, abgetragene Tunika, barfuß wirkend, unsicherer Blick, zerzaustes Haar' },
  { stage: 2, ranks: [3, 4], name: 'Soldat', look: 'saubere Tunika mit Lederweste, ordentlicher Haarschnitt, entschlossener Blick' },
  { stage: 3, ranks: [5, 6], name: 'Veteran', look: 'Kettenhemd über der Tunika, erste Narben, selbstbewusst' },
  { stage: 4, ranks: [7, 8], name: 'Offizier', look: 'Prunk-Schuppenpanzer, roter Umhang mit Fibel, markante Züge' },
  { stage: 5, ranks: [9, 10], name: 'Imperator', look: 'Purpurmantel mit Goldstickerei, goldene Details, leichte goldene Aura' },
] as const;

export function appearanceStage(rankLevel: number) {
  return Math.min(5, Math.max(1, Math.ceil(rankLevel / 2)));
}

export const CLASS_FILE: Record<HeroClassId, string> = { legionar: 'legionaer', gladiator: 'gladiator', cursor: 'cursor', strategos: 'stratege' };
export const portraitFile = (classId: HeroClassId, stage: number) => `portraet_${CLASS_FILE[classId]}_stufe${stage}`;
