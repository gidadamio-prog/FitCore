import { describe, expect, it } from 'vitest';
import { AP_CAP, AP_START, MAP_H, MAP_W, REGIONS, START_NODE, WORLD, apBalance, blocks, capitalOf, findPath, foeAvailable, neighbors, nodeById, regionAccess, replayWorld, revealed, type WorldEvent } from '@/domain/world';
import { foeFor, heroStats, power, recommendedPower, referenceHero, simulateFight, winChance, SIEGE_CAP } from '@/domain/combat';
import { CAMPAIGN } from '@/domain/rpg';

const init = (pos = START_NODE, conquered: { region: string; date: string }[] = []): WorldEvent => ({ k: 'init', at: '2026-11-24T08:00:00Z', date: '2026-11-24', pos, conquered });
const move = (path: string[], date = '2026-11-24'): WorldEvent => ({ k: 'move', at: date + 'T09:00:00Z', date, path, ap: path.length });

describe('Welt', () => {
  it('12 Regionen mit Boss, aufsteigenden Stufen und zusammenhängendem Wegenetz', () => {
    expect(REGIONS.map((r) => r.bossId)).toEqual(CAMPAIGN.map((b) => b.id));
    expect(REGIONS.map((r) => r.minLevel)).toEqual([...REGIONS.map((r) => r.minLevel)].sort((a, b) => a - b));
    const seen = new Set([START_NODE]);
    const q = [START_NODE];
    while (q.length)
      for (const n of neighbors(q.shift()!))
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
    expect(seen.size).toBe(WORLD.nodes.length);
    expect(new Set(WORLD.nodes.map((n) => n.id)).size).toBe(WORLD.nodes.length);
    for (const r of REGIONS) expect(nodeById(capitalOf(r.id))?.type).toBe('hauptstadt');
  });
  it('Kartenbild: alle Orte auf der Karte, mit Abstand zueinander, gemalte Orte benannt', () => {
    for (const n of WORLD.nodes) {
      expect(n.x).toBeGreaterThan(40);
      expect(n.x).toBeLessThan(MAP_W - 40);
      expect(n.y).toBeGreaterThan(40);
      expect(n.y).toBeLessThan(MAP_H - 40);
    }
    for (const a of WORLD.nodes) for (const b of WORLD.nodes) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThan(50);
    const names = WORLD.nodes.map((n) => n.name);
    for (const t of ['Hügelfurt', 'Finsterhain', 'Nebelhafen', 'Weidmark', 'Drachenpass', 'Löwenrast', 'Deltahafen', 'Felswacht', 'Dünenrast', 'Steppenlager', 'Kaiservorstadt']) expect(names).toContain(t);
    expect(neighbors('dunkelwald-h')).toContain('nebelinseln-a');
  });
  it('Nebel: nur Besuchtes und direkte Nachbarn', () => {
    const s = replayWorld([init()]);
    expect([...revealed(s)].sort()).toEqual([START_NODE, 'arverner-a'].sort());
  });
  it('Gegner blockiert, bis er besiegt ist; Rückzug erlaubt', () => {
    let s = replayWorld([init(), move(['arverner-a'])]);
    expect(blocks(s, 'arverner-a')).toBe(true);
    expect(findPath(s, 'arverner-b', 1)).toEqual({ error: expect.stringContaining('Besiege zuerst') });
    expect(findPath(s, START_NODE, 1)).toEqual({ path: [START_NODE] });
    s = replayWorld([init(), move(['arverner-a']), { k: 'fight', at: '2026-11-24T10:00:00Z', date: '2026-11-24', node: 'arverner-a', ap: 2, won: true, loot: [], denare: 5 }]);
    expect(findPath(s, 'arverner-b', 1)).toEqual({ path: ['arverner-b'] });
    expect(foeAvailable(s, 'arverner-a', '2026-11-27')).toBe(false);
    expect(foeAvailable(s, 'arverner-a', '2026-12-01')).toBe(true); // kehrt nach 7 Tagen zurück
    expect(s.denare).toBe(5);
  });
  it('Regionen: erst nach dem vorigen Boss und ab Mindeststufe', () => {
    const s = replayWorld([init(capitalOf('arverner'), [{ region: 'arverner', date: '2026-11-01' }])]);
    expect(regionAccess(s, 'dunkelwald', 2)).toEqual({ ok: false, reason: 'Ab Heldenstufe 3' });
    expect(regionAccess(s, 'dunkelwald', 3).ok).toBe(true);
    expect(regionAccess(s, 'nebelinseln', 30).reason).toContain('Arminius');
    expect(findPath(s, 'dunkelwald-a', 2)).toEqual({ error: 'Ab Heldenstufe 3' });
    expect(findPath(s, 'dunkelwald-a', 3)).toEqual({ path: ['dunkelwald-a'] });
    // Übernommene Region ist aufgedeckt und frei
    expect(s.visited.has('arverner-e')).toBe(true);
    expect(blocks(s, 'arverner-e')).toBe(false);
  });
  it('AP: Start 5, Speicher max. 15, am selben Tag Verdientes geht nicht verloren', () => {
    const earned = new Map([['2026-11-24', 4], ['2026-11-25', 20], ['2026-11-26', 3]]);
    expect(apBalance('2026-11-24', earned, new Map(), '2026-11-24').balance).toBe(AP_START + 4);
    expect(apBalance('2026-11-24', earned, new Map(), '2026-11-25').balance).toBe(AP_CAP);
    expect(apBalance('2026-11-24', earned, new Map([['2026-11-26', 5]]), '2026-11-26').balance).toBe(AP_CAP - 2);
    expect(apBalance(null, earned, new Map(), '2026-11-26').balance).toBe(0);
  });
});

describe('Kampf', () => {
  it('Referenz-Held schlägt Trupps sicher, Elite verlangt passende Ausrüstung', () => {
    for (let i = 0; i < REGIONS.length; i++) {
      const r = REGIONS[i]!;
      expect(winChance(referenceHero(i), foeFor(r.id, 'gegner', 'x')), r.id).toBeGreaterThan(0.9);
      expect(winChance(referenceHero(i), foeFor(r.id, 'elite', 'x')), r.id).toBeGreaterThan(0.8);
    }
    expect(winChance(referenceHero(3), foeFor('drachenberge', 'elite', 'x'))).toBeLessThan(0.3);
    expect(recommendedPower('kaiserstadt')).toBeGreaterThan(recommendedPower('arverner'));
  });
  it('Boss: höchstens ein Viertel pro Angriff → mindestens 4 Angriffe, Referenz braucht ~6', () => {
    const b = foeFor('arverner', 'hauptstadt', 'Vercingetorix');
    const strong = { atk: 500, def: 500, hp: 5000 };
    const f = simulateFight(strong, b, 's');
    expect(f.dealt).toBe(Math.ceil(b.hp * SIEGE_CAP));
    let hp = b.hp;
    let n = 0;
    while (hp > 0 && n < 20) hp = simulateFight(referenceHero(0), b, `s${n++}`, { foeHp: hp }).foeHpEnd;
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(8);
  });
  it('Heldenwerte: Stufe, Waffe, Schild und Rüstung; Kampfgeist +15 % Angriff', () => {
    const naked = heroStats(1, {}, () => null);
    const geared = heroStats(1, { main: 'waffe-schwert-00', off: 'waffe-schild-00', chest: 'armor-25-chest' }, () => 'common');
    expect(geared.atk).toBeGreaterThan(naked.atk);
    expect(geared.def).toBeGreaterThan(naked.def + 10);
    expect(power(geared)).toBeGreaterThan(power(naked));
    const foe = foeFor('arverner', 'gegner', 'x');
    expect(simulateFight(geared, foe, 'k', { kampfgeist: true }).blows[0]!.dmg).toBeGreaterThanOrEqual(simulateFight(geared, foe, 'k').blows[0]!.dmg);
    expect(simulateFight(geared, foe, 'same').blows).toEqual(simulateFight(geared, foe, 'same').blows);
  });
});
