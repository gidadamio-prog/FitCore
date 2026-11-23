// Kampf gegen den Feldzug-Boss: zeigt den Schaden, der seit dem letzten Kampf entstanden ist.
// Der Feldzug selbst wird weiterhin rein aus den Tagesdaten berechnet – der Kampf ist nur die Inszenierung.
import { DOMAIN_LABEL, bossAt, type Boss, type DamageSplit, type Domain } from './rpg';

export interface CampaignPos {
  index: number;
  boss: Boss;
  dealt: number;
  remaining: number;
}

/** Position im Feldzug bei einem Gesamtschaden (gleiche Regel wie `campaign`). */
export function campaignAt(totalDamage: number): CampaignPos {
  let index = 0;
  let dealt = Math.max(0, totalDamage);
  while (dealt >= bossAt(index).hp) {
    dealt -= bossAt(index).hp;
    index++;
  }
  const boss = bossAt(index);
  return { index, boss, dealt, remaining: boss.hp - dealt };
}

export interface BattleHit {
  dmg: number;
  label: string;
  domain: Domain | null;
  bossIndex: number;
  hpBefore: number;
  hpAfter: number;
  /** dieser Treffer besiegt den Boss */
  kill: boolean;
}

export interface BattlePlan {
  from: number;
  to: number;
  damage: number;
  start: CampaignPos;
  end: CampaignPos;
  hits: BattleHit[];
  defeated: Boss[];
}

export const MAX_ATTACKS = 4;

/**
 * Teilt den neuen Schaden in Angriffe auf: nach Bereichen (Kraft, Disziplin …) im Verhältnis des
 * heutigen Tagesschadens, höchstens `MAX_ATTACKS`. Ein Angriff, der einen Boss besiegt, wird geteilt –
 * der Rest trifft den nächsten Boss.
 */
export function battlePlan(from: number, to: number, split?: Partial<DamageSplit> | null): BattlePlan {
  const damage = Math.max(0, Math.round(to - from));
  const start = campaignAt(from);
  const end = campaignAt(from + damage);

  // Angriffe nach Bereich
  const parts = (Object.keys(DOMAIN_LABEL) as Domain[])
    .map((d) => ({ domain: d, w: Math.max(0, split?.[d] ?? 0) }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w);
  let attacks: { domain: Domain | null; dmg: number }[];
  if (!parts.length) attacks = [{ domain: null, dmg: damage }];
  else {
    const top = parts.slice(0, MAX_ATTACKS);
    const rest = parts.slice(MAX_ATTACKS).reduce((a, x) => a + x.w, 0);
    if (rest) top[top.length - 1]!.w += rest;
    const sum = top.reduce((a, x) => a + x.w, 0);
    attacks = top.map((x) => ({ domain: x.domain, dmg: Math.floor((damage * x.w) / sum) }));
    attacks[0]!.dmg += damage - attacks.reduce((a, x) => a + x.dmg, 0); // Rundungsrest
    attacks = attacks.filter((a) => a.dmg > 0).reverse(); // stärkster Angriff zum Schluss
  }

  const hits: BattleHit[] = [];
  const defeated: Boss[] = [];
  let pos = { ...start };
  for (const a of attacks) {
    let left = a.dmg;
    while (left > 0) {
      const d = Math.min(left, pos.remaining);
      const kill = d >= pos.remaining;
      hits.push({ dmg: d, label: a.domain ? DOMAIN_LABEL[a.domain] : 'Angriff', domain: a.domain, bossIndex: pos.index, hpBefore: pos.remaining, hpAfter: pos.remaining - d, kill });
      left -= d;
      if (kill) {
        defeated.push(pos.boss);
        const boss = bossAt(pos.index + 1);
        pos = { index: pos.index + 1, boss, dealt: 0, remaining: boss.hp };
      } else pos = { ...pos, dealt: pos.dealt + d, remaining: pos.remaining - d };
    }
  }
  return { from, to: from + damage, damage, start, end, hits, defeated };
}
