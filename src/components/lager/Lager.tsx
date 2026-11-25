import type { ReactNode } from 'react';
import { Swords, Zap } from 'lucide-react';
import { HeroFigure, HeroPortrait, rpgAsset } from '@/components/rpg/Visuals';
import { useBodyType } from '@/hooks/game';
import { useSettings } from '@/hooks/data';
import { ROMAN, type StationId, type StationState } from '@/domain/lager';
import type { GameState } from '@/domain/gamification';
import { Card, cn, fmt } from '@/components/ui';

/** Bild einer Station: höchste vorhandene Stufe bis zur erreichten (fehlende Stufenbilder fallen zurück). */
export function sceneUrl(id: StationId, tier: number): string | undefined {
  for (let k = tier + 1; k >= 1; k--) {
    const url = rpgAsset(`lager_${id}_${k}`);
    if (url) return url;
  }
  return undefined;
}

/** Ausbaustufe als kleines Schild mit Fortschritt zur nächsten Stufe */
export function TierLine({ st }: { st: StationState }) {
  return (
    <div className="mt-auto" data-testid={`tier-${st.id}`}>
      <div className="text-[10px] uppercase tracking-wider text-gold/90">
        Stufe {ROMAN[st.tier]} · {st.name}
      </div>
      <div className="mt-1 h-1 w-full max-w-[9rem] overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full bg-gold/80" style={{ width: `${Math.round(st.progress * 100)}%` }} />
      </div>
      {st.next && (
        <div className="mt-0.5 text-[10px] text-white/70">
          noch {fmt(st.next.remaining)} {st.next.unit} bis {st.next.name}
        </div>
      )}
    </div>
  );
}

/**
 * Station als Bildszene: Motiv rechts, links Titel und Live-Werte auf einem weichen Verlauf,
 * darunter die eigentlichen Eingaben und Details.
 */
export function SceneCard({ st, overlay, children, testId, onScene, sceneLabel }: { st: StationState; overlay?: ReactNode; children?: ReactNode; testId?: string; onScene?: () => void; sceneLabel?: string }) {
  const url = sceneUrl(st.id, st.tier);
  const Scene = onScene ? 'button' : 'div';
  return (
    <Card className="overflow-hidden p-0" data-testid={testId ?? `station-${st.id}`}>
      <Scene
        {...(onScene ? { type: 'button' as const, onClick: onScene, 'aria-label': sceneLabel ?? st.title } : {})}
        className="relative block aspect-[16/8] w-full overflow-hidden text-left"
      >
        {url ? (
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover object-right" draggable={false} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#3a2c1e] to-[#1c140d]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
        <div className="absolute inset-y-0 left-0 flex w-[62%] flex-col p-3 text-white">
          <div className="font-brand text-lg font-bold leading-tight drop-shadow">{st.title}</div>
          <div className="mt-1 min-h-0">{overlay}</div>
          <TierLine st={st} />
        </div>
      </Scene>
      {children && <div className="p-4">{children}</div>}
    </Card>
  );
}

/** Großer Wert im Bild (Zahl + Einheit) */
export function SceneValue({ value, unit, sub, testId }: { value: ReactNode; unit?: string; sub?: ReactNode; testId?: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-1 drop-shadow">
        <span className="text-3xl font-bold tabular-nums" data-testid={testId}>
          {value}
        </span>
        {unit && <span className="text-xs text-white/80">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-white/75">{sub}</div>}
    </div>
  );
}

/** Platzhalter-Lager (Abenddämmerung, Zelt, Feuer), bis das gemalte Lagerbild da ist */
function CampBackdrop() {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="camp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2440" />
          <stop offset="0.45" stopColor="#6b4a52" />
          <stop offset="0.62" stopColor="#c07a4a" />
          <stop offset="0.63" stopColor="#3a2c1c" />
          <stop offset="1" stopColor="#1d150d" />
        </linearGradient>
        <radialGradient id="camp-fire" cx="0.5" cy="0.86" r="0.45">
          <stop offset="0" stopColor="#ffb055" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb055" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#camp-sky)" />
      <path d="M0 250 L30 215 L55 240 L80 200 L110 238 L140 205 L170 242 L200 212 L235 245 L265 208 L300 240 L330 210 L365 238 L400 214 L400 260 L0 260Z" fill="#241b14" opacity="0.9" />
      <path d="M18 330 L78 232 L138 330 Z" fill="#c9b48a" opacity="0.85" />
      <path d="M78 232 L92 330 L64 330 Z" fill="#7a6545" opacity="0.8" />
      <rect width="400" height="400" fill="url(#camp-fire)" />
    </svg>
  );
}

/** Kopf der Startseite: dein Held im Lager, mit Stufe, Erfahrung und Aktionspunkten. */
export function HeroCamp({ game, onHero }: { game: GameState; onHero: () => void }) {
  const { hero } = useSettings();
  const body = useBodyType();
  const st = game.lager.lager;
  const url = sceneUrl('lager', st.tier);
  const lv = game.level;
  return (
    <div className="relative aspect-square max-h-[26rem] w-full overflow-hidden rounded-xl" data-testid="hero-camp">
      {url ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} /> : <CampBackdrop />}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
      {hero && (
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 text-white">
          <div className="min-w-0">
            <div className="font-brand truncate text-xl font-bold drop-shadow">{hero.name}</div>
            <div className="text-xs text-white/80">
              Stufe {lv.level} · {game.rank.rank.name}
            </div>
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-black/40" role="progressbar" aria-label="Erfahrung bis zur nächsten Stufe" aria-valuenow={Math.round(lv.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            </div>
            {lv.next && <div className="mt-0.5 text-[10px] text-white/70">noch {fmt(lv.toNext)} EP bis Stufe {lv.level + 1}</div>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5" data-testid="camp-ap">
              <Zap className="h-3.5 w-3.5 text-gold" /> {game.world.ap} AP
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5">
              <Swords className="h-3.5 w-3.5 text-gold" /> {fmt(game.battle.score)}
            </span>
          </div>
        </div>
      )}
      <button type="button" onClick={onHero} data-testid="today-hero" className={cn('absolute inset-x-0 bottom-0 flex flex-col items-center', hero ? 'top-20' : 'top-0 justify-center')} aria-label={hero ? `${hero.name} – Charakterbogen und Ausrüstung` : 'Helden erschaffen'}>
        {hero ? (
          <div className="relative mb-[4%] flex h-full items-end">
            <div className="absolute bottom-1 left-1/2 h-4 w-28 -translate-x-1/2 rounded-[50%] bg-black/45 blur-[3px]" />
            {body ? (
              <HeroFigure bodyType={body.id} width={150} className="relative" />
            ) : (
              <HeroPortrait classId={hero.classId} rankLevel={game.rank.rank.level} crest={hero.color} size={140} />
            )}
          </div>
        ) : (
          <span className="mx-6 rounded-xl bg-black/55 px-4 py-3 text-center text-sm font-medium text-gold">Erschaffe deinen Helden und zieh gegen die Bosse des Reiches →</span>
        )}
      </button>
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold/90" data-testid="tier-lager">
        {st.name} · {ROMAN[st.tier]}
      </div>
    </div>
  );
}
