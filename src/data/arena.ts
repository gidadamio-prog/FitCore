// Held, Rivalen und Markt – gespeichert in den lokalen Einstellungen.
import { addGoalVersion, currentGoal, deriveGoal, getProfile, getSettings, latestWeight, setSetting, type Rival } from './profileRepo';
import { encodeShare, SHOP, classById, denare, pathById, type Hero, type PathId, type ShareCard } from '@/domain/rpg';
import { isBuyable, minRankForQuality, weaponById, weaponPrice } from '@/domain/weapons';
import { equipItem, inventory, itemById, normalizeLoadout, unequip, type SlotId } from '@/domain/equipment';
import { gearExtra } from '@/domain/gear';
import { ARMOR_CLASS_MIN_RANK, ARMOR_SLOTS, isEarnedOnly, armorItemId, armorPrice, fullArmorSet, parseArmorId, updateBonusLog, type BonusLogEntry } from '@/domain/armor';
import type { GameState } from '@/domain/gamification';
import { today, uid } from '@/domain/dates';

export async function saveHero(h: Omit<Hero, 'id' | 'createdAt'> & Partial<Pick<Hero, 'id' | 'createdAt'>>) {
  const name = h.name.trim();
  if (!name) throw new Error('Bitte gib deinem Helden einen Namen.');
  if (name.length > 30) throw new Error('Der Name darf höchstens 30 Zeichen lang sein.');
  if (!classById(h.classId)) throw new Error('Bitte wähle eine Klasse.');
  const prev = (await getSettings()).hero;
  const hero: Hero = { ...prev, ...h, name, id: h.id ?? prev?.id ?? uid(), createdAt: h.createdAt ?? prev?.createdAt ?? today() };
  await setSetting('hero', hero);
  return hero;
}

export function buildShareCard(hero: Hero, game: GameState): ShareCard {
  return {
    v: 1,
    id: hero.id,
    n: hero.name,
    k: hero.classId,
    e: hero.emblem,
    col: hero.color,
    ...(hero.title ? { t: hero.title } : {}),
    ...(hero.frame && hero.frame !== 'bronze' ? { fr: hero.frame } : {}),
    l: game.level.level,
    x: game.xp,
    f: game.battle.score,
    w: game.battle.avgWeek,
    s: game.battle.days,
    b: game.campaign.defeated.length,
    c: game.colosseumWins.length,
    d: today(),
  };
}

export function shareLink(code: string) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/erfolge?tab=arena&rivale=${code}`;
}

export function shareText(card: ShareCard) {
  const cls = classById(card.k)?.name ?? '';
  return [
    `⚔️ ${card.n}${card.t ? ' ' + card.t : ''} · ${cls}, Stufe ${card.l}`,
    `Kampfwert (28 Tage): ${card.f.toLocaleString('de-DE')} · Ø ${card.w.toLocaleString('de-DE')} EP/Woche`,
    `Bosse besiegt: ${card.b} · Kolosseum-Siege: ${card.c}`,
    'Tritt in der FitCore-Arena gegen mich an:',
  ].join('\n');
}

/** Teilt über das Teilen-Menü des Handys; ohne Teilen-Menü wird in die Zwischenablage kopiert. */
export async function shareCard(card: ShareCard): Promise<'shared' | 'copied' | 'cancelled'> {
  const code = encodeShare(card);
  const url = shareLink(code);
  const text = shareText(card);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'FitCore-Arena', text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`);
  return 'copied';
}

export async function addRival(card: ShareCard) {
  const s = await getSettings();
  if (s.hero && card.id === s.hero.id) throw new Error('Das ist dein eigener Held.');
  const existing = s.rivals.find((r) => r.id === card.id);
  if (existing && existing.d > card.d) throw new Error(`Du hast von ${card.n} schon einen neueren Stand.`);
  const rival: Rival = { ...card, importedAt: new Date().toISOString() };
  await setSetting('rivals', [...s.rivals.filter((r) => r.id !== card.id), rival]);
  return existing ? 'updated' : 'added';
}

export async function removeRival(id: string) {
  const s = await getSettings();
  await setSetting('rivals', s.rivals.filter((r) => r.id !== id));
}

/** Preise für Käufe außerhalb des SHOP-Katalogs (Rüstung, Waffen). Alte Käufe der früheren Start-Waffen („item-…“) werden erstattet. */
export function extraPrices(purchases: string[]) {
  return Object.fromEntries(
    purchases.flatMap((p) => {
      if (p.startsWith('item-')) return [[p, 0]];
      const w = weaponById(p);
      if (w) return [[p, weaponPrice(w)]];
      const a = parseArmorId(p);
      return a ? [[p, armorPrice(a.set)]] : [];
    }),
  );
}

/** Waffe im Markt kaufen – Qualität muss für den Rang freigegeben sein, Boss-Waffen sind nicht käuflich. */
export async function buyWeapon(id: string, game: GameState) {
  const w = weaponById(id);
  if (!w || !isBuyable(w)) throw new Error('Diese Waffe ist nicht käuflich.');
  if (game.rank.rank.level < minRankForQuality(w.q)) throw new Error('Diese Waffe gibt es erst ab einem höheren Rang.');
  const s = await getSettings();
  const inv = inventory(game.badges, s.hero?.classId, game.rank.rank.level, s.purchases, gearExtra(game, s.armorLoot, s.forgeLog));
  if (inv.find((o) => o.def.id === id)?.unlocked) throw new Error('Hast du schon.');
  const price = weaponPrice(w);
  const { balance } = denare(game.xp, s.purchases, game.bonusDenare, extraPrices(s.purchases));
  if (balance < price) throw new Error(`Dir fehlen noch ${price - balance} Denare.`);
  await setSetting('purchases', [...s.purchases, id]);
}

/** Rüstungsteile im Markt kaufen – Klasse muss für den Rang freigegeben sein, Boss-Rüstung ist nicht käuflich. */
export async function buyArmor(itemIds: string[], game: GameState) {
  const s = await getSettings();
  const inv = inventory(game.badges, s.hero?.classId, game.rank.rank.level, s.purchases, gearExtra(game, s.armorLoot, s.forgeLog));
  let price = 0;
  for (const id of itemIds) {
    const a = parseArmorId(id);
    if (!a || isEarnedOnly(a.set.cls)) throw new Error('Dieses Teil ist nicht käuflich.');
    if (game.rank.rank.level < ARMOR_CLASS_MIN_RANK[a.set.cls]) throw new Error('Diese Rüstungsklasse gibt es erst ab einem höheren Rang.');
    if (inv.find((o) => o.def.id === id)?.unlocked) throw new Error('Hast du schon.');
    price += armorPrice(a.set);
  }
  const { balance } = denare(game.xp, s.purchases, game.bonusDenare, extraPrices(s.purchases));
  if (balance < price) throw new Error(`Dir fehlen noch ${price - balance} Denare.`);
  await setSetting('purchases', [...s.purchases, ...itemIds]);
}

export async function buyItem(itemId: string, xp: number, bonus = 0) {
  const shopItem = SHOP.find((x) => x.id === itemId);
  if (!shopItem) throw new Error('Unbekannter Gegenstand.');
  const price = shopItem.price;
  const s = await getSettings();
  if (s.purchases.includes(itemId)) throw new Error('Schon gekauft.');
  const { balance } = denare(xp, s.purchases, bonus, extraPrices(s.purchases));
  if (balance < price) throw new Error(`Dir fehlen noch ${price - balance} Denare.`);
  await setSetting('purchases', [...s.purchases, itemId]);
}

/** Ausrüstung anlegen – prüft Freischaltung, Rang und Zweihand-Regel. */
export async function setHeroLook(look: NonNullable<Hero['look']>) {
  const s = await getSettings();
  if (!s.hero) throw new Error('Erschaffe zuerst deinen Helden.');
  await setSetting('hero', { ...s.hero, look });
}

export async function equipToHero(itemId: string, game: GameState) {
  const s = await getSettings();
  if (!s.hero) throw new Error('Erschaffe zuerst deinen Helden.');
  const item = itemById(itemId);
  if (!item) throw new Error('Unbekannter Gegenstand.');
  const inv = inventory(game.badges, s.hero.classId, game.rank.rank.level, s.purchases, gearExtra(game, s.armorLoot, s.forgeLog));
  const current = normalizeLoadout(s.hero.loadout, inv, s.hero.classId);
  const r = equipItem(current, item, inv, s.hero.classId);
  await saveLoadout(s.hero, r.loadout, s.setBonusLog);
  return r.notice;
}

/** Ausrüstung speichern und Set-Bonus-Verlauf fortschreiben. */
async function saveLoadout(hero: Hero, loadout: Record<SlotId, string | null>, log: BonusLogEntry[]) {
  await setSetting('hero', { ...hero, loadout });
  const next = updateBonusLog(log, fullArmorSet(loadout)?.idx ?? null, today());
  if (next !== log && JSON.stringify(next) !== JSON.stringify(log)) await setSetting('setBonusLog', next);
}

/** Rüstung auf der eigenen Figur aus-/einblenden (bleibt angelegt, Set-Bonus bleibt). */
export async function toggleArmorHidden(slot: string) {
  const s = await getSettings();
  if (!s.hero) return;
  const hidden = new Set(s.hero.armorHidden ?? []);
  if (hidden.has(slot)) hidden.delete(slot);
  else hidden.add(slot);
  await setSetting('hero', { ...s.hero, armorHidden: [...hidden] });
}

/** Mehrere Rüstungsplätze auf einmal ein- oder ausblenden (bleiben angelegt, Boni gelten weiter). */
export async function setArmorHidden(slots: string[], hidden: boolean) {
  const s = await getSettings();
  if (!s.hero) return;
  const set = new Set(s.hero.armorHidden ?? []);
  for (const slot of slots) {
    if (hidden) set.add(slot);
    else set.delete(slot);
  }
  await setSetting('hero', { ...s.hero, armorHidden: [...set] });
}

export async function setArmorColor(color: string | null) {
  const s = await getSettings();
  if (!s.hero) return;
  await setSetting('hero', { ...s.hero, armorColor: color ?? undefined });
}

/** Alle eigenen Teile eines Rüstungs-Sets anlegen. */
export async function equipArmorSet(idx: number, game: GameState) {
  const s = await getSettings();
  if (!s.hero) throw new Error('Erschaffe zuerst deinen Helden.');
  const inv = inventory(game.badges, s.hero.classId, game.rank.rank.level, s.purchases, gearExtra(game, s.armorLoot, s.forgeLog));
  const loadout = normalizeLoadout(s.hero.loadout, inv, s.hero.classId);
  let n = 0;
  for (const slot of ARMOR_SLOTS) {
    const id = armorItemId(idx, slot);
    if (inv.find((o) => o.def.id === id)?.worn) {
      loadout[slot] = id;
      n++;
    }
  }
  await saveLoadout(s.hero, loadout, s.setBonusLog);
  return n;
}

export async function unequipFromHero(slot: SlotId, game: GameState) {
  const s = await getSettings();
  if (!s.hero) return;
  const inv = inventory(game.badges, s.hero.classId, game.rank.rank.level, s.purchases, gearExtra(game, s.armorLoot, s.forgeLog));
  await saveLoadout(s.hero, unequip(normalizeLoadout(s.hero.loadout, inv, s.hero.classId), slot), s.setBonusLog);
}

/** Vorschau des Ernährungsziels für einen Lebensweg – gleiche Berechnung und Sicherheitsgrenzen wie im Zielrechner. */
export async function previewPath(pathId: PathId) {
  const path = pathById(pathId);
  if (!path) throw new Error('Unbekannter Lebensweg.');
  const [profile, goal, weight] = await Promise.all([getProfile(), currentGoal(), latestWeight()]);
  if (!profile || !goal) throw new Error('Kein Profil oder Ziel vorhanden.');
  if (!weight) throw new Error('Trage zuerst dein Gewicht ein.');
  const computed = deriveGoal(profile, weight, { primaryGoal: path.goal, secondaryGoals: goal.secondaryGoals, macroStrategy: path.macroStrategy, formula: goal.formula });
  return { path, goal, computed };
}

export async function applyPath(pathId: PathId) {
  const { path, goal, computed } = await previewPath(pathId);
  await addGoalVersion({
    primaryGoal: path.goal,
    secondaryGoals: goal.secondaryGoals,
    weeklyRateKg: computed.weeklyRateKg,
    macroStrategy: path.macroStrategy,
    formula: computed.formula,
    bmr: computed.bmr,
    tdee: computed.tdee,
    adjustmentKcal: computed.adjustmentKcal,
    calorieTarget: computed.calorieTarget,
    proteinG: computed.proteinG,
    carbsG: computed.carbsG,
    fatG: computed.fatG,
    manualCalories: false,
    manualMacros: false,
    reason: `Lebensweg: ${path.name}`,
  });
}


export async function equip(kind: 'palette' | 'title' | 'frame', value: string | undefined) {
  const s = await getSettings();
  if (!s.hero) throw new Error('Erschaffe zuerst deinen Helden.');
  const patch: Partial<Hero> = kind === 'palette' ? { palette: (value ?? 'imperium') as Hero['palette'] } : kind === 'frame' ? { frame: (value ?? 'bronze') as Hero['frame'] } : { title: value };
  await setSetting('hero', { ...s.hero, ...patch });
}
