// Grafiken des RPG: Bilder aus src/assets/rpg (falls vorhanden), sonst gezeichnete Platzhalter.
// Effekte, Rahmen und Animationen entstehen hier im Code – die Bilder bleiben statisch.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/components/ui';
import { useReducedMotion } from '@/hooks/motion';
import { RARITY_COLOR, appearanceStage, itemFile, portraitFile, type EffectId, type ItemDef, type Rarity, type SlotId } from '@/domain/equipment';
import type { HeroClassId } from '@/domain/rpg';
import { bodyFile, bodyTypeLabel, type BodyTypeId } from '@/domain/bodyType';
import { bossFile, type Boss } from '@/domain/rpg';
import { useBodyType } from '@/hooks/game';

// Alle Bilder, die im Ordner src/assets/rpg liegen – fehlende fallen still auf Platzhalter zurück.
const FILES = import.meta.glob('../../assets/rpg/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ASSETS = new Map(Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.(png|webp|jpe?g)$/, ''), url]));
export const rpgAsset = (name: string) => ASSETS.get(name);
export const rpgAssetCount = () => ASSETS.size;

// ---------------------------------------------------------------------------
// Platzhalter-Glyphen je Slot
// ---------------------------------------------------------------------------

const GLYPHS: Record<SlotId | 'twohand', ReactNode> = {
  main: <path d="M44 6 L50 12 L22 40 L26 44 L22 48 L18 44 L12 50 L8 46 L14 40 L10 36 L14 32 L18 36 Z" />,
  twohand: <path d="M30 6 h10 v8 h-10 Z M33 14 h4 v38 h-4 Z M24 8 h4 v10 h-4 Z M42 8 h4 v10 h-4 Z" />,
  off: <path d="M28 6 L48 12 V28 C48 40 39 48 28 52 C17 48 8 40 8 28 V12 Z" />,
  head: <path d="M28 8 C40 8 46 18 46 30 V40 H38 V30 H18 V40 H10 V30 C10 18 16 8 28 8 Z M26 2 h4 v8 h-4 Z" />,
  hands: <path d="M18 22 V10 a3 3 0 0 1 6 0 V22 V8 a3 3 0 0 1 6 0 V22 V10 a3 3 0 0 1 6 0 V26 l4 -6 a3 3 0 0 1 5 3 L38 40 C35 46 30 50 24 50 C18 50 14 45 14 38 V18 a2 2 0 0 1 4 0 Z" />,
  legs: <path d="M14 6 H42 L46 50 H34 L28 20 L22 50 H10 Z" />,
  feet: <path d="M16 6 H28 V32 L46 38 C50 40 50 48 46 48 H12 C10 48 10 44 12 42 L16 36 Z" />,
};

function Glyph({ slot, twoHanded, color }: { slot: SlotId; twoHanded?: boolean; color: string }) {
  return (
    <svg viewBox="0 0 56 56" className="h-[62%] w-[62%]" aria-hidden>
      <g fill={color} fillOpacity="0.85" stroke="rgb(var(--gold))" strokeOpacity="0.5" strokeWidth="1.2">
        {GLYPHS[twoHanded && slot === 'main' ? 'twohand' : slot]}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Effekte
// ---------------------------------------------------------------------------

type Motion = 'rise' | 'fall' | 'burst' | 'hop' | 'trail' | 'orbit' | 'pulse';
interface FxCfg {
  colors: string[];
  shape?: 'dot' | 'square' | 'drop' | 'leaf' | 'text';
  motion: Motion;
  size: number;
  dur: number;
  text?: string[];
  wrap?: string;
  shine?: boolean;
  ghost?: boolean;
  origin?: 'center' | 'top' | 'bottom' | 'tip';
}

const FX: Record<EffectId, FxCfg> = {
  sparks: { colors: ['#ffd36a', '#ffb347', '#fff2b3'], motion: 'burst', size: 3, dur: 1.1, origin: 'tip' },
  quake: { colors: ['#9b8a70', '#7a6a55'], shape: 'square', motion: 'hop', size: 3, dur: 1.4, wrap: 'fx-shake', origin: 'bottom' },
  ink: { colors: ['#20203a', '#3a2c5a'], shape: 'drop', motion: 'fall', size: 4, dur: 1.8, origin: 'tip' },
  steam: { colors: ['rgba(255,255,255,0.55)', '#7cc56a'], motion: 'rise', size: 5, dur: 2.2, origin: 'top' },
  shine: { colors: ['#ffffff'], motion: 'pulse', size: 2, dur: 2.5, shine: true },
  water: { colors: ['#5ab4ff', '#9ad3ff'], shape: 'drop', motion: 'fall', size: 4, dur: 1.5, origin: 'top' },
  balance: { colors: ['#ffd36a'], motion: 'rise', size: 2, dur: 1.8, wrap: 'fx-balance' },
  fire: { colors: ['#ff7a1a', '#ffd24a', '#ff4d1a'], motion: 'rise', size: 4, dur: 1.2, origin: 'top' },
  spin: { colors: ['#ffffff'], motion: 'pulse', size: 2, dur: 2, wrap: 'fx-spin', shine: true },
  plume: { colors: ['#c42a2a'], motion: 'trail', size: 3, dur: 1.8, wrap: 'fx-sway', origin: 'top' },
  leaves: { colors: ['#e6b84a', '#f3d27a'], shape: 'leaf', motion: 'fall', size: 5, dur: 2.6, origin: 'top' },
  grapes: { colors: ['#6b2d8c', '#8e3fb0'], motion: 'fall', size: 5, dur: 2.4, wrap: 'fx-bounce', origin: 'center' },
  orbit: { colors: ['#9fe8ff', '#ffffff'], motion: 'orbit', size: 3, dur: 3.2 },
  powder: { colors: ['rgba(255,255,255,0.8)'], motion: 'burst', size: 6, dur: 1.6 },
  sand: { colors: ['#d6b478', '#b8925a'], motion: 'burst', size: 3, dur: 1.2, origin: 'bottom' },
  chalk: { colors: ['rgba(255,255,255,0.9)'], motion: 'fall', size: 2, dur: 1.6, origin: 'center' },
  tape: { colors: ['#ffd36a'], shape: 'text', motion: 'rise', size: 9, dur: 2.2, text: ['1', '5', '10', '25', 'cm'], wrap: 'fx-sway' },
  crests: { colors: ['#c42a2a', '#2f5fa8', '#2f7d5b', '#d4a64a'], shape: 'square', motion: 'pulse', size: 4, dur: 2.4 },
  trail: { colors: ['#c8a878', '#a8885a'], motion: 'trail', size: 3, dur: 1, origin: 'bottom' },
  stomp: { colors: ['#a8946e'], motion: 'burst', size: 4, dur: 0.9, wrap: 'fx-bounce', origin: 'bottom' },
  shadow: { colors: ['rgba(30,20,40,0.6)'], motion: 'trail', size: 5, dur: 1.4, ghost: true, origin: 'bottom' },
};
const COUNT: Record<Rarity, number> = { common: 0, rare: 4, epic: 7, legendary: 11 };
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function EffectLayer({ effect, rarity }: { effect: EffectId; rarity: Rarity }) {
  const reduced = useReducedMotion();
  const cfg = FX[effect];
  const n = COUNT[rarity];
  const parts = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const o = cfg.origin ?? 'center';
        const left = o === 'tip' ? 62 + rnd(i, 1) * 22 : 18 + rnd(i, 1) * 64;
        const top = o === 'top' || o === 'tip' ? 10 + rnd(i, 2) * 25 : o === 'bottom' ? 68 + rnd(i, 2) * 20 : 30 + rnd(i, 2) * 40;
        const color = cfg.colors[i % cfg.colors.length] ?? '#fff';
        const style: CSSProperties & Record<string, string | number> = {
          left: `${left}%`,
          top: `${top}%`,
          width: cfg.size,
          height: cfg.shape === 'drop' ? cfg.size * 1.4 : cfg.size,
          background: color,
          color,
          animationName: `fx-${cfg.motion}`,
          animationDuration: `${cfg.dur * (0.75 + rnd(i, 3) * 0.6)}s`,
          animationDelay: `${-rnd(i, 4) * cfg.dur * 1.5}s`,
          '--dx': `${(rnd(i, 5) - 0.5) * 30}px`,
          '--dy': `${(rnd(i, 6) - 0.7) * 34}px`,
          '--rot': `${rnd(i, 7) * 180}deg`,
          '--r': `${22 + rnd(i, 8) * 14}px`,
        };
        if (cfg.motion === 'orbit') Object.assign(style, { left: '50%', top: '50%', animationTimingFunction: 'linear' });
        return { style, text: cfg.text?.[i % cfg.text.length] };
      }),
    [cfg, n],
  );
  if (reduced || n === 0) return null;
  return (
    <div className="fx-layer" aria-hidden>
      {cfg.shine && <div className="fx-shine" />}
      {parts.map((p, i) => (
        <span key={i} className={cn('fx-p', cfg.shape)} style={p.style}>
          {p.text}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item-Icon mit Seltenheitsrahmen und Effekt
// ---------------------------------------------------------------------------

export function ItemIcon({ item, rarity, size = 56, locked = false, animate = true, className }: { item: ItemDef; rarity: Rarity | null; size?: number; locked?: boolean; animate?: boolean; className?: string }) {
  const reduced = useReducedMotion();
  const url = rpgAsset(itemFile(item));
  const r: Rarity = rarity ?? 'common';
  const color = RARITY_COLOR[r];
  const cfg = item.effect ? FX[item.effect] : undefined;
  const wrap = animate && !locked && !reduced && rarity && rarity !== 'common' ? cfg?.wrap : undefined;
  const img = url ? (
    <img src={url} alt="" className={cn('h-[86%] w-[86%] object-contain', locked && 'opacity-30 grayscale')} draggable={false} />
  ) : (
    <span className={cn('flex h-full w-full items-center justify-center', locked && 'opacity-30 grayscale')}>
      <Glyph slot={item.slot} twoHanded={item.twoHanded} color={locked ? '#666' : color} />
    </span>
  );
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-fg/[0.08] to-fg/[0.02]', !locked && 'rarity-frame', !locked && r, className)}
      style={{ width: size, height: size, ['--rc' as string]: locked ? 'rgb(var(--border))' : color }}
      role="img"
      aria-label={`${item.name}${rarity ? ` (${r === 'common' ? 'Gewöhnlich' : r})` : ''}${locked ? ', gesperrt' : ''}`}
      data-rarity={locked ? 'locked' : r}
    >
      {!locked && r === 'legendary' && animate && !reduced && <span className="rarity-rays" style={{ ['--rc' as string]: color }} />}
      {cfg?.ghost && animate && !locked && !reduced && rarity !== 'common' && <span className="fx-ghost absolute inset-0 flex items-center justify-center">{img}</span>}
      <span className={cn('relative flex h-full w-full items-center justify-center', wrap)}>{img}</span>
      {animate && !locked && item.effect && rarity && <EffectLayer effect={item.effect} rarity={rarity} />}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Porträt nach Klasse und Rangstufe
// ---------------------------------------------------------------------------

const STAGE_STYLE = [
  { tunic: '#8a7f72', trim: '#6b6258', cloak: null, gold: false },
  { tunic: '#8c6a4a', trim: '#5c432d', cloak: null, gold: false },
  { tunic: '#9aa3ad', trim: '#6e7781', cloak: null, gold: false },
  { tunic: '#b08d4a', trim: '#7d5f28', cloak: '#9e1b32', gold: true },
  { tunic: '#d4a64a', trim: '#8f6a1e', cloak: '#5b1f6e', gold: true },
] as const;

function PlaceholderPortrait({ stage, crest }: { stage: number; crest: string }) {
  const s = STAGE_STYLE[stage - 1]!;
  return (
    <svg viewBox="0 0 200 250" className="h-full w-full" aria-hidden>
      {s.cloak && <path d="M30 250 C30 170 50 140 100 135 C150 140 170 170 170 250 Z" fill={s.cloak} />}
      <path d="M40 250 C42 185 62 158 100 152 C138 158 158 185 160 250 Z" fill={s.tunic} stroke={s.trim} strokeWidth="3" />
      {stage >= 3 && <path d="M62 190 H138 M58 210 H142 M56 230 H144" stroke={s.trim} strokeWidth="2" opacity="0.7" />}
      {s.gold && <circle cx="100" cy="172" r="7" fill="rgb(var(--gold))" />}
      <rect x="88" y="120" width="24" height="30" rx="8" fill="#c99a78" />
      <ellipse cx="100" cy="92" rx="34" ry="40" fill="#d8aa86" />
      <path d={stage === 1 ? 'M66 84 C64 52 84 44 100 46 C120 44 138 56 134 86 C128 70 120 64 112 70 C104 60 88 62 80 72 C74 68 70 76 66 84 Z' : 'M66 82 C66 54 84 48 100 48 C118 48 134 56 134 82 C128 66 112 60 100 62 C88 60 72 66 66 82 Z'} fill="#3a2a20" />
      <path d="M86 92 h8 M106 92 h8" stroke="#3a2a20" strokeWidth="3" strokeLinecap="round" />
      <path d={stage <= 1 ? 'M90 112 Q100 108 110 112' : 'M90 110 Q100 116 110 110'} stroke="#8a5a44" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {stage >= 3 && <path d="M118 84 l8 14" stroke="#a5655a" strokeWidth="2" />}
      {stage === 5 && (
        <g fill="rgb(var(--gold))">
          {Array.from({ length: 7 }, (_, k) => (
            <ellipse key={k} cx={70 + k * 10} cy={54 - Math.sin((k / 6) * Math.PI) * 8} rx="5" ry="3" transform={`rotate(${-30 + k * 10} ${70 + k * 10} ${54 - Math.sin((k / 6) * Math.PI) * 8})`} />
          ))}
        </g>
      )}
      <path d="M100 196 l9 4 v10 c0 8 -5 12 -9 14 c-4 -2 -9 -6 -9 -14 v-10 Z" fill={crest} stroke="rgb(var(--gold))" strokeWidth="1.5" />
    </svg>
  );
}

// Ausschnitt Kopf und Schultern aus dem Ganzkörperbild (Kopf liegt in allen Körperbildern an derselben Stelle)
const HEAD_CROP: CSSProperties = { position: 'absolute', width: '379%', maxWidth: 'none', left: '-139.4%', top: '-18.2%' };

export function HeroPortrait({ classId, rankLevel, crest, aura, size = 160, className, transform = false }: { classId: HeroClassId; rankLevel: number; crest: string; aura?: string | null; size?: number; className?: string; transform?: boolean }) {
  const stage = appearanceStage(rankLevel);
  const url = rpgAsset(portraitFile(classId, stage));
  const body = useBodyType();
  const bodyUrl = !url && body ? rpgAsset(bodyFile(body.id)) : undefined;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size * 1.25 }} data-testid="hero-portrait" data-stage={stage}>
      {aura && <div className="aura" style={{ background: aura }} />}
      <div className={cn('portrait-breathe relative h-full w-full', transform && 'transform-in', bodyUrl && 'overflow-hidden rounded-[22%]')}>
        {url ? (
          <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : bodyUrl ? (
          <img src={bodyUrl} alt="" style={HEAD_CROP} draggable={false} data-testid="portrait-body-crop" />
        ) : (
          <PlaceholderPortrait stage={stage} crest={crest} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ganzkörper-Held in Ebenen: Grundkörper → Merkmale → Ausrüstung
// Alle Ebenen liegen auf demselben Raster (2:3, Kopf oben mittig), daher einfach übereinander.
// ---------------------------------------------------------------------------

export function HeroFigure({ bodyType, aura, width = 140, className, children }: { bodyType: BodyTypeId; aura?: string | null; width?: number; className?: string; children?: ReactNode }) {
  const url = rpgAsset(bodyFile(bodyType));
  return (
    <div className={cn('relative shrink-0', className)} style={{ width, height: width * 1.5 }} data-testid="hero-figure" data-body={bodyType} role="img" aria-label={`Held, Körperbau: ${bodyTypeLabel(bodyType)}`}>
      {aura && <div className="aura" style={{ background: aura }} />}
      <div className="portrait-breathe relative h-full w-full">
        {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boss: Bild (transparent, Blick nach links, unten bündig) oder gezeichnete Silhouette
// ---------------------------------------------------------------------------

export function BossFigure({ boss, idle = false, className }: { boss: Pick<Boss, 'id' | 'name'>; idle?: boolean; className?: string }) {
  const url = rpgAsset(bossFile(boss));
  return (
    <div className={cn('relative aspect-[2/3] w-full', className)} data-testid="boss-figure" data-boss={boss.id}>
      <div className={cn('absolute inset-0', idle && 'boss-idle')}>
        {url ? (
          <img src={url} alt="" className="boss-fade absolute inset-0 h-full w-full object-contain object-bottom" draggable={false} />
        ) : (
          <svg viewBox="0 0 200 300" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id="boss-glow" cx="50%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#9e1b32" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#9e1b32" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="100" cy="120" rx="100" ry="130" fill="url(#boss-glow)" />
            <g fill="#140b0e" stroke="#3a1a22" strokeWidth="2">
              <path d="M58 70 L70 40 L84 62 L100 30 L116 62 L130 40 L142 70 Z" />
              <ellipse cx="100" cy="88" rx="30" ry="34" />
              <path d="M40 300 L46 170 C48 140 66 122 100 120 C134 122 152 140 154 170 L160 300 Z" />
              <path d="M46 160 L18 240 L32 246 L62 184 Z M154 160 L182 240 L168 246 L138 184 Z" />
              <path d="M172 140 L180 140 L180 290 L172 290 Z" />
            </g>
            <circle cx="89" cy="86" r="3.5" fill="#ff4d4d" />
            <circle cx="111" cy="86" r="3.5" fill="#ff4d4d" />
          </svg>
        )}
      </div>
    </div>
  );
}
