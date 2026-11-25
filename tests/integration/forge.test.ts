import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { getSettings, setSetting } from '@/data/profileRepo';
import { fight, initWorld, travel } from '@/data/worldRepo';
import { dismantleItem, upgradeItem } from '@/data/forgeRepo';
import { computeGame, type GameInput, type GameState } from '@/domain/gamification';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { today } from '@/domain/dates';
import { forgeLevels, matBalance } from '@/domain/forge';
import { heroStatsFor } from '@/domain/gear';
import type { WorldEvent } from '@/domain/world';

async function game(over: Partial<GameInput> = {}): Promise<GameState> {
  const s = await getSettings();
  return computeGame({ today: today(), entries: [], goals: [], workouts: [], cardio: [], measurements: [], water: [], recovery: [], recipesCount: 0, exercises: EXERCISE_LIBRARY, trainingDaysPerWeek: 3, waterGoalMl: 2500, worldLog: s.worldLog, ...over });
}

describe('Schmiede – Verbessern, Zerlegen, Pech-Ausgleich', () => {
  it('verbessert mit Material, zerlegt nur Beute, gibt Material zurück', async () => {
    await freshDb();
    await setSetting('hero', { id: 'h', name: 'Max', classId: 'legionar', color: '#a00', createdAt: today() } as never);
    await initWorld(await game());
    const s0 = await getSettings();
    const gift: WorldEvent = { k: 'chest', at: new Date().toISOString(), date: today(), node: 'arverner-g', ap: 0, loot: ['armor-02-legs'], denare: 0, mats: { eisen: 5 } };
    await setSetting('worldLog', [...s0.worldLog, gift]);
    await setSetting('armorLoot', ['armor-02-legs']);
    let g = await game();
    const before = heroStatsFor(g, (await getSettings()).hero!, [], ['armor-02-legs'], []);
    expect(await upgradeItem('waffe-schwert-00', g)).toBe(1);
    let s = await getSettings();
    expect(matBalance(s.worldLog, s.forgeLog).eisen).toBe(3);
    expect(forgeLevels(s.forgeLog).get('waffe-schwert-00')).toBe(1);
    const after = heroStatsFor(g, s.hero!, s.purchases, s.armorLoot, s.forgeLog);
    expect(after.atk).toBeGreaterThanOrEqual(before.atk);
    await upgradeItem('waffe-schwert-00', g); // +2 kostet 3 Eisen
    await expect(upgradeItem('waffe-schwert-00', g)).rejects.toThrow(/Material/);

    await expect(dismantleItem('waffe-schwert-00', g)).rejects.toThrow(/ablegen/);
    await expect(dismantleItem('armor-00-head', g)).rejects.toThrow(/Start/);
    expect(await dismantleItem('armor-02-legs', g)).toEqual({ eisen: 2 });
    s = await getSettings();
    expect(matBalance(s.worldLog, s.forgeLog).eisen).toBe(2);
    g = await game();
    await expect(dismantleItem('armor-02-legs', g)).rejects.toThrow(/gehört dir nicht/);
  });

  it('nach 4 leeren Siegen fällt beim 5. sicher etwas', async () => {
    await freshDb();
    await setSetting('hero', { id: 'h', name: 'Max', classId: 'legionar', color: '#a00', createdAt: today() } as never);
    await initWorld(await game());
    const s0 = await getSettings();
    const empty = (i: number): WorldEvent => ({ k: 'fight', at: `2020-01-0${i + 1}T10:00:00Z`, date: '2020-01-0' + (i + 1), node: 'arverner-i', ap: 0, won: true, loot: [], denare: 0, mats: {} });
    await setSetting('worldLog', [...s0.worldLog, ...[0, 1, 2, 3].map(empty)]);
    let g = await game();
    await travel('arverner-a', g);
    g = await game();
    const f = await fight('arverner-a', g);
    expect(f.result.won).toBe(true);
    expect(f.loot.length).toBeGreaterThan(0);
    expect(f.mats?.eisen).toBeGreaterThan(0);
  });
});
