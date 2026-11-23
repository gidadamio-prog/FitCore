import { describe, expect, it } from 'vitest';
import { ITEMS, SLOTS, appearanceStage, defaultLoadout, equipItem, inventory, itemById, itemFile, normalizeLoadout, portraitFile, setAura, starterPurchaseId } from '@/domain/equipment';
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
const allBadges = (tier: BadgeStatus['tier'] = null) =>
  [...new Set(ITEMS.filter((i) => i.source.kind === 'badge').map((i) => (i.source as { badgeId: string }).badgeId))].map((id) => badge(id, tier));

describe('Katalog', () => {
  it('23 Start-Teile, 21 Belohnungen, eindeutige IDs und Dateinamen', () => {
    expect(ITEMS.filter((i) => i.source.kind === 'starter')).toHaveLength(23);
    expect(ITEMS.filter((i) => i.source.kind === 'badge')).toHaveLength(21);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const i of ITEMS) expect(itemFile(i)).toMatch(/^(haupthand|nebenhand|helm|haende|hose|schuhe)_[a-z0-9-]+$/);
    expect(itemFile(itemById('gladius-bestleistung')!)).toBe('haupthand_gladius-bestleistung');
  });
  it('jede Klasse hat ein vollständiges Set; Gladiator mit Zweihandwaffe ohne Nebenhand', () => {
    for (const c of ['legionar', 'cursor', 'strategos'] as const) expect(Object.keys(defaultLoadout(c))).toHaveLength(6);
    const g = defaultLoadout('gladiator');
    expect(g.off).toBeUndefined();
    expect(itemById(g.main)?.twoHanded).toBe(true);
  });
  it('jede Set-Kategorie lässt sich mit drei Teilen in verschiedenen Slots erreichen', () => {
    for (const c of ['kraft', 'ausdauer', 'ernaehrung', 'disziplin', 'ruhm']) {
      const slots = new Set(ITEMS.filter((i) => i.category === c).map((i) => i.slot));
      expect(slots.size, c).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Seltenheit und Rangbindung', () => {
  it('ohne Abzeichen gesperrt, Bronze = Selten ab Rang 1', () => {
    const inv = inventory(allBadges(null), 'legionar', 1, []);
    expect(inv.find((o) => o.def.id === 'gladius-bestleistung')).toMatchObject({ unlocked: null, worn: null });
    const inv2 = inventory(allBadges('bronze'), 'legionar', 1, []);
    expect(inv2.find((o) => o.def.id === 'gladius-bestleistung')).toMatchObject({ unlocked: 'rare', worn: 'rare', rankLocked: null });
  });
  it('Gold freigeschaltet, aber als Novize nur Selten tragbar; Episch ab Optio, Legendär ab Primus Pilus', () => {
    const at = (rank: number) => inventory(allBadges('gold'), 'legionar', rank, []).find((o) => o.def.id === 'gladius-bestleistung')!;
    expect(at(1)).toMatchObject({ unlocked: 'legendary', worn: 'rare', rankLocked: 'epic' });
    expect(at(5)).toMatchObject({ worn: 'epic', rankLocked: 'legendary' });
    expect(at(7)).toMatchObject({ worn: 'legendary', rankLocked: null });
  });
  it('Start-Teile: eigene Klasse sofort, fremde nur gekauft; Studio-Teile nur mit Studio-Abzeichen', () => {
    const inv = inventory([], 'cursor', 1, [starterPurchaseId('scutum')]);
    expect(inv.find((o) => o.def.id === 'botenstab')?.worn).toBe('common');
    expect(inv.find((o) => o.def.id === 'scutum')?.worn).toBe('common');
    expect(inv.find((o) => o.def.id === 'gladius')?.worn).toBeNull();
    expect(inv.some((o) => o.def.id === 'hantelscheiben-schild')).toBe(false);
  });
});

describe('Zweihand-Regel und Ausrüstung', () => {
  const inv = inventory(allBadges('bronze'), 'legionar', 3, []);
  const base = normalizeLoadout(undefined, inv, 'legionar');
  it('Standard = Start-Set, ungültige oder fremde Teile fallen weg', () => {
    expect(base).toEqual({ main: 'gladius', off: 'scutum', head: 'galea', hands: 'manicae', legs: 'bracae', feet: 'caligae' });
    expect(normalizeLoadout({ main: 'dreizack', head: 'scutum' }, inv, 'legionar')).toMatchObject({ main: null, head: null, off: 'scutum' });
  });
  it('Zweihandwaffe legt die Nebenhand ab', () => {
    const r = equipItem(base, itemById('hammer-atlas')!, inv, 'legionar');
    expect(r.loadout).toMatchObject({ main: 'hammer-atlas', off: null });
    expect(r.notice).toContain('Scutum');
  });
  it('Nebenhand bei Zweihandwaffe tauscht auf eine Einhandwaffe', () => {
    const two = equipItem(base, itemById('hammer-atlas')!, inv, 'legionar').loadout;
    const r = equipItem(two, itemById('amphore-aquaedukt')!, inv, 'legionar');
    expect(r.loadout).toMatchObject({ main: 'gladius', off: 'amphore-aquaedukt' });
  });
  it('gesperrte oder zu hohe Teile lassen sich nicht anlegen; gespeicherte Zweihand-Kombination wird repariert', () => {
    const none = inventory(allBadges(null), 'legionar', 1, []);
    expect(() => equipItem(base, itemById('hammer-atlas')!, none, 'legionar')).toThrow(/nicht freigeschaltet/);
    expect(normalizeLoadout({ main: 'hammer-atlas', off: 'scutum' }, inv, 'legionar')).toMatchObject({ main: 'hammer-atlas', off: null });
  });
  it('Set-Aura bei drei Teilen einer Kategorie', () => {
    const l = { ...base, off: 'amphore-aquaedukt', head: 'traubenkrone', hands: 'shaker-handschuhe' };
    expect(setAura(l)).toBe('ernaehrung');
    expect(setAura(base)).toBeNull();
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
  it('sechs Slots in fester Reihenfolge', () => expect(SLOTS.map((s) => s.id)).toEqual(['main', 'off', 'head', 'hands', 'legs', 'feet']));
});
