// Weltkarte: 12 Regionen einer mittelalterlichen Fantasy-Welt, je mit Wegenetz und einer Hauptstadt,
// in der ein Boss wartet. Bewegt wird mit Aktionspunkten (AP), die nur aus echtem Verhalten stammen.
// Der Spielstand der Welt wird aus einem Ereignis-Log abgespielt (rein, deterministisch).
import { CAMPAIGN, type Boss } from './rpg';

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

/** Kartengröße (Weltkoordinaten); Regionsmitten oben sind für 1000 × 1400 angegeben und werden mit MAP_K gestreckt */
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
 * Wegenetz je Region: Eingang → Gegner → Lager → Gegner → Kreuzung (Abzweig Truhe) → Elite (Abzweig Dorf + Truhe) → Hauptstadt.
 * Die Lage wird aus Startpunkt (vorige Hauptstadt) und Regionsmitte berechnet; mit der fertigen Karte werden die Punkte angepasst.
 */
function buildWorld() {
  const nodes: WorldNode[] = [{ id: START_NODE, type: 'start', region: null, name: START_NAME, x: Math.round(500 * MAP_K), y: Math.round(1330 * MAP_K) }];
  const edges: [string, string][] = [];
  let prev = nodes[0]!;
  const main: [NodeType, string][] = [
    ['gegner', 'a'],
    ['lager', 'b'],
    ['gegner', 'c'],
    ['weg', 'd'],
    ['elite', 'e'],
    ['hauptstadt', 'f'],
  ];
  REGIONS.forEach((r, ri) => {
    // Hauptstadt etwas hinter die Regionsmitte (Richtung nächste Region)
    const next = REGIONS[ri + 1];
    const capX = next ? r.cx + (next.cx - r.cx) * 0.18 : r.cx;
    const capY = next ? r.cy + (next.cy - r.cy) * 0.18 : r.cy;
    const dx = capX - prev.x;
    const dy = capY - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const clamp = (v: number, max: number) => Math.round(Math.max(70, Math.min(max - 70, v)));
    // Abzweige zeigen zur Kartenmitte, damit nichts über den Rand ragt
    const cx = MAP_W / 2 - (prev.x + dx / 2);
    const cy = MAP_H / 2 - (prev.y + dy / 2);
    const inward = px * cx + py * cy >= 0 ? 1 : -1;
    const at = (t: number, off: number, side = false) => {
      const o = (side ? inward * Math.abs(off) : off) * MAP_K;
      return { x: clamp(prev.x + dx * t + px * o, MAP_W), y: clamp(prev.y + dy * t + py * o, MAP_H) };
    };
    const id = (k: string) => `${r.id}-${k}`;
    const ts = [0.24, 0.38, 0.52, 0.66, 0.82, 1];
    const wiggle = [18, -22, 16, -14, 12, 0];
    let last = prev.id;
    let foe = 0;
    main.forEach(([type, k], i) => {
      const p = at(ts[i]!, wiggle[i]!);
      const name = type === 'gegner' ? r.foes[foe++ % r.foes.length]! : type === 'elite' ? r.elite : type === 'hauptstadt' ? r.capital : type === 'lager' ? `Lager am ${r.name}` : `Kreuzweg im ${r.name}`;
      nodes.push({ id: id(k), type, region: r.id, name, ...p });
      edges.push([last, id(k)]);
      last = id(k);
    });
    // Abzweige: Truhe an der Kreuzung, Dorf + Gegner + Truhe am Elite-Platz
    const side = (from: string, k: string, type: NodeType, t: number, off: number, name: string) => {
      nodes.push({ id: id(k), type, region: r.id, name, ...at(t, off, true) });
      edges.push([from, id(k)]);
    };
    side(id('d'), 'g', 'truhe', 0.62, 70, 'Verborgene Truhe');
    side(id('b'), 'h', 'dorf', 0.4, -75, `Dorf im ${r.name}`);
    side(id('h'), 'i', 'gegner', 0.5, -135, r.foes[2 % r.foes.length]!);
    side(id('i'), 'j', 'truhe', 0.6, -175, 'Schatzversteck');
    prev = nodes.find((n) => n.id === id('f'))!;
  });
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
  | { k: 'fight'; at: string; date: string; node: string; ap: number; won: boolean; loot: string[]; denare: number }
  | { k: 'chest'; at: string; date: string; node: string; ap: number; loot: string[]; denare: number }
  | { k: 'siege'; at: string; date: string; node: string; ap: number; dmg: number; killed: boolean; loot: string[]; denare: number };

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
  { label: 'Wochen-Feldzug erfüllt', ap: 1 },
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
