// Weltkarte: 12 Regionen einer mittelalterlichen Fantasy-Welt, je mit Wegenetz und einer Hauptstadt,
// in der ein Boss wartet. Bewegt wird mit Aktionspunkten (AP), die nur aus echtem Verhalten stammen.
// Der Spielstand der Welt wird aus einem Ereignis-Log abgespielt (rein, deterministisch).
import { CAMPAIGN, type Boss } from './rpg';
import type { Mats } from './forge';

// ---------------------------------------------------------------------------
// Regionen
// ---------------------------------------------------------------------------

export interface Region {
  id: string;
  /** Boss in der Hauptstadt (ID aus CAMPAIGN) */
  bossId: string;
  name: string;
  capital: string;
  /** Mindest-Heldenstufe zum Betreten */
  minLevel: number;
  /** Landschaft für Platzhalter-Karte und Gegnernamen */
  terrain: 'huegel' | 'wald' | 'kueste' | 'weide' | 'gebirge' | 'steppe' | 'sumpf' | 'hochland' | 'wueste' | 'ebene' | 'palast' | 'stadt';
  /** Mittelpunkt auf der Karte (angegeben für 1000 × 1400, gestreckt mit MAP_K) */
  cx: number;
  cy: number;
  color: string;
  /** Gegnergruppen und Elite dieser Region */
  foes: string[];
  elite: string;
}

export const REGIONS: Region[] = [
  { id: 'arverner', bossId: 'gallia', name: 'Arvernerhöhen', capital: 'Gergovia', minLevel: 1, terrain: 'huegel', cx: 300, cy: 1160, color: '#8a9a5b', foes: ['Wegelagerer', 'Wilde Hunde', 'Plünderer'], elite: 'Hauptmann der Plünderer' },
  { id: 'dunkelwald', bossId: 'germania', name: 'Dunkelwald', capital: 'Teutoburg', minLevel: 3, terrain: 'wald', cx: 165, cy: 900, color: '#3f6b3a', foes: ['Wolfsrudel', 'Waldräuber', 'Wilderer'], elite: 'Schattenjäger' },
  { id: 'nebelinseln', bossId: 'britannia', name: 'Nebelinseln', capital: 'Icenhall', minLevel: 5, terrain: 'kueste', cx: 120, cy: 620, color: '#5f7d8c', foes: ['Seeräuber', 'Strandplünderer', 'Moorgeister'], elite: 'Streitwagenlenker' },
  { id: 'hirtenland', bossId: 'hispania', name: 'Hirtenland', capital: 'Numantia', minLevel: 7, terrain: 'weide', cx: 240, cy: 360, color: '#a3a05a', foes: ['Viehdiebe', 'Rebellen', 'Bergbanditen'], elite: 'Rebellenanführer' },
  { id: 'drachenberge', bossId: 'dacia', name: 'Drachenberge', capital: 'Sarmizegetusa', minLevel: 9, terrain: 'gebirge', cx: 470, cy: 170, color: '#7a6a8a', foes: ['Bergtrolle', 'Drachenkultisten', 'Falkenreiter'], elite: 'Drachenbannerträger' },
  { id: 'loewensteppe', bossId: 'africa', name: 'Löwensteppe', capital: 'Cirta', minLevel: 11, terrain: 'steppe', cx: 760, cy: 180, color: '#c4a050', foes: ['Steppenlöwen', 'Reiterbande', 'Söldner'], elite: 'Numidischer Reiterführer' },
  { id: 'sobekdelta', bossId: 'aegyptus', name: 'Sobeks Delta', capital: 'Krokodilopolis', minLevel: 13, terrain: 'sumpf', cx: 880, cy: 430, color: '#4f8a7a', foes: ['Sumpfechsen', 'Grabräuber', 'Tempelwächter'], elite: 'Priester des Sobek' },
  { id: 'gipfelreich', bossId: 'armenia', name: 'Gipfelreich', capital: 'Artaxata', minLevel: 15, terrain: 'hochland', cx: 860, cy: 720, color: '#8c7766', foes: ['Felsklauen', 'Bergwache', 'Schneewölfe'], elite: 'Königsgarde der Gipfel' },
  { id: 'reiterwueste', bossId: 'parthia', name: 'Reiterwüste', capital: 'Ktesiphon', minLevel: 17, terrain: 'wueste', cx: 860, cy: 1010, color: '#c98a4b', foes: ['Wüstenreiter', 'Sandskorpione', 'Bogenschützen'], elite: 'Kataphrakt' },
  { id: 'hunnensteppe', bossId: 'pannonia', name: 'Hunnensteppe', capital: 'Etzelburg', minLevel: 19, terrain: 'ebene', cx: 680, cy: 1230, color: '#9b6b4a', foes: ['Hunnenreiter', 'Brandschatzer', 'Steppenschamanen'], elite: 'Heerführer der Hunnen' },
  { id: 'koenigsthron', bossId: 'persia', name: 'Thron der Könige', capital: 'Persepolis', minLevel: 21, terrain: 'palast', cx: 640, cy: 930, color: '#7a4f7a', foes: ['Unsterbliche', 'Kriegselefanten', 'Hofmagier'], elite: 'Hauptmann der Unsterblichen' },
  { id: 'kaiserstadt', bossId: 'pons-milvius', name: 'Kaiserstadt', capital: 'Palatium', minLevel: 23, terrain: 'stadt', cx: 490, cy: 680, color: '#8a3a3a', foes: ['Prätorianer', 'Stadtwache', 'Verschwörer'], elite: 'Präfekt der Garde' },
];

/** Kartengröße (Weltkoordinaten = gemaltes Kartenbild 1060 × 1484, gestreckt); Regionsmitten oben sind für 1000 × 1400 angegeben */
export const MAP_K = 1.6;
export const MAP_W = 1000 * MAP_K;
export const MAP_H = 1400 * MAP_K;
for (const r of REGIONS) {
  r.cx = Math.round(r.cx * MAP_K);
  r.cy = Math.round(r.cy * MAP_K);
}

export const regionById = (id: string) => REGIONS.find((r) => r.id === id);
export const regionIndex = (id: string) => REGIONS.findIndex((r) => r.id === id);
export const bossOfRegion = (r: Region): Boss => CAMPAIGN.find((b) => b.id === r.bossId)!;

// ---------------------------------------------------------------------------
// Knoten und Wege
// ---------------------------------------------------------------------------

export type NodeType = 'start' | 'weg' | 'lager' | 'dorf' | 'truhe' | 'gegner' | 'elite' | 'hauptstadt';
export const NODE_LABEL: Record<NodeType, string> = {
  start: 'Heimatstadt',
  weg: 'Wegkreuzung',
  lager: 'Lager',
  dorf: 'Dorf',
  truhe: 'Truhe',
  gegner: 'Gegnertrupp',
  elite: 'Elite-Gegner',
  hauptstadt: 'Hauptstadt',
};

export interface WorldNode {
  id: string;
  type: NodeType;
  /** Region (null = Heimatstadt) */
  region: string | null;
  name: string;
  x: number;
  y: number;
}

export const START_NODE = 'start';
export const START_NAME = 'Aurelia';

/**
 * Wegenetz je Region, von Hand auf die gemalte Weltkarte gesetzt (Weltkoordinaten 1600 × 2240 = Bild × 1600/1060).
 * Hauptweg: Eingang → a Gegner → b Lager → c Gegner → d Kreuzung → e Elite → f Hauptstadt.
 * Abzweige (Standard): g Truhe an d, h Dorf an b, i Gegner an h, j Truhe an i – je Region anpassbar.
 */
type Key = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j';
interface RegionLayout {
  pts: Record<Key, [number, number]>;
  /** Abweichende Eltern der Abzweige */
  sp?: Partial<Record<'g' | 'h' | 'i' | 'j', Key>>;
  /** Vorgänger von a (Standard: Hauptstadt der vorigen Region bzw. Heimatstadt) */
  entry?: string;
  /** Orte, die auf der Karte gemalt und beschriftet sind */
  towns?: Partial<Record<Key, { name: string; type?: NodeType }>>;
  /** Name des namenlosen Dorfs (h), falls h kein gemalter Ort ist */
  village?: string;
}

const START_POS: [number, number] = [762, 2065];
const LAYOUT: Record<string, RegionLayout> = {
  arverner: {
    pts: { a: [649, 2015], b: [377, 1932], c: [589, 1879], d: [649, 1789], e: [566, 1736], f: [430, 1763], g: [709, 1721], h: [332, 1718], i: [166, 1804], j: [128, 1917] },
    towns: { h: { name: 'Hügelfurt' } },
  },
  dunkelwald: {
    pts: { a: [664, 1623], b: [528, 1525], c: [377, 1577], d: [166, 1525], e: [151, 1404], f: [272, 1377], g: [106, 1612], h: [322, 1277], i: [453, 1449], j: [453, 1343] },
    sp: { h: 'f', i: 'c' },
    towns: { h: { name: 'Finsterhain' } },
  },
  nebelinseln: {
    pts: { a: [453, 1162], b: [475, 1042], c: [468, 875], d: [370, 871], e: [264, 838], f: [226, 939], g: [513, 792], h: [385, 1117], i: [257, 1105], j: [121, 1102] },
    entry: 'dunkelwald-h',
    towns: { d: { name: 'Nebelhafen', type: 'dorf' } },
    village: 'Fischerdorf',
  },
  hirtenland: {
    pts: { a: [430, 717], b: [294, 664], c: [181, 589], d: [219, 465], e: [325, 435], f: [438, 531], g: [113, 438], h: [377, 604], i: [558, 634], j: [649, 682] },
    towns: { d: { name: 'Weidmark', type: 'dorf' } },
    village: 'Einödhof',
  },
  drachenberge: {
    pts: { a: [589, 491], b: [725, 450], c: [687, 377], d: [687, 309], e: [687, 226], f: [785, 269], g: [845, 453], h: [604, 276], i: [498, 254], j: [438, 181] },
    sp: { g: 'b', h: 'd' },
    towns: { h: { name: 'Drachenpass' } },
  },
  loewensteppe: {
    pts: { a: [921, 400], b: [1026, 325], c: [1147, 453], d: [1358, 438], e: [1411, 279], f: [1268, 359], g: [1487, 453], h: [1170, 276], i: [1094, 226], j: [966, 193] },
    towns: { h: { name: 'Löwenrast' } },
  },
  sobekdelta: {
    pts: { a: [1147, 551], b: [1102, 664], c: [1125, 785], d: [1223, 725], e: [1306, 694], f: [1396, 722], g: [1283, 898], h: [1230, 611], i: [1358, 574], j: [1502, 611] },
    towns: { h: { name: 'Deltahafen' } },
  },
  gipfelreich: {
    pts: { a: [1155, 883], b: [1102, 989], c: [1147, 1117], d: [1283, 1132], e: [1509, 1094], f: [1404, 1174], g: [1275, 1310], h: [1215, 1042], i: [1343, 1026], j: [1449, 996] },
    towns: { h: { name: 'Felswacht' } },
  },
  reiterwueste: {
    pts: { a: [1208, 1226], b: [1170, 1343], c: [1170, 1509], d: [1192, 1600], e: [1472, 1509], f: [1321, 1600], g: [1147, 1683], h: [1260, 1452], i: [1351, 1457], j: [1509, 1442] },
    towns: { h: { name: 'Dünenrast', type: 'lager' } },
  },
  hunnensteppe: {
    pts: { a: [1487, 1660], b: [1389, 1811], c: [1283, 2008], d: [1147, 1970], e: [1109, 1864], f: [978, 1845], g: [906, 1985], h: [1238, 1887], i: [1494, 1857], j: [1509, 1992] },
    sp: { i: 'b' },
    towns: { h: { name: 'Steppenlager', type: 'lager' } },
  },
  koenigsthron: {
    pts: { a: [755, 1804], b: [785, 1645], c: [936, 1660], d: [1057, 1525], e: [1064, 1396], f: [891, 1472], g: [845, 1577], h: [709, 1487], i: [634, 1404], j: [566, 1328] },
    sp: { g: 'c' },
    village: 'Tempelhain',
  },
  kaiserstadt: {
    pts: { a: [725, 1366], b: [672, 1241], c: [853, 1260], d: [996, 1230], e: [1042, 1079], f: [800, 1042], g: [1109, 1275], h: [558, 1177], i: [604, 1064], j: [664, 958] },
    towns: { b: { name: 'Kaiservorstadt', type: 'dorf' } },
    village: 'Hafenviertel',
  },
};

function buildWorld() {
  const nodes: WorldNode[] = [{ id: START_NODE, type: 'start', region: null, name: START_NAME, x: START_POS[0], y: START_POS[1] }];
  const edges: [string, string][] = [];
  let prev = START_NODE;
  const main: [NodeType, Key][] = [
    ['gegner', 'a'],
    ['lager', 'b'],
    ['gegner', 'c'],
    ['weg', 'd'],
    ['elite', 'e'],
    ['hauptstadt', 'f'],
  ];
  const sides: [NodeType, 'g' | 'h' | 'i' | 'j', Key][] = [
    ['truhe', 'g', 'd'],
    ['dorf', 'h', 'b'],
    ['gegner', 'i', 'h'],
    ['truhe', 'j', 'i'],
  ];
  for (const r of REGIONS) {
    const L = LAYOUT[r.id]!;
    const id = (k: string) => `${r.id}-${k}`;
    const add = (k: Key, type: NodeType, name: string) => {
      const town = L.towns?.[k];
      const [x, y] = L.pts[k];
      nodes.push({ id: id(k), type: town?.type ?? type, region: r.id, name: town?.name ?? name, x, y });
    };
    let foe = 0;
    const nameFor = (type: NodeType, k: Key) =>
      type === 'gegner' ? r.foes[k === 'i' ? 2 % r.foes.length : foe++ % r.foes.length]! : type === 'elite' ? r.elite : type === 'hauptstadt' ? r.capital : type === 'lager' ? 'Feldlager' : type === 'weg' ? 'Kreuzweg' : type === 'dorf' ? L.village ?? 'Weiler' : k === 'g' ? 'Verborgene Truhe' : 'Schatzversteck';
    let last = L.entry ?? prev;
    for (const [type, k] of main) {
      add(k, type, nameFor(type, k));
      edges.push([last, id(k)]);
      last = id(k);
    }
    for (const [type, k, parent] of sides) {
      add(k, type, nameFor(type, k));
      edges.push([id(L.sp?.[k] ?? parent), id(k)]);
    }
    prev = id('f');
  }
  return { nodes, edges };
}

export const WORLD = buildWorld();
export const nodeById = (id: string) => WORLD.nodes.find((n) => n.id === id);
const ADJ = new Map<string, string[]>();
for (const [a, b] of WORLD.edges) {
  ADJ.set(a, [...(ADJ.get(a) ?? []), b]);
  ADJ.set(b, [...(ADJ.get(b) ?? []), a]);
}
export const neighbors = (id: string) => ADJ.get(id) ?? [];
export const capitalOf = (regionId: string) => `${regionId}-f`;

// ---------------------------------------------------------------------------
// Ereignis-Log und Spielstand
// ---------------------------------------------------------------------------

export type WorldEvent =
  | { k: 'init'; at: string; date: string; pos: string; conquered: { region: string; date: string }[] }
  | { k: 'move'; at: string; date: string; path: string[]; ap: number }
  | { k: 'fight'; at: string; date: string; node: string; ap: number; won: boolean; loot: string[]; denare: number; mats?: Mats }
  | { k: 'chest'; at: string; date: string; node: string; ap: number; loot: string[]; denare: number; mats?: Mats }
  | { k: 'siege'; at: string; date: string; node: string; ap: number; dmg: number; killed: boolean; loot: string[]; denare: number; mats?: Mats };

export interface WorldState {
  started: boolean;
  startDate: string | null;
  pos: string;
  visited: Set<string>;
  /** Gegner, die schon einmal besiegt wurden (Weg frei) */
  cleared: Set<string>;
  /** Letzter Kampf je Gegner-Knoten (Gegner kehren nach 7 Tagen zurück) */
  lastFight: Map<string, string>;
  opened: Set<string>;
  bossDmg: Map<string, number>;
  conquered: Map<string, string>;
  lastSiege: Map<string, string>;
  spentByDate: Map<string, number>;
  loot: string[];
  denare: number;
}

export const RESPAWN_DAYS = 7;

export function replayWorld(log: WorldEvent[] | undefined): WorldState {
  const s: WorldState = {
    started: false,
    startDate: null,
    pos: START_NODE,
    visited: new Set([START_NODE]),
    cleared: new Set(),
    lastFight: new Map(),
    opened: new Set(),
    bossDmg: new Map(),
    conquered: new Map(),
    lastSiege: new Map(),
    spentByDate: new Map(),
    loot: [],
    denare: 0,
  };
  const spend = (date: string, ap: number) => s.spentByDate.set(date, (s.spentByDate.get(date) ?? 0) + ap);
  for (const e of log ?? []) {
    if (e.k === 'init') {
      s.started = true;
      s.startDate = e.date;
      for (const c of e.conquered) {
        s.conquered.set(c.region, c.date);
        for (const n of WORLD.nodes.filter((x) => x.region === c.region)) {
          s.visited.add(n.id);
          if (n.type === 'gegner' || n.type === 'elite') s.cleared.add(n.id);
        }
      }
      s.pos = e.pos;
      s.visited.add(e.pos);
      continue;
    }
    spend(e.date, e.ap);
    s.loot.push(...(e.k === 'move' ? [] : e.loot));
    if (e.k !== 'move') s.denare += e.denare;
    if (e.k === 'move') {
      for (const n of e.path) s.visited.add(n);
      s.pos = e.path[e.path.length - 1] ?? s.pos;
    } else if (e.k === 'fight') {
      s.lastFight.set(e.node, e.date);
      if (e.won) s.cleared.add(e.node);
    } else if (e.k === 'chest') {
      s.opened.add(e.node);
    } else {
      const r = nodeById(e.node)!.region!;
      s.bossDmg.set(r, (s.bossDmg.get(r) ?? 0) + e.dmg);
      s.lastSiege.set(r, e.date);
      if (e.killed && !s.conquered.has(r)) s.conquered.set(r, e.date);
    }
  }
  return s;
}

/** Aufgedeckt: besuchte Knoten und ihre Nachbarn (Nebel des Krieges). */
export function revealed(s: WorldState): Set<string> {
  const out = new Set(s.visited);
  for (const v of s.visited) for (const n of neighbors(v)) out.add(n);
  return out;
}

/** Ein Gegner-Knoten blockiert den Weiterweg, bis er einmal besiegt ist. */
export const blocks = (s: WorldState, id: string) => {
  const n = nodeById(id);
  return !!n && (n.type === 'gegner' || n.type === 'elite' || (n.type === 'hauptstadt' && !!n.region && !s.conquered.has(n.region))) && !s.cleared.has(id);
};

export interface Access {
  ok: boolean;
  reason?: string;
}

/** Darf der Held eine Region betreten? (Stufe + Boss der vorigen Region besiegt) */
export function regionAccess(s: WorldState, regionId: string | null, level: number): Access {
  if (!regionId) return { ok: true };
  const i = regionIndex(regionId);
  const r = REGIONS[i]!;
  if (i > 0 && !s.conquered.has(REGIONS[i - 1]!.id)) return { ok: false, reason: `Erst ${bossOfRegion(REGIONS[i - 1]!).name} in ${REGIONS[i - 1]!.capital} besiegen` };
  if (level < r.minLevel) return { ok: false, reason: `Ab Heldenstufe ${r.minLevel}` };
  return { ok: true };
}

/**
 * Kürzester Weg über aufgedeckte Knoten. Man darf auf einem unbesiegten Gegner enden, aber nicht über ihn hinweg;
 * steht man selbst auf einem unbesiegten Gegner, geht es nur zurück auf bereits besuchte Felder.
 */
export function findPath(s: WorldState, to: string, level: number): { path: string[] } | { error: string } {
  if (to === s.pos) return { error: 'Du bist schon hier.' };
  const seen = revealed(s);
  if (!seen.has(to)) return { error: 'Dieser Ort liegt noch im Nebel.' };
  const acc = regionAccess(s, nodeById(to)?.region ?? null, level);
  if (!acc.ok) return { error: acc.reason! };
  const prev = new Map<string, string>([[s.pos, '']]);
  const queue = [s.pos];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    if (cur !== s.pos && blocks(s, cur)) continue;
    for (const n of neighbors(cur)) {
      if (prev.has(n) || !seen.has(n)) continue;
      if (cur === s.pos && blocks(s, s.pos) && !s.visited.has(n)) continue;
      if (!regionAccess(s, nodeById(n)?.region ?? null, level).ok) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!prev.has(to)) return { error: blocks(s, s.pos) ? 'Besiege zuerst den Gegner hier – oder zieh dich zurück.' : 'Ein Gegner versperrt den Weg.' };
  const path: string[] = [];
  for (let c = to; c && c !== s.pos; c = prev.get(c)!) path.unshift(c);
  return { path };
}

/** Kann der Gegner hier (wieder) bekämpft werden? */
export function foeAvailable(s: WorldState, id: string, today: string): boolean {
  const last = s.lastFight.get(id);
  if (!s.cleared.has(id)) return true;
  if (!last) return true;
  const days = (Date.parse(today) - Date.parse(last)) / 86400000;
  return days >= RESPAWN_DAYS;
}

/** Nächste nicht eroberte Region (null = alles erobert) */
export function nextRegion(s: WorldState): Region | null {
  return REGIONS.find((r) => !s.conquered.has(r.id)) ?? null;
}

// ---------------------------------------------------------------------------
// Aktionspunkte
// ---------------------------------------------------------------------------

export const AP_CAP = 15;
export const AP_START = 5;
export const AP_COST = { move: 1, fight: 2, elite: 3, chest: 1, siege: 3 } as const;

/** Wofür es AP gibt (für die Hilfe in der App) */
export const AP_RULES: { label: string; ap: number }[] = [
  { label: 'Tag protokolliert', ap: 1 },
  { label: 'Krafttraining (je Einheit, max. 2/Tag)', ap: 2 },
  { label: 'Ausdauer ≥ 20 min', ap: 1 },
  { label: 'Schrittziel erreicht', ap: 1 },
  { label: 'Tagesauftrag erfüllt', ap: 1 },
  { label: 'Wochen-Auftrag erfüllt', ap: 1 },
  { label: 'Alle drei Feldzüge der Woche', ap: 2 },
  { label: 'Neuer Rang', ap: 3 },
];

/** AP-Stand: Tag für Tag verdienen und ausgeben, Speicher höchstens AP_CAP (am selben Tag Verdientes geht nicht verloren). */
export function apBalance(startDate: string | null, earnedByDay: Map<string, number>, spentByDay: Map<string, number>, today: string) {
  if (!startDate) return { balance: 0, earnedToday: 0 };
  const dates = [...new Set([...earnedByDay.keys(), ...spentByDay.keys()])].filter((d) => d >= startDate && d <= today).sort();
  let bal = AP_START;
  for (const d of dates) bal = Math.min(AP_CAP, bal + (earnedByDay.get(d) ?? 0) - (spentByDay.get(d) ?? 0));
  return { balance: bal, earnedToday: today >= startDate ? earnedByDay.get(today) ?? 0 : 0 };
}
