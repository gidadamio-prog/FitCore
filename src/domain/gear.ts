// Verbindet Spielstand und Ausrüstung: Kontext für Rüstungs-Freischaltungen (Bosse, Beute, Namen für Hinweise).
import { RANKS, type GameState } from './gamification';
import { CAMPAIGN, bossAt } from './rpg';
import type { InventoryExtra } from './equipment';

export const bossNameById = (id: string) => {
  const b = id.startsWith('limes') ? bossAt(CAMPAIGN.length) : CAMPAIGN.find((x) => x.id === id);
  return b ? `${b.name} (${b.province})` : id;
};

export function gearExtra(game: GameState, loot: string[]): InventoryExtra {
  return {
    defeatedBossIds: game.campaign.defeated.map((d) => d.boss.id),
    loot,
    rankName: (l) => RANKS[l - 1]?.name ?? String(l),
    bossName: bossNameById,
  };
}
