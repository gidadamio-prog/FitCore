import { describe, expect, it } from 'vitest';
import { MAX_FORGE_LEVEL, PITY, canAfford, dismantleGain, effectiveLists, forgeFactor, forgeLevels, lootDrought, matBalance, matText, matsFor, upgradeCost, type ForgeEvent } from '@/domain/forge';
import { itemStats } from '@/domain/combat';
import type { WorldEvent } from '@/domain/world';

const at = '2026-01-01T10:00:00Z';
const fightEv = (loot: string[], mats = {}, won = true): WorldEvent => ({ k: 'fight', at, date: '2026-01-01', node: 'arverner-a', ap: 2, won, loot, denare: 5, mats });

describe('Schmiede', () => {
  it('Kosten: +1…+3 Eisen, +4…+6 Silber, +7…+9 Gold, +10 Gold + Reliquie; Boss-Teile ab +6 mit Reliquie', () => {
    expect(upgradeCost(1, false)).toEqual({ eisen: 2 });
    expect(upgradeCost(3, false)).toEqual({ eisen: 4 });
    expect(upgradeCost(4, false)).toEqual({ eisen: 3, silber: 1 });
    expect(upgradeCost(7, false)).toEqual({ silber: 2, gold: 1 });
    expect(upgradeCost(10, false)).toEqual({ gold: 4, reliquie: 1 });
    expect(upgradeCost(5, true).reliquie).toBeUndefined();
    expect(upgradeCost(6, true).reliquie).toBe(1);
    expect(upgradeCost(10, true).reliquie).toBe(2);
    expect(MAX_FORGE_LEVEL).toBe(10);
  });
  it('Werte: +6 % je Stufe auf Angriff und Abwehr', () => {
    expect(forgeFactor(10)).toBeCloseTo(1.6);
    expect(itemStats('waffe-schwert-09', 'legendary', 0).atk).toBe(25);
    expect(itemStats('waffe-schwert-09', 'legendary', 10).atk).toBe(40);
    expect(itemStats('armor-25-chest', 'epic', 5).def).toBeCloseTo(7 * 1.6 * 1.3, 1);
  });
  it('Material: Bestand aus Karte und Zerlegen minus Verbesserungen; Stufe fällt beim Zerlegen weg', () => {
    const world = [fightEv([], { eisen: 2 }), fightEv([], { eisen: 1, silber: 1 })];
    const forge: ForgeEvent[] = [
      { k: 'upgrade', at, id: 'waffe-schwert-00', to: 1, cost: { eisen: 2 } },
      { k: 'dismantle', at, id: 'armor-02-legs', gain: { eisen: 2 } },
    ];
    expect(matBalance(world, forge)).toEqual({ eisen: 3, silber: 1, gold: 0, reliquie: 0 });
    expect(forgeLevels(forge).get('waffe-schwert-00')).toBe(1);
    expect(forgeLevels([...forge, { k: 'dismantle', at, id: 'waffe-schwert-00', gain: {} }]).has('waffe-schwert-00')).toBe(false);
    expect(canAfford({ eisen: 3 }, { eisen: 3 })).toBe(true);
    expect(canAfford({ eisen: 3 }, { silber: 1 })).toBe(false);
    expect(matText({ eisen: 2, silber: 0, gold: 1 })).toBe('2 Eisen, 1 Gold');
  });
  it('Zerlegen: nach Seltenheit, investierte Stufen geben etwas zurück; nimmt ein Exemplar (zuerst Beute)', () => {
    expect(dismantleGain('common', 0)).toEqual({ eisen: 2 });
    expect(dismantleGain('legendary', 0)).toEqual({ gold: 2 });
    expect(dismantleGain('common', 4).eisen).toBe(4);
    expect(effectiveLists(['a', 'b', 'a'], ['a', 'c'], ['a', 'a', 'c'])).toEqual({ loot: ['b'], purchases: ['a'] });
  });
  it('Fundorte: höhere Regionen edleres Material, Boss gibt Reliquie; reproduzierbar', () => {
    expect(matsFor('gegner', 0, 'k1')).toEqual(matsFor('gegner', 0, 'k1'));
    let silver0 = 0;
    let silver8 = 0;
    for (let i = 0; i < 200; i++) {
      silver0 += matsFor('gegner', 0, `x${i}`).silber ?? 0;
      silver8 += matsFor('gegner', 8, `x${i}`).silber ?? 0;
    }
    expect(silver0).toBe(0);
    expect(silver8).toBeGreaterThan(30);
    expect(matsFor('boss', 3, 'b')).toMatchObject({ reliquie: 1, gold: 2 });
  });
  it('Pech-Ausgleich zählt leere Siege und Truhen seit der letzten Beute (Niederlagen zählen nicht)', () => {
    expect(PITY).toBe(5);
    expect(lootDrought([fightEv(['x']), fightEv([]), fightEv([], {}, false), fightEv([])])).toBe(2);
    expect(lootDrought([fightEv([]), fightEv([]), fightEv([]), fightEv([])])).toBe(4);
  });
});
