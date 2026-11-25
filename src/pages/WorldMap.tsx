// Weltkarte: Wegenetz mit Nebel, Held, Gegnertrupps, Truhen und Hauptstädten. Bewegung und Aktionen kosten Aktionspunkte.
import { lootLabel } from '@/domain/armor';
import { weaponLootLabel } from '@/domain/weapons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Info, Swords, Shield, Heart, Lock, Flame, ChevronLeft } from 'lucide-react';
import { Badge, Button, Card, Sheet, cn, fmt } from '@/components/ui';
import { useGame } from '@/hooks/game';
import type { GameState } from '@/domain/gamification';
import { useSettings } from '@/hooks/data';
import { rpgAsset, HeadPreview } from '@/components/rpg/Visuals';
import { toast } from '@/stores/ui';
import { showFight } from '@/stores/battle';
import { today, formatDate } from '@/domain/dates';
import { foeFor, power, recommendedPower, winChance } from '@/domain/combat';
import { heroStatsFor, trainedToday } from '@/domain/gear';
import { itemById } from '@/domain/equipment';
import {
  AP_CAP,
  AP_COST,
  AP_RULES,
  NODE_LABEL,
  REGIONS,
  RESPAWN_DAYS,
  WORLD,
  MAP_H,
  MAP_W,
  blocks,
  bossOfRegion,
  findPath,
  foeAvailable,
  nodeById,
  regionAccess,
  regionById,
  revealed,
  type WorldNode,
  regionIndex,
} from '@/domain/world';
import { fight, openChest, siege, travel } from '@/data/worldRepo';
import { matText } from '@/domain/forge';

const SCALE = 0.7;
const W = MAP_W;
const H = MAP_H;

const ICON: Record<WorldNode['type'], string> = { start: '🏛', weg: '✦', lager: '⛺', dorf: '🏠', truhe: '🧰', gegner: '⚔', elite: '☠', hauptstadt: '🏰' };
const COLOR: Record<WorldNode['type'], string> = { start: '#c9a24a', weg: '#8b7a5c', lager: '#6b8f5a', dorf: '#7a8f9a', truhe: '#c9a24a', gegner: '#a33b2f', elite: '#6d1f2a', hauptstadt: '#8a3a3a' };

export function WorldMap() {
  const game = useGame();
  const settings = useSettings();
  const nav = useNavigate();
  const [sel, setSel] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const w = game?.world.state;
  const seen = useMemo(() => (w ? revealed(w) : new Set<string>()), [w]);
  const level = game?.level.level ?? 1;
  const stats = useMemo(() => (game && settings.hero ? heroStatsFor(game, settings.hero, settings.purchases, settings.armorLoot, settings.forgeLog) : null), [game, settings.hero, settings.purchases, settings.armorLoot, settings.forgeLog]);
  const pos = w ? nodeById(w.pos)! : WORLD.nodes[0]!;

  // Auf den Helden scrollen
  useEffect(() => {
    const el = scroller.current;
    if (!el || !w?.started) return;
    el.scrollTo({ left: pos.x * SCALE - el.clientWidth / 2, top: pos.y * SCALE - el.clientHeight / 2, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.started, pos.id]);

  if (!game || !w) return null;
  if (!settings.hero)
    return (
      <Card className="space-y-3">
        <p className="text-sm">Erschaffe zuerst deinen Helden – dann beginnt die Reise.</p>
        <Button onClick={() => nav('/erfolge?tab=held')}>Helden erschaffen</Button>
      </Card>
    );

  const kg = trainedToday(game, today());
  const preview = sel && sel !== w.pos ? findPath(w, sel, level) : null;
  const pathSet = new Set(preview && 'path' in preview ? [w.pos, ...preview.path] : []);
  const mapImg = rpgAsset('weltkarte');

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="-mx-4 -mt-4 flex flex-col md:mx-0 md:mt-0" data-testid="world-map">
      <div className="sticky top-14 z-20 flex items-center gap-2 border-b bg-bg/90 px-3 py-2 backdrop-blur md:top-0">
        <Button variant="ghost" size="icon" aria-label="Zurück" onClick={() => nav(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 font-bold tabular-nums text-gold ring-1 ring-gold/40" data-testid="ap" aria-label={`${game.world.ap} von ${AP_CAP} Aktionspunkten`}>
          <Zap className="h-4 w-4" /> {game.world.ap}
          <span className="text-xs font-normal text-gold/70">/{AP_CAP}</span>
        </div>
        {stats && (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-xs text-muted" data-testid="hero-stats">
            <span className="flex items-center gap-0.5">
              <Swords className="h-3.5 w-3.5" />
              {stats.atk}
            </span>
            <span className="flex items-center gap-0.5">
              <Shield className="h-3.5 w-3.5" />
              {stats.def}
            </span>
            <span className="flex items-center gap-0.5">
              <Heart className="h-3.5 w-3.5" />
              {stats.hp}
            </span>
            <span className="truncate">
              Kraft <b className="text-fg">{power(stats)}</b> · Stufe {level}
            </span>
            {kg && <Flame className="h-4 w-4 shrink-0 text-gold" aria-label="Kampfgeist aktiv" />}
          </div>
        )}
        <Button variant="ghost" size="icon" aria-label="Wie bekomme ich Aktionspunkte?" onClick={() => setHelp(true)}>
          <Info className="h-5 w-5" />
        </Button>
      </div>

      <div ref={scroller} className="relative h-[calc(100dvh-12.5rem)] overflow-auto overscroll-contain bg-[#1b1712] md:h-[calc(100dvh-6rem)] md:rounded-2xl" data-testid="map-scroller">
        <svg width={W * SCALE} height={H * SCALE} viewBox={`0 0 ${W} ${H}`} className="block select-none" role="img" aria-label="Weltkarte">
          <defs>
            <radialGradient id="parch" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#e9dcb8" />
              <stop offset="100%" stopColor="#b9a57a" />
            </radialGradient>
            <filter id="fogblur" filterUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
              <feGaussianBlur stdDeviation="28" />
            </filter>
            <mask id="fogmask">
              <rect width={W} height={H} fill="white" />
              <g filter="url(#fogblur)">
                {WORLD.nodes
                  .filter((n) => seen.has(n.id))
                  .map((n) => (
                    <circle key={n.id} cx={n.x} cy={n.y} r={w.visited.has(n.id) ? 170 : 110} fill="black" />
                  ))}
              </g>
            </mask>
          </defs>
          {mapImg ? <image href={mapImg} width={W} height={H} preserveAspectRatio="xMidYMid slice" /> : <rect width={W} height={H} fill="url(#parch)" />}
          {!mapImg &&
            REGIONS.map((r) => (
              <g key={r.id}>
                <circle cx={r.cx} cy={r.cy} r={250} fill={r.color} opacity={0.28} />
                <text x={r.cx} y={r.cy - 200} textAnchor="middle" className="font-brand" fontSize="40" fontWeight="700" fill="#3b2a18" opacity={0.75}>
                  {r.name}
                </text>
              </g>
            ))}
          {/* Wege */}
          {WORLD.edges.map(([a, b]) => {
            if (!seen.has(a) || !seen.has(b)) return null;
            const A = nodeById(a)!;
            const B = nodeById(b)!;
            const onPath = pathSet.has(a) && pathSet.has(b);
            // Auf dem gemalten Bild bleiben Wege dezent (Pergament-Tinte), der geplante Weg leuchtet
            return (
              <line
                key={`${a}-${b}`}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke={onPath ? '#f2c14e' : mapImg ? '#2b1d10' : '#5a4127'}
                strokeWidth={onPath ? 7 : mapImg ? 3.5 : 4}
                strokeDasharray={onPath ? undefined : '10 8'}
                strokeLinecap="round"
                opacity={onPath ? 0.95 : mapImg ? 0.55 : 0.9}
              />
            );
          })}
          {/* Nebel */}
          <rect width={W} height={H} fill="#1b1712" opacity={0.82} mask="url(#fogmask)" pointerEvents="none" />
          {/* Orte */}
          {WORLD.nodes.map((n) => {
            if (!seen.has(n.id)) return null;
            const done = (n.type === 'truhe' && w.opened.has(n.id)) || ((n.type === 'gegner' || n.type === 'elite') && w.cleared.has(n.id) && !foeAvailable(w, n.id, today())) || (n.type === 'hauptstadt' && !!n.region && w.conquered.has(n.region));
            const locked = !regionAccess(w, n.region, level).ok;
            const big = n.type === 'hauptstadt' || n.type === 'start';
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`} onClick={() => setSel(n.id)} className="cursor-pointer" data-testid={`node-${n.id}`} role="button" aria-label={`${n.name} (${NODE_LABEL[n.type]})`}>
                <circle r={big ? 28 : 21} fill={COLOR[n.type]} stroke={sel === n.id ? '#f2c14e' : '#2b1d10'} strokeWidth={sel === n.id ? 5 : 3} opacity={done ? 0.45 : 1} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={big ? 28 : 20}>
                  {locked ? '🔒' : ICON[n.type]}
                </text>
                {/* Hauptstädte und Heimatstadt sind auf dem Kartenbild schon beschriftet */}
                {!mapImg && (big || n.type === 'elite') && (
                  <text y={big ? 50 : 40} textAnchor="middle" fontSize="18" fontWeight="700" fill="#2b1d10" stroke="#e9dcb8" strokeWidth="4" paintOrder="stroke">
                    {n.name}
                  </text>
                )}
              </g>
            );
          })}
          {/* Held */}
          <g transform={`translate(${pos.x} ${pos.y - 46})`} style={{ transition: 'transform 700ms ease-in-out' }} pointerEvents="none" data-testid="hero-marker">
            <circle r="24" fill="#f2c14e" stroke="#2b1d10" strokeWidth="3" />
            <foreignObject x="-20" y="-24" width="40" height="44">
              <HeadPreview look={settings.hero.look ?? {}} size={40} className="!rounded-full" />
            </foreignObject>
            <path d="M -8 22 L 0 36 L 8 22 Z" fill="#f2c14e" stroke="#2b1d10" strokeWidth="2" />
          </g>
        </svg>
      </div>

      {sel && <NodeSheet game={game} id={sel} onClose={() => setSel(null)} busy={busy} run={run} kg={kg} stats={stats} preview={preview} />}

      <Sheet open={help} onClose={() => setHelp(false)} title="Aktionspunkte">
        <p className="text-sm text-muted">Aktionspunkte (AP) gibt es nur für echtes Verhalten. Du kannst höchstens {AP_CAP} speichern – also regelmäßig einsetzen.</p>
        <ul className="mt-3 divide-y text-sm" data-testid="ap-rules">
          {AP_RULES.map((r) => (
            <li key={r.label} className="flex justify-between py-1.5">
              <span>{r.label}</span>
              <b className="tabular-nums text-gold">+{r.ap}</b>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium">Kosten</p>
        <ul className="mt-1 space-y-0.5 text-sm text-muted">
          <li>Reisen: {AP_COST.move} AP je Wegstück</li>
          <li>
            Gegnertrupp: {AP_COST.fight} AP · Elite: {AP_COST.elite} AP · Truhe: {AP_COST.chest} AP
          </li>
          <li>Boss belagern: {AP_COST.siege} AP, einmal pro Tag</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Kampfgeist: An Tagen mit Training kämpfst du mit +15 % Angriff. Heute verdient: {game.world.apToday} AP.
        </p>
      </Sheet>
    </div>
  );
}

function NodeSheet({
  game,
  id,
  onClose,
  busy,
  run,
  kg,
  stats,
  preview,
}: {
  game: GameState;
  id: string;
  onClose: () => void;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  kg: boolean;
  stats: ReturnType<typeof heroStatsFor> | null;
  preview: ReturnType<typeof findPath> | null;
}) {
  const w = game.world.state;
  const n = nodeById(id)!;
  const region = n.region ? regionById(n.region) : undefined;
  const access = regionAccess(w, n.region, game.level.level);
  const here = w.pos === id;
  const d = today();
  const ap = game.world.ap;
  const foe = n.region && (n.type === 'gegner' || n.type === 'elite' || n.type === 'hauptstadt') ? foeFor(n.region, n.type, n.type === 'hauptstadt' ? bossOfRegion(region!).name : n.name) : null;
  const chance = foe && stats && n.type !== 'hauptstadt' ? winChance(stats, foe, kg) : null;
  const bossLeft = n.type === 'hauptstadt' && n.region && foe ? foe.hp - Math.min(foe.hp, w.bossDmg.get(n.region) ?? 0) : null;

  const lootNote = (loot: string[], denare: number) => [...loot.map((l) => itemById(l)?.name).filter(Boolean), denare ? `${denare} Denare` : ''].filter(Boolean).join(', ');

  return (
    <Sheet open onClose={onClose} title={n.name}>
      <div className="space-y-3" data-testid="node-sheet">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge>{NODE_LABEL[n.type]}</Badge>
          {region && <span>{region.name}</span>}
          {region && <span>· empfohlene Kraft {recommendedPower(region.id)}</span>}
        </div>
        {region && ['gegner', 'elite', 'truhe', 'hauptstadt'].includes(n.type) && (
          <p className="text-xs text-muted" data-testid="loot-table">
            Mögliche Beute: Rüstung {lootLabel(regionIndex(region.id))} · {weaponLootLabel(regionIndex(region.id))}
            {n.type === 'gegner' ? ' (die höchste Stufe nur bei Elite, Truhe und Boss)' : ''}
          </p>
        )}
        {!access.ok && (
          <p className="flex items-center gap-2 rounded-xl bg-warn/10 p-2 text-sm text-warn">
            <Lock className="h-4 w-4" /> {access.reason}
          </p>
        )}

        {foe && n.type !== 'hauptstadt' && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs" data-testid="foe-stats">
            <Stat icon={<Swords className="h-3.5 w-3.5" />} label="Angriff" value={foe.atk} />
            <Stat icon={<Shield className="h-3.5 w-3.5" />} label="Verteidigung" value={foe.def} />
            <Stat icon={<Heart className="h-3.5 w-3.5" />} label="Leben" value={foe.hp} />
          </div>
        )}
        {chance != null && (
          <p className="text-sm" data-testid="win-chance">
            Siegchance: <b className={cn(chance >= 0.7 ? 'text-accent' : chance >= 0.35 ? 'text-warn' : 'text-danger')}>{chance >= 0.95 ? 'sehr hoch' : chance >= 0.7 ? 'hoch' : chance >= 0.35 ? 'offen' : 'gering'}</b>
            {kg && <span className="text-gold"> · Kampfgeist aktiv</span>}
          </p>
        )}
        {n.type === 'hauptstadt' && region && foe && (
          <div className="space-y-1">
            <div className="text-sm">
              Boss: <b>{bossOfRegion(region).name}</b> – {bossOfRegion(region).epithet}
            </div>
            {w.conquered.has(region.id) ? (
              <Badge tone="accent">Erobert am {formatDate(w.conquered.get(region.id)!)}</Badge>
            ) : (
              <p className="text-sm tabular-nums" data-testid="boss-left">
                {fmt(bossLeft!)} / {fmt(foe.hp)} LP · höchstens ein Viertel pro Angriff, ein Angriff pro Tag
              </p>
            )}
          </div>
        )}
        {(n.type === 'dorf' || n.type === 'lager' || n.type === 'weg' || n.type === 'start') && (
          <p className="text-sm text-muted">{n.type === 'start' ? 'Deine Heimatstadt. Von hier aus beginnt die Reise.' : n.type === 'dorf' ? 'Die Leute erzählen von den Gegnern in der Region. Händler und Aufträge folgen bald.' : n.type === 'lager' ? 'Ein sicherer Rastplatz.' : 'Eine Wegkreuzung.'}</p>
        )}

        {/* Aktionen */}
        {!here ? (
          preview && 'path' in preview ? (
            <Button className="w-full" disabled={busy || ap < preview.path.length} onClick={() => run(async () => { await travel(id, game); onClose(); })} data-testid="travel">
              Hierher reisen · {preview.path.length} AP
            </Button>
          ) : (
            preview && 'error' in preview && <p className="text-sm text-muted">{preview.error}</p>
          )
        ) : (
          <>
            {(n.type === 'gegner' || n.type === 'elite') &&
              (foeAvailable(w, id, d) ? (
                <Button
                  className="w-full"
                  disabled={busy || ap < (n.type === 'elite' ? AP_COST.elite : AP_COST.fight)}
                  data-testid="fight"
                  onClick={() =>
                    run(async () => {
                      const o = await fight(id, game);
                      onClose();
                      showFight(o);
                    })
                  }
                >
                  <Swords className="h-4 w-4" /> Kämpfen · {n.type === 'elite' ? AP_COST.elite : AP_COST.fight} AP
                </Button>
              ) : (
                <p className="text-sm text-muted">Geschlagen. Ein neuer Trupp sammelt sich spätestens {RESPAWN_DAYS} Tage nach dem letzten Kampf.</p>
              ))}
            {n.type === 'truhe' &&
              (w.opened.has(id) ? (
                <p className="text-sm text-muted">Die Truhe ist leer.</p>
              ) : (
                <Button
                  className="w-full"
                  disabled={busy || ap < AP_COST.chest}
                  data-testid="open-chest"
                  onClick={() =>
                    run(async () => {
                      const r = await openChest(id, game);
                      toast(`Truhe geöffnet: ${[lootNote(r.loot, r.denare), matText(r.mats)].filter(Boolean).join(', ')}${r.pity ? ' · Glück des Tapferen' : ''}`, 'success');
                      onClose();
                    })
                  }
                >
                  Öffnen · {AP_COST.chest} AP
                </Button>
              ))}
            {n.type === 'hauptstadt' && region && !w.conquered.has(region.id) && (
              <Button
                className="w-full"
                disabled={busy || ap < AP_COST.siege || w.lastSiege.get(region.id) === d}
                data-testid="siege"
                onClick={() =>
                  run(async () => {
                    const o = await siege(id, game);
                    onClose();
                    showFight(o);
                  })
                }
              >
                <Swords className="h-4 w-4" /> {w.lastSiege.get(region.id) === d ? 'Heute schon angegriffen' : `Belagern · ${AP_COST.siege} AP`}
              </Button>
            )}
            {blocks(w, id) && n.type !== 'hauptstadt' && <p className="text-xs text-muted">Der Weg weiter ist erst frei, wenn dieser Gegner besiegt ist.</p>}
          </>
        )}
        <p className="text-right text-xs text-muted">
          Vorrat: {ap} AP
        </p>
      </div>
    </Sheet>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-fg/[0.05] p-2">
      <div className="flex items-center justify-center gap-1 text-muted">
        {icon} {label}
      </div>
      <div className="text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}
