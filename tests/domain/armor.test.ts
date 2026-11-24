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
