import { describe, expect, it } from 'vitest';
import { ARMOR_SETS, BOSS_SETS, RANK_SETS, armorItemId, armorPrice, fullArmorSet, ownsArmorPiece, parseArmorId, rollLoot, type ArmorContext } from '@/domain/armor';
import { inventory, itemById } from '@/domain/equipment';
import { ARMOR_ASPECT, ARMOR_BODY, ARMOR_HEAD } from '@/domain/armorLayout';
import { CAMPAIGN } from '@/domain/rpg';

const ctx = (o: Partial<ArmorContext> = {}): ArmorContext => ({ rankLevel: 1, defeatedBossIds: [], loot: [], purchases: [], ...o });

describe('Rüstungs-Sets', () => {
  it('36 Sets der Reihe nach: 10 Stoff, 10 Leder, 10 Schwer, 6 Boss; Namen wie „Legionärs-Helm“', () => {
    expect(ARMOR_SETS.map((s) => s.cls).join(',')).toBe([...Array(10).fill('stoff'), ...Array(10).fill('leder'), ...Array(10).fill('schwer'), ...Array(6).fill('boss')].join(','));
    expect(itemById(armorItemId(25, 'head'))?.name).toBe('Legionärs-Helm');
    expect(parseArmorId('armor-25-chest')).toMatchObject({ slot: 'chest' });
    expect(parseArmorId('galea')).toBeNull();
  });
  it('jede Ebene hat Lage und Seitenverhältnis, jeder Körper Ankerpunkte', () => {
    expect(ARMOR_HEAD).toHaveLength(36);
    expect(Object.keys(ARMOR_BODY)).toHaveLength(12);
    for (let i = 0; i < 36; i++) for (const p of ['kopf', 'brust', 'hose', 'arm_l', 'arm_r', 'stiefel_l', 'stiefel_r']) expect(ARMOR_ASPECT[`ruestung_${String(i).padStart(2, '0')}_${p}`], `${i} ${p}`).toBeGreaterThan(0);
  });
  it('Start-Set sofort, Rang- und Boss-Sets komplett, Boss-Sets nur durch Bosse', () => {
    expect(ownsArmorPiece('armor-00-head', ctx())).toBe(true);
    expect(ownsArmorPiece(armorItemId(RANK_SETS[5]!, 'chest'), ctx({ rankLevel: 4 }))).toBe(false);
    expect(ownsArmorPiece(armorItemId(RANK_SETS[5]!, 'chest'), ctx({ rankLevel: 5 }))).toBe(true);
    expect(ownsArmorPiece(armorItemId(BOSS_SETS.africa!, 'feet'), ctx({ defeatedBossIds: ['africa'] }))).toBe(true);
    expect(Object.keys(BOSS_SETS).filter((b) => b !== 'limes-1').every((b) => CAMPAIGN.some((c) => c.id === b))).toBe(true);
    expect(ARMOR_SETS.filter((s) => s.cls === 'boss').every((s) => Object.values(BOSS_SETS).includes(s.idx))).toBe(true);
  });
  it('Preise steigen mit Klasse und Stufe; Kauf und Beute zählen als Besitz', () => {
    expect(armorPrice(ARMOR_SETS[0]!)).toBe(40);
    expect(armorPrice(ARMOR_SETS[19]!)).toBeGreaterThan(armorPrice(ARMOR_SETS[9]!));
    expect(ownsArmorPiece('armor-05-legs', ctx({ purchases: ['armor-05-legs'] }))).toBe(true);
    expect(ownsArmorPiece('armor-06-legs', ctx({ loot: ['armor-06-legs'] }))).toBe(true);
  });
  it('Beute: reproduzierbar, nur Erlaubtes und noch nicht Besessenes; je Boss-Sieg ein sicheres Teil', () => {
    const c = ctx({ rankLevel: 2 });
    const a = rollLoot('100-250', 2, c);
    expect(a).toEqual(rollLoot('100-250', 2, c));
    expect(a.length).toBeGreaterThanOrEqual(2);
    for (const id of a) {
      const p = parseArmorId(id)!;
      expect(p.set.cls).toBe('stoff'); // Rang 2: nur Stoff
      expect(ownsArmorPiece(id, c)).toBe(false);
    }
    let drops = 0;
    for (let i = 0; i < 400; i++) drops += rollLoot(`k${i}`, 0, c).length;
    expect(drops / 400).toBeGreaterThan(0.25);
    expect(drops / 400).toBeLessThan(0.45);
  });
  it('Inventar: Rüstung ohne Rangsperre, Hinweis für Gesperrtes; Set-Bonus nur bei allen 5 Teilen', () => {
    const inv = inventory([], 'legionar', 1, [], { defeatedBossIds: [], loot: [], rankName: (l) => `R${l}`, bossName: (b) => b });
    expect(inv.find((o) => o.def.id === 'armor-00-chest')).toMatchObject({ unlocked: 'common', worn: 'common' });
    expect(inv.find((o) => o.def.id === 'armor-25-head')?.hint).toContain('Set ab Rang R7');
    expect(inv.find((o) => o.def.id === 'armor-33-head')?.hint).toContain('Sieg über africa');
    const full = { head: 'armor-25-head', chest: 'armor-25-chest', hands: 'armor-25-hands', legs: 'armor-25-legs', feet: 'armor-25-feet' };
    expect(fullArmorSet(full)?.name).toBe('Legionär');
    expect(fullArmorSet({ ...full, feet: 'armor-24-feet' })).toBeNull();
  });
});

import { bonusText, bonusesAt, effectiveStepGoal, setBonuses, updateBonusLog } from '@/domain/armor';
import { computeGame, type GameInput } from '@/domain/gamification';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { ex, set, workout } from './fixtures';

describe('Set-Boni', () => {
  it('jedes Set hat 1 Bonus (Boss 2), Stärke wächst mit der Klasse', () => {
    expect(ARMOR_SETS.every((s) => setBonuses(s).length === (s.cls === 'boss' ? 2 : 1))).toBe(true);
    expect(setBonuses(ARMOR_SETS[1]!).map(bonusText)).toEqual(['Schrittziel −500']);
    expect(setBonuses(ARMOR_SETS[13]!).map(bonusText)).toEqual(['Schrittziel −1.000']);
    expect(setBonuses(ARMOR_SETS[26]!).map(bonusText)).toEqual(['+15 % Schaden gegen Bosse']);
    expect(effectiveStepGoal(4000, setBonuses(ARMOR_SETS[35]!))).toBe(3000); // nie unter 3.000
  });
  it('Verlauf: gleicher Tag überschreibt, Boni gelten erst ab dem Tag des Anlegens', () => {
    let log = updateBonusLog([], 13, '2026-11-20');
    log = updateBonusLog(log, null, '2026-11-22');
    log = updateBonusLog(log, 25, '2026-11-22');
    expect(log).toEqual([{ from: '2026-11-20', setIdx: 13 }, { from: '2026-11-22', setIdx: 25 }]);
    expect(bonusesAt(log, '2026-11-19')).toEqual([]);
    expect(bonusesAt(log, '2026-11-21')[0]).toMatchObject({ kind: 'steps', value: 1000 });
    expect(updateBonusLog(log, 25, '2026-11-24')).toEqual(log);
  });
  it('wirkt im Spielstand: Schrittziel, Trainings-EP, Bossschaden – nur an Tagen mit Set', () => {
    const base = (over: Partial<GameInput>): GameInput => ({
      today: '2026-11-24', entries: [], goals: [], workouts: [], cardio: [], measurements: [], water: [], recovery: [], recipesCount: 0,
      exercises: EXERCISE_LIBRARY, trainingDaysPerWeek: 3, waterGoalMl: 2500, stepGoal: 8000, ...over,
    });
    const steps = [{ id: 'a', date: '2026-11-21', steps: 7200 }, { id: 'b', date: '2026-11-23', steps: 7200 }];
    const log = [{ from: '2026-11-22', setIdx: 13 }]; // Späher: Schrittziel −1.000
    expect(computeGame(base({ recovery: steps })).breakdown.steps.count).toBe(0);
    const g = computeGame(base({ recovery: steps, setBonusLog: log }));
    expect(g.breakdown.steps.count).toBe(1); // nur der 23.
    expect(g.stepGoalToday).toBe(7000);
    const ws = [workout('w1', '2026-11-21', [ex('squat', [set(100, 5)])]), workout('w2', '2026-11-23', [ex('squat', [set(100, 5)])])];
    const plain = computeGame(base({ workouts: ws }));
    const legion = computeGame(base({ workouts: ws, setBonusLog: [{ from: '2026-11-23', setIdx: 29 }] })); // Adlerträger: +15 % Training
    expect(legion.xpByDay.get('2026-11-21')).toBe(plain.xpByDay.get('2026-11-21'));
    expect(legion.xpByDay.get('2026-11-23')).toBeGreaterThan(plain.xpByDay.get('2026-11-23')!);
    const dmg = computeGame(base({ workouts: ws, setBonusLog: [{ from: '2026-11-23', setIdx: 26 }] })); // Zenturio: +15 % Schaden
    expect(dmg.damageByDay.get('2026-11-23')).toBe(Math.round(plain.damageByDay.get('2026-11-23')! * 1.15));
    expect(dmg.damageByDay.get('2026-11-21')).toBe(plain.damageByDay.get('2026-11-21'));
  });
});
