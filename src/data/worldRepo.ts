// Aktionen auf der Weltkarte: prüfen (AP, Lage, Sperren), Kampf simulieren, Ergebnis ins Log schreiben.
import { getSettings, setSetting } from './profileRepo';
import { today } from '@/domain/dates';
import type { GameState } from '@/domain/gamification';
import { hash, lootSets, rollLoot } from '@/domain/armor';
import { foeFor, simulateFight, type FightResult, type Foe, type Stats } from '@/domain/combat';
import { heroStatsFor, trainedToday } from '@/domain/gear';
import { badgeTiers, bossOfRegionId } from '@/domain/equipment';
import { pickWeapon, weaponLootIds } from '@/domain/weapons';
import { PITY, dismantled, effectiveLists, lootDrought, matsFor, type Mats } from '@/domain/forge';
import {
  AP_COST,
  REGIONS,
  START_NODE,
  apBalance,
  bossOfRegion,
  capitalOf,
  findPath,
  foeAvailable,
  nodeById,
  regionIndex,
  replayWorld,
  type WorldEvent,
  type WorldState,
} from '@/domain/world';

async function load(game: GameState) {
  const s = await getSettings();
  const log = s.worldLog ?? [];
  const state = replayWorld(log);
  const ap = apBalance(state.startDate, game.world.apByDay, state.spentByDate, today()).balance;
  return { s, log, state, ap };
}

async function append(log: WorldEvent[], e: WorldEvent, loot: string[] = []) {
  await setSetting('worldLog', [...log, e]);
  if (loot.length) {
    // jedes Exemplar zählt (nach dem Zerlegen kann ein Teil erneut fallen)
    const s = await getSettings();
    await setSetting('armorLoot', [...s.armorLoot, ...loot]);
  }
}

function needAp(ap: number, cost: number) {
  if (ap < cost) throw new Error(`Dafür brauchst du ${cost} Aktionspunkte – du hast ${ap}. Training, Ernährung und Quests bringen neue.`);
}

/** Erster Start: bereits besiegte Bosse des alten Feldzugs werden als eroberte Regionen übernommen. */
export async function initWorld(game: GameState) {
  const s = await getSettings();
  if ((s.worldLog ?? []).some((e) => e.k === 'init')) return false;
  const conquered = REGIONS.filter((r) => game.legacyDefeated.some((d) => d.bossId === r.bossId)).map((r) => ({ region: r.id, date: game.legacyDefeated.find((d) => d.bossId === r.bossId)!.date }));
  // nur zusammenhängend von vorne (der alte Feldzug war linear)
  const chain = conquered.filter((c, i) => regionIndex(c.region) === i);
  const pos = chain.length ? capitalOf(chain[chain.length - 1]!.region) : START_NODE;
  const now = new Date().toISOString();
  await setSetting('worldLog', [{ k: 'init', at: now, date: today(), pos, conquered: chain }, ...(s.worldLog ?? [])]);
  return true;
}

export async function travel(to: string, game: GameState) {
  const { log, state, ap } = await load(game);
  const r = findPath(state, to, game.level.level);
  if ('error' in r) throw new Error(r.error);
  const cost = r.path.length * AP_COST.move;
  needAp(ap, cost);
  await append(log, { k: 'move', at: new Date().toISOString(), date: today(), path: r.path, ap: cost });
  return { steps: r.path.length, cost };
}

export interface FightOutcome {
  foe: Foe;
  hero: Stats;
  result: FightResult;
  loot: string[];
  denare: number;
  /** gewonnenes Schmiedematerial */
  mats?: Mats;
  /** Pech-Ausgleich hat gegriffen */
  pity?: boolean;
  kampfgeist: boolean;
  regionName: string;
  /** Boss: Max-LP und ob er gefallen ist */
  bossHpMax?: number;
  killed?: boolean;
}

/** Besitz nach Zerlegen (zerlegte Teile können wieder fallen) */
function owned(s: Awaited<ReturnType<typeof getSettings>>, state: WorldState) {
  return effectiveLists([...s.armorLoot, ...state.loot.filter((l) => !s.armorLoot.includes(l))], s.purchases, dismantled(s.forgeLog));
}

function lootCtx(game: GameState, s: Awaited<ReturnType<typeof getSettings>>, state: WorldState) {
  const o = owned(s, state);
  return { rankLevel: game.rank.rank.level, defeatedBossIds: game.campaign.defeated.map((d) => d.boss.id), loot: o.loot, purchases: o.purchases, cooking: game.cooking };
}

/** Pech-Ausgleich: nach PITY−1 leeren Siegen/Truhen fällt sicher ein Ausrüstungsteil. */
function withPity(loot: string[], log: WorldEvent[], key: string, game: GameState, s: Awaited<ReturnType<typeof getSettings>>, state: WorldState, ri: number, source: 'gegner' | 'elite' | 'truhe'): { loot: string[]; pity: boolean } {
  if (loot.length || lootDrought(log) < PITY - 1) return { loot, pity: false };
  const forced = rollLoot(`${key}#gluck`, 1, lootCtx(game, s, state), 0, lootSets(ri, source === 'gegner' ? 'elite' : source));
  if (forced.length) return { loot: forced, pity: true };
  const w = weaponDrop(`${key}#gluck`, 'boss', ri, game, s, state);
  return { loot: w, pity: w.length > 0 };
}

/** Waffen-Beute: Chance je Quelle, Fenster der Region, nichts doppelt */
export const WEAPON_DROP_CHANCE = { gegner: 0.15, elite: 0.5, truhe: 0.35, boss: 1 } as const;
function weaponDrop(key: string, source: keyof typeof WEAPON_DROP_CHANCE, regionIdx: number, game: GameState, s: Awaited<ReturnType<typeof getSettings>>, state: WorldState): string[] {
  if (hash(`${key}#waffe`) >= WEAPON_DROP_CHANCE[source]) return [];
  const o = owned(s, state);
  const ctx = { classId: s.hero?.classId, purchases: o.purchases, loot: o.loot, defeatedBossIds: game.campaign.defeated.map((d) => d.boss.id), badgeTiers: badgeTiers(game.badges), bossOfRegion: bossOfRegionId };
  const id = pickWeapon(weaponLootIds(regionIdx, source), ctx, hash(`${key}#waffe-wahl`));
  return id ? [id] : [];
}

export async function fight(nodeId: string, game: GameState): Promise<FightOutcome> {
  const { s, log, state, ap } = await load(game);
  const n = nodeById(nodeId);
  if (!n || !n.region || (n.type !== 'gegner' && n.type !== 'elite')) throw new Error('Hier gibt es niemanden zu bekämpfen.');
  if (state.pos !== nodeId) throw new Error('Reise zuerst dorthin.');
  const d = today();
  if (!foeAvailable(state, nodeId, d)) throw new Error('Dieser Trupp ist geschlagen – er sammelt sich erst in ein paar Tagen neu.');
  const cost = n.type === 'elite' ? AP_COST.elite : AP_COST.fight;
  needAp(ap, cost);
  if (!s.hero) throw new Error('Erschaffe zuerst deinen Helden.');
  const at = new Date().toISOString();
  const hero = heroStatsFor(game, s.hero, s.purchases, s.armorLoot, s.forgeLog);
  const foe = foeFor(n.region, n.type, n.name);
  const kg = trainedToday(game, d);
  const result = simulateFight(hero, foe, `${nodeId}|${at}`, { kampfgeist: kg });
  const ri = regionIndex(n.region);
  let loot: string[] = [];
  let denare = 0;
  let mats: Mats = {};
  let pity = false;
  if (result.won) {
    const src = n.type === 'elite' ? 'elite' : 'gegner';
    loot = rollLoot(`${nodeId}|${at}`, n.type === 'elite' ? 1 : 0, lootCtx(game, s, state), n.type === 'elite' ? 0 : 0.4, lootSets(ri, src));
    loot.push(...weaponDrop(`${nodeId}|${at}`, src, ri, game, s, state));
    ({ loot, pity } = withPity(loot, log, `${nodeId}|${at}`, game, s, state, ri, src));
    denare = Math.round((n.type === 'elite' ? 20 : 5) * (1 + ri * 0.3) * (1 + hash(at)));
    mats = matsFor(src, ri, `${nodeId}|${at}`);
  }
  await append(log, { k: 'fight', at, date: d, node: nodeId, ap: cost, won: result.won, loot, denare, mats }, loot);
  return { foe, hero, result, loot, denare, mats, pity, kampfgeist: kg, regionName: REGIONS[ri]!.name };
}

export async function openChest(nodeId: string, game: GameState) {
  const { s, log, state, ap } = await load(game);
  const n = nodeById(nodeId);
  if (!n || n.type !== 'truhe' || !n.region) throw new Error('Hier ist keine Truhe.');
  if (state.pos !== nodeId) throw new Error('Reise zuerst dorthin.');
  if (state.opened.has(nodeId)) throw new Error('Die Truhe ist leer.');
  needAp(ap, AP_COST.chest);
  const at = new Date().toISOString();
  const ri = regionIndex(n.region);
  const rolled = [...rollLoot(`${nodeId}|${at}`, 0, lootCtx(game, s, state), 0.65, lootSets(ri, 'truhe')), ...weaponDrop(`${nodeId}|${at}`, 'truhe', ri, game, s, state)];
  const { loot, pity } = withPity(rolled, log, `${nodeId}|${at}`, game, s, state, ri, 'truhe');
  const denare = Math.round((loot.length ? 10 : 30) * (1 + ri * 0.3) * (1 + hash(at)));
  const mats = matsFor('truhe', ri, `${nodeId}|${at}`);
  await append(log, { k: 'chest', at, date: today(), node: nodeId, ap: AP_COST.chest, loot, denare, mats }, loot);
  return { loot, denare, mats, pity };
}

/** Belagerung: ein Angriff pro Tag, höchstens ein Viertel der Boss-LP. */
export async function siege(nodeId: string, game: GameState): Promise<FightOutcome> {
  const { s, log, state, ap } = await load(game);
  const n = nodeById(nodeId);
  if (!n || n.type !== 'hauptstadt' || !n.region) throw new Error('Hier residiert kein Boss.');
  if (state.pos !== nodeId) throw new Error('Reise zuerst in die Hauptstadt.');
  if (state.conquered.has(n.region)) throw new Error('Diese Stadt ist bereits erobert.');
  const d = today();
  if (state.lastSiege.get(n.region) === d) throw new Error('Heute hast du schon angegriffen. Die Belagerung geht morgen weiter.');
  needAp(ap, AP_COST.siege);
  if (!s.hero) throw new Error('Erschaffe zuerst deinen Helden.');
  const at = new Date().toISOString();
  const hero = heroStatsFor(game, s.hero, s.purchases, s.armorLoot, s.forgeLog);
  const r = REGIONS[regionIndex(n.region)]!;
  const foe = foeFor(n.region, 'hauptstadt', bossOfRegion(r).name);
  const kg = trainedToday(game, d);
  const left = foe.hp - (state.bossDmg.get(n.region) ?? 0);
  const result = simulateFight(hero, foe, `${nodeId}|${at}`, { kampfgeist: kg, foeHp: left });
  const killed = result.foeHpEnd <= 0;
  const loot = killed ? [...rollLoot(`${nodeId}|${at}`, 1, lootCtx(game, s, state), 0, lootSets(regionIndex(n.region), 'boss')), ...weaponDrop(`${nodeId}|${at}`, 'boss', regionIndex(n.region), game, s, state)] : [];
  const denare = killed ? 100 + regionIndex(n.region) * 40 : 0;
  const mats = matsFor(killed ? 'boss' : 'belagerung', regionIndex(n.region), `${nodeId}|${at}`);
  await append(log, { k: 'siege', at, date: d, node: nodeId, ap: AP_COST.siege, dmg: result.dealt, killed, loot, denare, mats }, loot);
  return { foe, hero, result, loot, denare, mats, kampfgeist: kg, regionName: r.name, bossHpMax: foe.hp, killed };
}
