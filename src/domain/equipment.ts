// Ausrüstung: Slots, Gegenstände, Seltenheit, Rangbindung, Zweihand-Regel und Erscheinungsbild.
// Rein kosmetisch – beeinflusst weder Schaden noch EP noch Kampfwert.
import type { BadgeStatus } from './gamification';
import type { HeroClassId } from './rpg';
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
const TIER_TO_RARITY = { bronze: 'rare', silver: 'epic', gold: 'legendary' } as const;

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
  source: { kind: 'starter'; classId: HeroClassId } | { kind: 'badge'; badgeId: string } | { kind: 'armor'; setIdx: number };
  /** eigene Icon-Datei (Rüstungsteile nutzen ihre Figur-Ebene) */
  icon?: string;
  category?: ItemCategory;
  effect?: EffectId;
  effectText?: string;
}

const starter = (classId: HeroClassId, slot: SlotId, key: string, name: string, motif: string, twoHanded = false): ItemDef => ({ id: key, name, slot, twoHanded, motif, source: { kind: 'starter', classId } });
const reward = (badgeId: string, slot: SlotId, key: string, name: string, category: ItemCategory, effect: EffectId, effectText: string, motif: string, twoHanded = false): ItemDef => ({
  id: key, name, slot, twoHanded, motif, source: { kind: 'badge', badgeId }, category, effect, effectText,
});

const WEAPONS: ItemDef[] = [
  // Start-Ausrüstung
  starter('legionar', 'main', 'gladius', 'Gladius', 'schlichter Eisen-Gladius'),
  starter('legionar', 'off', 'scutum', 'Scutum', 'roter Langschild mit Goldadler'),
  starter('gladiator', 'main', 'dreizack', 'Dreizack', 'Dreizack des Retiarius', true),
  starter('cursor', 'main', 'botenstab', 'Botenstab', 'Botenstab mit Bronzekappe'),
  starter('cursor', 'off', 'depeschenrolle', 'Depeschenrolle', 'versiegelte Schriftrolle'),
  starter('strategos', 'main', 'kommandostab', 'Kommandostab', 'Kommandostab (Vitis) mit Goldbeschlag'),
  starter('strategos', 'off', 'wachstafel', 'Wachstafel', 'Wachstafel mit Griffel'),
  // Belohnungen aus Achievements
  reward('prs', 'main', 'gladius-bestleistung', 'Gladius der Bestleistung', 'kraft', 'sparks', 'Funken sprühen von der Klinge', 'prunkvoller Gladius mit Goldgriff'),
  reward('volume', 'main', 'hammer-atlas', 'Hammer des Atlas', 'kraft', 'quake', 'Bodenwelle, Steinchen hüpfen', 'riesiger Steinhammer mit Atlas-Relief', true),
  reward('logstreak', 'main', 'feder-chronist', 'Feder des Chronisten', 'disziplin', 'ink', 'Tintenkleckse tropfen', 'übergroße Schreibfeder als Waffe'),
  reward('recipes', 'main', 'kochloeffel-kaiser', 'Kochlöffel des Kaisers', 'ernaehrung', 'steam', 'Dampf und fliegende Kräuter', 'goldener Kochlöffel mit Lorbeergravur'),
  reward('workouts', 'off', 'veteranenschild', 'Veteranenschild', 'kraft', 'shine', 'Glanzlicht wandert übers Metall', 'zerkratzter, geflügelter Rundschild'),
  reward('water', 'off', 'amphore-aquaedukt', 'Amphore des Aquädukts', 'ernaehrung', 'water', 'Wasser schwappt, Tropfen fallen', 'bauchige Amphore mit Wellenmuster'),
  reward('mealhits', 'off', 'waage-punktlandung', 'Waage der Punktlandung', 'ernaehrung', 'balance', 'Schalen pendeln exakt ein', 'bronzene Balkenwaage'),
  reward('comeback', 'off', 'phoenixfackel', 'Phönixfackel', 'ausdauer', 'fire', 'Flammen und aufsteigende Funken', 'Fackel mit Phönixkopf'),
  reward('studio', 'off', 'hantelscheiben-schild', 'Hantelscheiben-Schild', 'kraft', 'spin', 'Scheibe dreht sich, Metallglanz', 'Hantelscheibe als Schild mit Griff'),
];
/** Rüstungsteile aus den 36 Sets */
const ARMOR_ITEMS: ItemDef[] = ARMOR_SETS.flatMap((set) =>
  ARMOR_SLOTS.map((slot): ItemDef => ({ id: armorItemId(set.idx, slot), name: armorPieceName(set, slot), slot, motif: '', source: { kind: 'armor', setIdx: set.idx }, icon: armorIconFile(set.idx, slot) })),
);
export const ITEMS: ItemDef[] = [...WEAPONS, ...ARMOR_ITEMS];
const ITEM_MAP = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id: string | null | undefined) => (id ? ITEM_MAP.get(id) : undefined);
export const itemFile = (i: ItemDef) => i.icon ?? `${SLOTS.find((s) => s.id === i.slot)!.file}_${i.id}`;
export const STARTER_PRICE = 150;
export const starterPurchaseId = (itemId: string) => `item-${itemId}`;

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
  rankName?: (lvl: number) => string;
  bossName?: (id: string) => string;
}

export function inventory(badges: BadgeStatus[], classId: HeroClassId | undefined, rankLevel: number, purchases: string[], extra: InventoryExtra = { defeatedBossIds: [], loot: [] }): OwnedItem[] {
  const byId = new Map(badges.map((b) => [b.id, b]));
  const ctx: ArmorContext = { rankLevel, defeatedBossIds: extra.defeatedBossIds, loot: extra.loot, purchases };
  return ITEMS.flatMap((def): OwnedItem[] => {
    if (def.source.kind === 'armor') {
      const set = ARMOR_SETS[def.source.setIdx]!;
      const own = ownsArmorPiece(def.id, ctx);
      const r = own ? ARMOR_CLASS_RARITY[set.cls] : null;
      return [{ def, unlocked: r, worn: r, rankLocked: null, hint: own ? undefined : armorHint(set, ctx, extra.rankName ?? ((l) => `${l}`), extra.bossName ?? ((b) => b)) }];
    }
    if (def.source.kind === 'starter') {
      const own = def.source.classId === classId || purchases.includes(starterPurchaseId(def.id));
      return [{ def, unlocked: own ? 'common' : null, worn: own ? 'common' : null, rankLocked: null, hint: own ? undefined : `Start-Ausrüstung · ${STARTER_PRICE} Denare im Markt` }];
    }
    const b = byId.get(def.source.badgeId);
    if (!b) return []; // z. B. Studio-Abzeichen ohne Heimstudio
    const unlocked: Rarity | null = b.tier ? TIER_TO_RARITY[b.tier] : null;
    let worn: Rarity | null = null;
    let rankLocked: Rarity | null = null;
    if (unlocked) {
      for (const r of RARITIES.slice(1, RARITIES.indexOf(unlocked) + 1)) {
        if (rankLevel >= RARITY_MIN_RANK[r]) worn = r;
        else if (!rankLocked) rankLocked = r;
      }
    }
    const nextTarget = b.nextTarget;
    const hint = !unlocked ? `${b.name} Bronze: ${b.description(b.tiers[0])}` : nextTarget != null ? `Nächste Stufe: ${b.description(nextTarget)}` : undefined;
    return [{ def, unlocked, worn, rankLocked, hint }];
  });
}

export type Loadout = Partial<Record<SlotId, string | null>>;

export function defaultLoadout(classId: HeroClassId): Loadout {
  const l: Loadout = {};
  for (const i of ITEMS) if (i.source.kind === 'starter' && i.source.classId === classId) l[i.slot] = i.id;
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
    const fallback = oneHanded.find((i) => i.source.kind === 'starter' && i.source.classId === classId) ?? oneHanded[0];
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
