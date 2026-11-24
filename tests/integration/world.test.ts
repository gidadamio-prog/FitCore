import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { getSettings, setSetting } from '@/data/profileRepo';
import { fight, initWorld, openChest, siege, travel } from '@/data/worldRepo';
import { computeGame, type GameInput, type GameState } from '@/domain/gamification';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { today } from '@/domain/dates';
import { capitalOf } from '@/domain/world';

async function game(over: Partial<GameInput> = {}): Promise<GameState> {
  const s = await getSettings();
  return computeGame({ today: today(), entries: [], goals: [], workouts: [], cardio: [], measurements: [], water: [], recovery: [], recipesCount: 0, exercises: EXERCISE_LIBRARY, trainingDaysPerWeek: 3, waterGoalMl: 2500, worldLog: s.worldLog, ...over });
}

describe('Weltkarte – Aktionen', () => {
  it('Start, Reisen, Kampf, Truhe, AP-Verbrauch und Beute', async () => {
    await freshDb();
    await setSetting('hero', { id: 'h', name: 'Max', classId: 'legionar', color: '#a00', createdAt: today() } as never);
    expect(await initWorld(await game())).toBe(true);
    expect(await initWorld(await game())).toBe(false); // nur einmal
    let g = await game();
    expect(g.world.ap).toBe(5);
    await travel('arverner-a', g);
    g = await game();
    expect(g.world.ap).toBe(4);
    const f = await fight('arverner-a', g);
    expect(f.result.won).toBe(true);
    g = await game();
    expect(g.world.ap).toBe(2);
    await expect(fight('arverner-a', g)).rejects.toThrow(/sammelt sich/);
    await expect(travel('arverner-d', g)).rejects.toThrow(/Nebel/);
    await travel('arverner-b', g);
    g = await game();
    await travel('arverner-c', g);
    g = await game();
    expect(g.world.state.pos).toBe('arverner-c');
    expect(g.world.ap).toBe(0);
    await expect(travel('arverner-d', g)).rejects.toThrow(/Besiege zuerst/);
    await expect(travel('arverner-b', g)).rejects.toThrow(/Aktionspunkte/);
    await expect(openChest('arverner-c', g)).rejects.toThrow(/keine Truhe/);
  });
  it('Belagerung: einmal pro Tag, Bossschaden bleibt; übernommene Bosse zählen als erobert', async () => {
    await freshDb();
    await setSetting('hero', { id: 'h', name: 'Max', classId: 'legionar', color: '#a00', createdAt: today() } as never);
    await setSetting('worldLog', [{ k: 'init', at: '2026-11-01T00:00:00Z', date: today(), pos: capitalOf('arverner'), conquered: [] }]);
    // AP schenken: viele Tage protokolliert ist hier zu aufwendig → Log-Init am Ziel und Start-AP nutzen
    let g = await game();
    const r1 = await siege(capitalOf('arverner'), g);
    expect(r1.result.dealt).toBeGreaterThan(0);
    g = await game();
    expect(g.campaign.current.remaining).toBe(g.campaign.current.boss.hp - r1.result.dealt);
    await expect(siege(capitalOf('arverner'), g)).rejects.toThrow(/Heute hast du schon/);
    // Übernahme: alter Feldzug mit Gallia besiegt
    await freshDb();
    g = await game();
    const legacy = { ...g, legacyDefeated: [{ bossId: 'gallia', date: '2026-10-01' }] };
    await initWorld(legacy);
    g = await game();
    expect(g.campaign.defeated.map((d) => d.boss.id)).toEqual(['gallia']);
    expect(g.world.state.pos).toBe(capitalOf('arverner'));
    expect(g.breakdown.boss.count).toBe(1);
    // Truhe in der eroberten Region ist noch zu holen
    await travel('arverner-g', g);
    g = await game();
    const c = await openChest('arverner-g', g);
    expect(c.loot.length + c.denare).toBeGreaterThan(0);
    g = await game();
    expect(g.world.state.opened.has('arverner-g')).toBe(true);
    expect(g.bonusDenare).toBeGreaterThanOrEqual(c.denare);
  });
});
