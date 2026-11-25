// Schmiede: Teile verbessern (+1 … +10) und überzählige Teile zerlegen.
import { getSettings, setSetting } from './profileRepo';
import type { GameState } from '@/domain/gamification';
import { inventory, normalizeLoadout } from '@/domain/equipment';
import { gearExtra } from '@/domain/gear';
import { MAX_FORGE_LEVEL, canAfford, dismantleGain, effectiveLists, dismantled, forgeLevels, matBalance, upgradeCost, type Mats } from '@/domain/forge';
import { isEarnedOnly, parseArmorId } from '@/domain/armor';
import { weaponById } from '@/domain/weapons';

/** Einzigartige Teile (Boss-Waffen und Boss-Rüstung) brauchen ab +6 Reliquien und lassen sich nicht zerlegen. */
export const isUnique = (id: string) => !!weaponById(id)?.boss || isEarnedOnly(parseArmorId(id)?.set.cls ?? 'stoff');

async function ctx(game: GameState) {
  const s = await getSettings();
  const inv = inventory(game.badges, s.hero?.classId, game.rank.rank.level, s.purchases, gearExtra(game, s.armorLoot, s.forgeLog));
  return { s, inv, mats: matBalance(s.worldLog, s.forgeLog), levels: forgeLevels(s.forgeLog) };
}

export async function upgradeItem(id: string, game: GameState): Promise<number> {
  const { s, inv, mats, levels } = await ctx(game);
  if (!inv.find((o) => o.def.id === id)?.worn) throw new Error('Das Teil gehört dir noch nicht.');
  const to = (levels.get(id) ?? 0) + 1;
  if (to > MAX_FORGE_LEVEL) throw new Error('Schon auf +10 – stärker geht es nicht.');
  const cost = upgradeCost(to, isUnique(id));
  if (!canAfford(mats, cost)) throw new Error('Dafür fehlt dir noch Material.');
  await setSetting('forgeLog', [...s.forgeLog, { k: 'upgrade', at: new Date().toISOString(), id, to, cost }]);
  return to;
}

/** Zerlegbar: eigenes Teil aus Beute oder Kauf, nicht angelegt, kein Unikat, keine Start- oder Abzeichen-Ausrüstung. */
export function dismantleCheck(id: string, s: { armorLoot: string[]; purchases: string[]; forgeLog: Parameters<typeof dismantled>[0] }, equipped: Set<string>): string | null {
  if (equipped.has(id)) return 'Erst ablegen, dann zerlegen.';
  if (isUnique(id)) return 'Boss-Stücke sind einzigartig und lassen sich nicht zerlegen.';
  const eff = effectiveLists(s.armorLoot, s.purchases, dismantled(s.forgeLog));
  if (!eff.loot.includes(id) && !eff.purchases.includes(id)) return 'Start- und Abzeichen-Ausrüstung lässt sich nicht zerlegen.';
  return null;
}

export async function dismantleItem(id: string, game: GameState): Promise<Mats> {
  const { s, inv, levels } = await ctx(game);
  const o = inv.find((x) => x.def.id === id);
  if (!o?.worn || !s.hero) throw new Error('Das Teil gehört dir nicht.');
  const loadout = normalizeLoadout(s.hero.loadout, inv, s.hero.classId);
  const why = dismantleCheck(id, s, new Set(Object.values(loadout).filter(Boolean) as string[]));
  if (why) throw new Error(why);
  const gain = dismantleGain(o.worn, levels.get(id) ?? 0);
  await setSetting('forgeLog', [...s.forgeLog, { k: 'dismantle', at: new Date().toISOString(), id, gain }]);
  return gain;
}
