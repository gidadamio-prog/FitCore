import { describe, expect, it } from 'vitest';
import { battlePlan, campaignAt } from '@/domain/battle';
import { CAMPAIGN, bossFile, bossAt, campaign } from '@/domain/rpg';

describe('Kampf – Position im Feldzug', () => {
  it('entspricht der Feldzugs-Berechnung', () => {
    for (const total of [0, 999, 1000, 3499, 3500, 50_000, 200_000]) {
      const c = campaign([{ date: '2026-01-01', dmg: total }]);
      expect(campaignAt(total)).toEqual({ index: c.current.index, boss: c.current.boss, dealt: c.current.dealt, remaining: c.current.remaining });
    }
  });
  it('Bilddateien der Bosse', () => {
    expect(bossFile(CAMPAIGN[0]!)).toBe('boss_vercingetorix');
    expect(bossFile(CAMPAIGN[6]!)).toBe('boss_sobek');
    expect(bossFile(bossAt(CAMPAIGN.length + 2))).toBe('boss_barbarenheer');
  });
});

describe('Kampf – Angriffe', () => {
  it('teilt nach Bereichen, Summe stimmt, stärkster Angriff zuletzt', () => {
    const p = battlePlan(100, 400, { kraft: 200, disziplin: 60, vitalitaet: 10 });
    expect(p.damage).toBe(300);
    expect(p.hits.reduce((a, h) => a + h.dmg, 0)).toBe(300);
    expect(p.hits.map((h) => h.label)).toEqual(['Vitalität', 'Disziplin', 'Kraft']);
    expect(p.hits.at(-1)!.dmg).toBeGreaterThan(p.hits[0]!.dmg);
    expect(p.hits[0]!.hpBefore).toBe(900);
    expect(p.end.remaining).toBe(600);
    expect(p.defeated).toEqual([]);
  });
  it('höchstens 4 Angriffe, ohne Aufteilung ein Angriff', () => {
    expect(battlePlan(0, 100, { kraft: 1, ausdauer: 1, disziplin: 1, vitalitaet: 1, beweglichkeit: 1, rekorde: 1 }).hits).toHaveLength(4);
    expect(battlePlan(0, 100).hits).toEqual([expect.objectContaining({ dmg: 100, label: 'Angriff', kill: false })]);
  });
  it('Todesstoß teilt den Angriff, Rest trifft den nächsten Boss', () => {
    const p = battlePlan(900, 1300, { kraft: 1 });
    expect(p.hits).toEqual([
      expect.objectContaining({ dmg: 100, bossIndex: 0, hpAfter: 0, kill: true }),
      expect.objectContaining({ dmg: 300, bossIndex: 1, hpBefore: 2500, hpAfter: 2200, kill: false }),
    ]);
    expect(p.defeated.map((b) => b.id)).toEqual(['gallia']);
    expect(p.end.boss.id).toBe('germania');
  });
  it('kein negativer Schaden', () => {
    expect(battlePlan(500, 400).damage).toBe(0);
  });
});
