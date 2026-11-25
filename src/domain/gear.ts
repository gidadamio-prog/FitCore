// Verbindet Spielstand und Ausrüstung: Kontext für Rüstungs-Freischaltungen (Bosse, Beute, Namen für Hinweise).
import { RANKS, type GameState } from './gamification';
import { CAMPAIGN, bossAt } from './rpg';
import { inventory, normalizeLoadout, type InventoryExtra } from './equipment';
import { heroStats, type Stats } from './combat';
import type { Hero } from './rpg';
import { dismantled, forgeLevels, type ForgeEvent } from './forge';

export const bossNameById = (id: string) => {
  const b = id.startsWith('limes') ? bossAt(CAMPAIGN.length) : CAMPAIGN.find((x) => x.id === id);
  return b ? `${b.name} (${b.province})` : id;
};

export function gearExtra(game: GameState, loot: string[], forgeLog: ForgeEvent[] = []): InventoryExtra {
  return {
    defeatedBossIds: game.campaign.defeated.map((d) => d.boss.id),
    loot,
    cooking: game.cooking,
    dismantled: dismantled(forgeLog),
    rankName: (l) => RANKS[l - 1]?.name ?? String(l),
    bossName: bossNameById,
  };
}

/** Heldenwerte aus Spielstand und gespeicherter Ausrüstung */
export function heroStatsFor(game: GameState, hero: Hero, purchases: string[], loot: string[], forgeLog: ForgeEvent[] = []): Stats {
  const inv = inventory(game.badges, hero.classId, game.rank.rank.level, purchases, gearExtra(game, loot, forgeLog));
  const loadout = normalizeLoadout(hero.loadout, inv, hero.classId);
  const worn = new Map(inv.map((o) => [o.def.id, o.worn]));
  const levels = forgeLevels(forgeLog);
  return heroStats(game.level.level, loadout, (id) => worn.get(id) ?? null, (id) => levels.get(id) ?? 0);
}

/** Heute trainiert → Kampfgeist */
export const trainedToday = (game: GameState, today: string) => {
  const f = game.facts.get(today);
  return !!f && f.workouts + f.cardioSessions > 0;
};
