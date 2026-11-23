// Ausrüstung: Slots, Gegenstände, Seltenheit, Rangbindung, Zweihand-Regel und Erscheinungsbild.
// Rein kosmetisch – beeinflusst weder Schaden noch EP noch Kampfwert.
import type { BadgeStatus } from './gamification';
import type { HeroClassId } from './rpg';

export type SlotId = 'main' | 'off' | 'head' | 'hands' | 'legs' | 'feet';
export const SLOTS: { id: SlotId; label: string; file: string }[] = [
  { id: 'main', label: 'Haupthand', file: 'haupthand' },
  { id: 'off', label: 'Nebenhand', file: 'nebenhand' },
  { id: 'head', label: 'Helm', file: 'helm' },
  { id: 'hands', label: 'Hände', file: 'haende' },
  { id: 'legs', label: 'Hose', file: 'hose' },
  { id: 'feet', label: 'Schuhe', file: 'schuhe' },
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
  source: { kind: 'starter'; classId: HeroClassId } | { kind: 'badge'; badgeId: string };
  category?: ItemCategory;
  effect?: EffectId;
  effectText?: string;
}

const starter = (classId: HeroClassId, slot: SlotId, key: string, name: string, motif: string, twoHanded = false): ItemDef => ({ id: key, name, slot, twoHanded, motif, source: { kind: 'starter', classId } });
const reward = (badgeId: string, slot: SlotId, key: string, name: string, category: ItemCategory, effect: EffectId, effectText: string, motif: string, twoHanded = false): ItemDef => ({
  id: key, name, slot, twoHanded, motif, source: { kind: 'badge', badgeId }, category, effect, effectText,
});

export const ITEMS: ItemDef[] = [
  // Start-Ausrüstung
  starter('legionar', 'main', 'gladius', 'Gladius', 'schlichter Eisen-Gladius'),
  starter('legionar', 'off', 'scutum', 'Scutum', 'roter Langschild mit Goldadler'),
  starter('legionar', 'head', 'galea', 'Galea', 'Legionärshelm mit Wangenklappen'),
  starter('legionar', 'hands', 'manicae', 'Manicae', 'Armschienen aus Eisenstreifen'),
  starter('legionar', 'legs', 'bracae', 'Bracae', 'Legionärshose aus Wolle'),
  starter('legionar', 'feet', 'caligae', 'Caligae', 'genagelte Ledersandalen'),
  starter('gladiator', 'main', 'dreizack', 'Dreizack', 'Dreizack des Retiarius', true),
  starter('gladiator', 'head', 'murmillo', 'Murmillo-Helm', 'Murmillo-Helm mit Gitter und Kamm'),
  starter('gladiator', 'hands', 'manica', 'Manica', 'gepolsterter Armschutz'),
  starter('gladiator', 'legs', 'subligaculum', 'Subligaculum', 'Lendenschurz mit Ledergürtel'),
  starter('gladiator', 'feet', 'fasciae', 'Fasciae', 'Wickelbänder für die Beine'),
  starter('cursor', 'main', 'botenstab', 'Botenstab', 'Botenstab mit Bronzekappe'),
  starter('cursor', 'off', 'depeschenrolle', 'Depeschenrolle', 'versiegelte Schriftrolle'),
  starter('cursor', 'head', 'petasos', 'Petasos', 'breitkrempiger Reisehut'),
  starter('cursor', 'hands', 'lederhandschuhe', 'Lederhandschuhe', 'leichte Lederhandschuhe'),
  starter('cursor', 'legs', 'laufhose', 'Laufhose', 'leichte kurze Hose'),
  starter('cursor', 'feet', 'leichte-sandalen', 'Leichte Sandalen', 'leichte Riemensandalen'),
  starter('strategos', 'main', 'kommandostab', 'Kommandostab', 'Kommandostab (Vitis) mit Goldbeschlag'),
  starter('strategos', 'off', 'wachstafel', 'Wachstafel', 'Wachstafel mit Griffel'),
  starter('strategos', 'head', 'offiziershelm', 'Offiziershelm', 'Helm mit querstehendem rotem Busch'),
  starter('strategos', 'hands', 'siegelring-handschuhe', 'Siegelring-Handschuhe', 'feine Handschuhe mit Siegelring'),
  starter('strategos', 'legs', 'feldherren-beinkleid', 'Feldherren-Beinkleid', 'edles Beinkleid mit Purpurstreifen'),
  starter('strategos', 'feet', 'calcei', 'Calcei', 'geschnürte Lederstiefel'),
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
  reward('quests', 'head', 'galea-feldherr', 'Galea des Feldherrn', 'disziplin', 'plume', 'Roter Helmbusch weht', 'Prunkhelm mit hohem rotem Busch'),
  reward('seasons', 'head', 'lorbeerkranz-triumphator', 'Lorbeerkranz des Triumphators', 'ruhm', 'leaves', 'Goldene Blätter rieseln', 'goldener Lorbeerkranz'),
  reward('perfect', 'head', 'traubenkrone', 'Traubenkrone', 'ernaehrung', 'grapes', 'Trauben wippen und kullern', 'Krone aus Weinlaub und Trauben'),
  reward('milon', 'head', 'diadem-zirkel', 'Diadem des Zirkels', 'ausdauer', 'orbit', 'Lichtpunkte kreisen wie ein Zirkel', 'schlichtes Stirnband mit kleinen Edelsteinen'),
  reward('protein', 'hands', 'shaker-handschuhe', 'Shaker-Handschuhe', 'ernaehrung', 'powder', 'Proteinpulver-Wölkchen', 'Handschuhe mit Shaker-Motiv'),
  reward('colosseum', 'hands', 'caesten-champion', 'Caesten des Champions', 'ruhm', 'sand', 'Sandstaub-Einschlag', 'Faustriemen mit Metallbeschlägen'),
  reward('mastery', 'hands', 'kreidehaende', 'Kreidehände des Meisters', 'kraft', 'chalk', 'Kreidestaub rieselt', 'Handschuhe, mit Kreide bestaubt'),
  reward('measure', 'legs', 'massband-beinkleider', 'Maßband-Beinkleider', 'disziplin', 'tape', 'Zentimeterzahlen schweben hoch', 'Hose mit Maßband als Gürtel und Saum'),
  reward('bosses', 'legs', 'beinschienen-eroberer', 'Beinschienen des Eroberers', 'ruhm', 'crests', 'Provinzwappen leuchten auf', 'Beinschienen mit Provinzwappen'),
  reward('cardio', 'feet', 'caligae-laeufer', 'Caligae des Läufers', 'ausdauer', 'trail', 'Staubspur und Speedlines', 'Sandalen mit Flügel-Motiv'),
  reward('trainstreak', 'feet', 'marschstiefel-legion', 'Marschstiefel der Legion', 'ausdauer', 'stomp', 'Stampfen im Takt', 'schwere Marschstiefel'),
  reward('duels', 'feet', 'schattensandalen', 'Schattensandalen', 'ruhm', 'shadow', 'Schattenbild läuft hinterher', 'dunkle Sandalen mit Rauchschleier-Muster'),
];
export const itemById = (id: string | null | undefined) => (id ? ITEMS.find((i) => i.id === id) : undefined);
export const itemFile = (i: ItemDef) => `${SLOTS.find((s) => s.id === i.slot)!.file}_${i.id}`;
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

export function inventory(badges: BadgeStatus[], classId: HeroClassId | undefined, rankLevel: number, purchases: string[]): OwnedItem[] {
  const byId = new Map(badges.map((b) => [b.id, b]));
  return ITEMS.flatMap((def): OwnedItem[] => {
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
  return l;
}

/** Gültige Ausrüstung: nur tragbare Teile im richtigen Slot, Zweihand blockiert die Nebenhand. */
export function normalizeLoadout(loadout: Loadout | undefined, inv: OwnedItem[], classId: HeroClassId): Record<SlotId, string | null> {
  const wearable = new Map(inv.filter((o) => o.worn).map((o) => [o.def.id, o]));
  const base = { ...defaultLoadout(classId), ...(loadout ?? {}) };
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

/** Set-Aura: drei getragene Teile derselben Kategorie */
export function setAura(loadout: Record<SlotId, string | null>): ItemCategory | null {
  const count = new Map<ItemCategory, number>();
  for (const id of Object.values(loadout)) {
    const c = itemById(id)?.category;
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  let best: ItemCategory | null = null;
  for (const [c, n] of count) if (n >= 3 && (!best || n > (count.get(best) ?? 0))) best = c;
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
