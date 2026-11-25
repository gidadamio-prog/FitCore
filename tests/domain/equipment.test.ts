import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { ITEMS, SLOTS, appearanceStage, bossOfRegionId, defaultLoadout, equipItem, inventory, itemById, itemFile, normalizeLoadout, portraitFile } from '@/domain/equipment';
import { BADGE_WEAPONS, WEAPONS, isBuyable, minRankForQuality, pickWeapon, weaponById, weaponId, weaponLootIds, weaponStats } from '@/domain/weapons';
import { secretAchievements } from '@/domain/achievements';
import { computeGame, questsForWeek, type BadgeStatus, type DayFacts, type GameInput } from '@/domain/gamification';
import { emptyDayFacts } from '@/domain/gamification';
import { CLASS_TRAINING, PATHS, denare, pathForGoal } from '@/domain/rpg';
import { PLAN_TEMPLATES } from '@/data/planTemplates';
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary';
import { addDays } from '@/domain/dates';
import type { GoalVersion } from '@/domain/types';
import { ex, set, workout } from './fixtures';

const badge = (id: string, tier: BadgeStatus['tier']): BadgeStatus => ({ id, name: id, description: (t) => `${t}`, tiers: [1, 2, 3], value: 0, tier, nextTarget: null });
const allBadges = (tier: BadgeStatus['tier'] = null) => Object.keys(BADGE_WEAPONS).map((id) => badge(id, tier));
const W = weaponId;

describe('Katalog', () => {
  it('100 Waffen (90 in Reihen, 10 Boss-Waffen), 180 Rüstungsteile, eindeutige IDs, jede Waffe hat ein Bild', () => {
    expect(ITEMS.filter((i) => i.source.kind === 'weapon')).toHaveLength(100);
    expect(WEAPONS.filter((w) => w.boss)).toHaveLength(10);
    expect(ITEMS.filter((i) => i.source.kind === 'armor')).toHaveLength(180);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const w of WEAPONS) expect(existsSync(`src/assets/rpg/${w.file}.webp`), w.file).toBe(true);
    for (const i of ITEMS) expect(itemFile(i)).toMatch(/^waffe_[a-z]+_\d\d(_R)?$|^ruestung_\d\d_(kopf|brust|arm_l|hose|stiefel_l)$/);
  });
  it('Qualität: 10er-Reihen 0–9, 5er-Reihen 0/2/5/7/9; Werte steigen mit der Stufe', () => {
    expect(WEAPONS.filter((w) => w.art === 'schwert').map((w) => w.q)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(WEAPONS.filter((w) => w.art === 'axt').map((w) => w.q)).toEqual([0, 2, 5, 7, 9]);
    const atk = WEAPONS.filter((w) => w.art === 'schwert').map((w) => weaponStats(w).atk!);
    for (let k = 1; k < atk.length; k++) expect(atk[k]).toBeGreaterThan(atk[k - 1]!);
    expect(weaponStats(weaponById(W('streitaxt', 0))!).atk).toBeGreaterThan(weaponStats(weaponById(W('schwert', 0))!).atk!);
    expect(weaponStats(weaponById(W('buch', 0))!)).toMatchObject({ atk: expect.any(Number), def: expect.any(Number) });
  });
  it('jede Klasse startet mit Stufe-I-Waffen; Gladiator mit Zweihand-Speer ohne Nebenhand', () => {
    for (const c of ['legionar', 'cursor', 'strategos'] as const) expect(Object.keys(defaultLoadout(c))).toHaveLength(6);
    expect(defaultLoadout('legionar')).toMatchObject({ main: W('schwert', 0), off: W('schild', 0) });
    const g = defaultLoadout('gladiator');
    expect(g.off).toBeUndefined();
    expect(itemById(g.main)?.twoHanded).toBe(true);
  });
});

describe('Freischaltung', () => {
  const inv = (o: { badges?: BadgeStatus[]; rank?: number; purchases?: string[]; loot?: string[]; bosses?: string[] }) => inventory(o.badges ?? [], 'legionar', o.rank ?? 1, o.purchases ?? [], { defeatedBossIds: o.bosses ?? [], loot: o.loot ?? [] });
  const get = (list: ReturnType<typeof inv>, id: string) => list.find((x) => x.def.id === id)!;
  it('Start-Waffen der eigenen Klasse sofort, fremde gesperrt mit Hinweis auf Markt und Beute', () => {
    const l = inv({});
    expect(get(l, W('schwert', 0)).worn).toBe('common');
    expect(get(l, W('dolch', 0))).toMatchObject({ worn: null });
    expect(get(l, W('dolch', 0)).hint).toMatch(/Markt · \d+ Denare · Beute ab Arvernerhöhen/);
    expect(get(l, W('schwert', 9)).hint).toMatch(/Beute ab/);
    expect(get(l, W('schwert', 9)).hint).not.toMatch(/Markt/);
  });
  it('Kauf, Beute, Abzeichen (Bronze/Silber/Gold) und Boss schalten frei', () => {
    expect(get(inv({ purchases: [W('dolch', 0)] }), W('dolch', 0)).worn).toBe('common');
    expect(get(inv({ loot: [W('axt', 1)] }), W('axt', 1)).worn).toBe('common');
    const silver = inv({ badges: allBadges('silver') });
    expect(get(silver, W('schwert', 2)).worn).toBeTruthy();
    expect(get(silver, W('schwert', 5)).worn).toBe('rare');
    expect(get(silver, W('schwert', 8)).worn).toBeNull();
    const falx = WEAPONS.find((w) => w.boss?.region === 'drachenberge')!;
    expect(get(inv({}), falx.id).hint).toMatch(/Beute von/);
    expect(get(inv({ bosses: [bossOfRegionId('drachenberge')] }), falx.id).worn).toBe('legendary');
  });
  it('Markt: Stufe I ab Rang 1, Stufe II ab Rang 3 … höchstens Stufe V; Boss-Waffen nie', () => {
    expect(minRankForQuality(0)).toBe(1);
    expect(minRankForQuality(1)).toBe(3);
    expect(WEAPONS.filter(isBuyable).every((w) => w.q <= 4)).toBe(true);
    expect(WEAPONS.filter((w) => w.boss).some(isBuyable)).toBe(false);
  });
  it('Beute: Startgebiet nur Stufe I–III, die höchste nur bei Elite/Truhe/Boss; nichts doppelt', () => {
    const qs = (ids: string[]) => [...new Set(ids.map((id) => weaponById(id)!.q))].sort();
    expect(qs(weaponLootIds(0, 'gegner'))).toEqual([0, 1]);
    expect(qs(weaponLootIds(0, 'elite'))).toEqual([0, 1, 2]);
    expect(Math.max(...weaponLootIds(11, 'boss').map((id) => weaponById(id)!.q))).toBe(9);
    const ctx = { classId: 'legionar' as const, purchases: [], loot: [], defeatedBossIds: [], badgeTiers: {}, bossOfRegion: bossOfRegionId };
    for (let i = 0; i < 50; i++) expect(pickWeapon(weaponLootIds(0, 'elite'), ctx, i / 50)).not.toBe(W('schwert', 0));
  });
});

describe('Zweihand-Regel und Ausrüstung', () => {
  const inv = inventory(allBadges('gold'), 'legionar', 3, [W('streitaxt', 0)]);
  const base = normalizeLoadout(undefined, inv, 'legionar');
  it('Standard = Start-Set, ungültige, fremde oder alte Waffen fallen weg', () => {
    expect(base).toEqual({ main: W('schwert', 0), off: W('schild', 0), head: null, chest: 'armor-00-chest', hands: 'armor-00-hands', legs: 'armor-00-legs', feet: 'armor-00-feet' });
    expect(normalizeLoadout({ main: W('dolch', 9), head: W('schild', 0) }, inv, 'legionar')).toMatchObject({ main: null, head: null, off: W('schild', 0) });
    // alte Waffen (vor 1.25) fallen auf die Start-Waffen zurück
    expect(normalizeLoadout({ main: 'gladius', off: 'scutum' }, inv, 'legionar')).toMatchObject({ main: W('schwert', 0), off: W('schild', 0) });
  });
  it('Zweihandwaffe legt die Nebenhand ab', () => {
    const r = equipItem(base, itemById(W('streitaxt', 0))!, inv, 'legionar');
    expect(r.loadout).toMatchObject({ main: W('streitaxt', 0), off: null });
    expect(r.notice).toContain('Holzschild');
  });
  it('Nebenhand bei Zweihandwaffe tauscht auf die Start-Einhandwaffe', () => {
    const two = equipItem(base, itemById(W('streitaxt', 0))!, inv, 'legionar').loadout;
    const r = equipItem(two, itemById(W('buch', 2))!, inv, 'legionar');
    expect(r.loadout).toMatchObject({ main: W('schwert', 0), off: W('buch', 2) });
  });
  it('gesperrte Teile lassen sich nicht anlegen; gespeicherte Zweihand-Kombination wird repariert', () => {
    expect(() => equipItem(base, itemById(W('bogen', 4))!, inv, 'legionar')).toThrow(/nicht freigeschaltet/);
    expect(normalizeLoadout({ main: W('streitaxt', 0), off: W('schild', 0) }, inv, 'legionar')).toMatchObject({ main: W('streitaxt', 0), off: null });
  });
});

describe('Erscheinungsbild', () => {
  it('fünf Stufen, je zwei Ränge', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(appearanceStage)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(portraitFile('legionar', 3)).toBe('portraet_legionaer_stufe3');
    expect(portraitFile('strategos', 5)).toBe('portraet_stratege_stufe5');
  });
});

describe('Klasse, Lebensweg, Denare', () => {
  it('empfohlene Vorlagen existieren', () => {
    const ids = new Set(PLAN_TEMPLATES.map((t) => t.id));
    for (const c of Object.values(CLASS_TRAINING)) for (const t of c.templates) expect(ids.has(t), t).toBe(true);
  });
  it('Klassen-Feldzug zählt passend zur Klasse', () => {
    const facts = new Map<string, DayFacts>();
    const f = (date: string, o: Partial<DayFacts>): DayFacts => ({ ...emptyDayFacts(date), ...o });
    facts.set('2026-03-02', f('2026-03-02', { workouts: 1, cardioMin: 60, cardioSessions: 1, proteinHit: true, waterHit: true }));
    facts.set('2026-03-03', f('2026-03-03', { workouts: 1, cardioMin: 70, cardioSessions: 1 }));
    const base = { activePlan: undefined, trainingDaysPerWeek: 3, homeGym: undefined, today: '2026-03-08' };
    const get = (c: 'legionar' | 'gladiator' | 'cursor' | 'strategos') => questsForWeek('2026-03-02', facts, [], { ...base, heroClass: c }).find((q) => q.id.startsWith('class-'))!;
    expect(get('legionar')).toMatchObject({ progress: 2, target: 3, done: false });
    expect(get('gladiator')).toMatchObject({ progress: 4, target: 4, done: true });
    expect(get('cursor')).toMatchObject({ progress: 120, done: true });
    expect(get('strategos')).toMatchObject({ progress: 1, target: 5 });
    expect(questsForWeek('2026-03-02', facts, [], base).some((q) => q.id.startsWith('class-'))).toBe(false);
  });
  it('Lebensweg aus dem Ernährungsziel', () => {
    expect(pathForGoal('lose_weight')).toBe('asket');
    expect(pathForGoal('recomp')).toBe('stoiker');
    expect(pathForGoal('build_muscle')).toBe('epikureer');
    expect(PATHS.map((p) => p.goal)).toEqual(['reduce_fat', 'recomp', 'build_muscle']);
  });
  it('Denare: Erfolgs-Bonus und Start-Teile im Preis', () => {
    expect(denare(1000, ['item-scutum'], 50, { 'item-scutum': 150 })).toEqual({ earned: 150, spent: 150, balance: 0 });
  });
});

describe('Geheime Erfolge', () => {
  const goal = { id: 1, effectiveFrom: '2026-01-01', calorieTarget: 2000, proteinG: 150 } as GoalVersion;
  const input = (over: Partial<GameInput>): GameInput => ({
    today: '2026-06-30', entries: [], goals: [goal], workouts: [], cardio: [], measurements: [], water: [], recovery: [], recipesCount: 0, exercises: EXERCISE_LIBRARY, trainingDaysPerWeek: 3, waterGoalMl: 2500, ...over,
  });
  it('Frühaufsteher (lokale Zeit vor 7 Uhr) und Doppelschicht', () => {
    const d = new Date(2026, 2, 3, 6, 30).toISOString();
    const w = workout('1', '2026-03-03', [ex('bench-press', [set(60, 10)])], { startedAt: d });
    const g = computeGame(input({ workouts: [w], cardio: [{ id: 1, date: '2026-03-03', type: 'run', durationMin: 30, distanceKm: 5, kcal: 300, source: 'manual', createdAt: '' } as never] }));
    const s = new Map(g.secrets.map((x) => [x.id, x]));
    expect(s.get('fruehaufsteher')).toMatchObject({ achieved: true, date: '2026-03-03' });
    expect(s.get('doppelschicht')).toMatchObject({ achieved: true });
    expect(g.bonusDenare).toBe(100);
  });
  it('Säulen des Reiches: 8 Wochen in Folge Beine, Lücke setzt zurück', () => {
    const legs = (k: number) => workout('l' + k, addDays('2026-01-05', k * 7), [ex('squat', [set(80, 5)], 'Quadrizeps')], { startedAt: addDays('2026-01-05', k * 7) + 'T17:00:00' });
    const seven = Array.from({ length: 7 }, (_, k) => legs(k));
    const r7 = secretAchievements({ workouts: seven, facts: new Map(), prs: [], comebacks: [], today: '2026-06-30' }).find((x) => x.id === 'beinfreund')!;
    expect(r7).toMatchObject({ achieved: false, progress: { value: 7, target: 8 } });
    const eight = [...seven, legs(7)];
    expect(secretAchievements({ workouts: eight, facts: new Map(), prs: [], comebacks: [], today: '2026-06-30' }).find((x) => x.id === 'beinfreund')!.achieved).toBe(true);
    const gap = [...seven, legs(8)];
    expect(secretAchievements({ workouts: gap, facts: new Map(), prs: [], comebacks: [], today: '2026-06-30' }).find((x) => x.id === 'beinfreund')!.achieved).toBe(false);
  });
  it('Wiedersehen und Stoiker', () => {
    const facts = new Map<string, DayFacts>();
    for (let k = 0; k < 30; k++) {
      const d = addDays('2026-04-01', k);
      facts.set(d, { date: d, caloriesHit: true } as DayFacts);
    }
    const r = secretAchievements({ workouts: [], facts, prs: [{ date: '2026-05-12' } as never], comebacks: ['2026-05-10'], today: '2026-06-30' });
    expect(r.find((x) => x.id === 'stoiker')).toMatchObject({ achieved: true, date: '2026-04-30' });
    expect(r.find((x) => x.id === 'wiedersehen')).toMatchObject({ achieved: true, date: '2026-05-12' });
    facts.delete('2026-04-15');
    expect(secretAchievements({ workouts: [], facts, prs: [], comebacks: [], today: '2026-06-30' }).find((x) => x.id === 'stoiker')!.achieved).toBe(false);
  });
});

describe('SLOTS', () => {
  it('sieben Slots in fester Reihenfolge', () => expect(SLOTS.map((s) => s.id)).toEqual(['main', 'off', 'head', 'chest', 'hands', 'legs', 'feet']));
});
