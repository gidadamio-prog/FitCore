// Nach Training/Mahlzeit: Bilanz mit neu verdienten Aktionspunkten.
// Auf der Weltkarte: Kampfszene gegen Gegnertrupps, Elite-Gegner und Bosse (Belagerung).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, Swords, Zap, Coins, Flame, Hammer } from 'lucide-react';
import { matText } from '@/domain/forge';
import { Button, cn, fmt } from './ui';
import { useBattle, type BattleScene as Scene } from '@/stores/battle';
import { useGame, useBodyType } from '@/hooks/game';
import { useSettings } from '@/hooks/data';
import { useReducedMotion } from '@/hooks/motion';
import { db } from '@/data/db';
import { toast } from '@/stores/ui';
import { today } from '@/domain/dates';
import { bossRewards } from '@/domain/appearance';
import { traitAvailable } from '@/pages/game/LookEditor';
import { itemById } from '@/domain/equipment';
import { CAMPAIGN } from '@/domain/rpg';
import { BossFigure, HeroFigure, HeroPortrait, ItemIcon } from './rpg/Visuals';
import { initWorld } from '@/data/worldRepo';

const ACK_KEY = 'apAck';

/** Startet die Welt (Übernahme alter Spielstände) und zeigt nach Training/Mahlzeit die neu verdienten AP. */
export function BattleWatcher() {
  const game = useGame();
  const { hero } = useSettings();
  const pending = useBattle((s) => s.pending);
  const [tick, setTick] = useState(0);
  const busy = useRef(false);
  const init = useRef(false);

  useEffect(() => {
    if (!game || init.current) return;
    init.current = true;
    void initWorld(game);
  }, [game]);

  useEffect(() => {
    if (!pending || !game || busy.current) return;
    const now = game.world.apToday;
    if (pending.seenAp != null && now === pending.seenAp && Date.now() - pending.at < 2500) {
      const t = setTimeout(() => setTick((x) => x + 1), 200);
      return () => clearTimeout(t);
    }
    busy.current = true;
    const { open, clearPending } = useBattle.getState();
    void (async () => {
      const d = today();
      const row = (await db.settings.get(ACK_KEY))?.value as { date: string; ap: number } | undefined;
      const before = row?.date === d ? row.ap : pending.seenAp ?? 0;
      await db.settings.put({ key: ACK_KEY, value: { date: d, ap: now } });
      const gained = Math.max(0, now - before);
      if (pending.reason === 'meal' && !gained) {
        clearPending();
        toast(`${pending.title}`, 'success');
        return;
      }
      if (!hero) return clearPending();
      open({ kind: 'summary', request: pending, ap: gained, balance: game.world.ap });
    })().finally(() => {
      busy.current = false;
    });
  }, [pending, game, hero, tick]);
  return null;
}

export function BattleHost() {
  const scene = useBattle((s) => s.scene);
  if (!scene) return null;
  return scene.kind === 'summary' ? <Summary key={scene.id} scene={scene} /> : <FightStage key={scene.id} scene={scene} />;
}

function Summary({ scene }: { scene: Extract<Scene, { kind: 'summary' }> }) {
  const close = useBattle((s) => s.close);
  const nav = useNavigate();
  const { request } = scene;
  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-black/60 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Bilanz" data-testid="battle">
      <div className="battle-result w-full rounded-t-3xl border-t border-gold/40 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-md sm:rounded-3xl" data-testid="battle-result">
        <div className="text-[11px] uppercase tracking-[0.2em] text-gold">{request.reason === 'workout' ? 'Training beendet' : 'Mahlzeit abgeschlossen'}</div>
        <h2 className="font-brand text-xl font-bold">{request.title}</h2>
        {request.lines && request.lines.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm" data-testid="battle-summary">
            {request.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gold/10 p-3 ring-1 ring-gold/30">
          <Zap className="h-8 w-8 shrink-0 text-gold" />
          <div>
            <div className="font-brand text-2xl font-bold tabular-nums" data-testid="battle-ap">
              +{scene.ap} Aktionspunkte
            </div>
            <div className="text-xs text-muted">Vorrat jetzt {scene.balance} – damit reist und kämpfst du auf der Weltkarte.</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={close}>
            Weiter
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              close();
              nav('/karte');
            }}
          >
            <MapIcon className="h-4 w-4" /> Zur Karte
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kampfszene
// ---------------------------------------------------------------------------

const BEAT_MS = 620;

function FightStage({ scene }: { scene: Extract<Scene, { kind: 'fight' }> }) {
  const close = useBattle((s) => s.close);
  const reduced = useReducedMotion();
  const { hero } = useSettings();
  const body = useBodyType();
  const game = useGame();
  const o = scene.outcome;
  const blows = o.result.blows;
  const [step, setStep] = useState(reduced ? blows.length : -1);
  const done = step >= blows.length;
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setStep((s) => s + 1), step < 0 ? 900 : BEAT_MS);
    const b = blows[step];
    if (b?.by === 'hero') navigator.vibrate?.(30);
    return () => clearTimeout(t);
  }, [step, done, blows]);
  const cur = step >= 0 ? blows[Math.min(step, blows.length - 1)] : undefined;
  const foeHp = done ? o.result.foeHpEnd : cur ? cur.foeHp : o.result.foeHpStart;
  const heroHp = done ? o.result.heroHpEnd : cur ? cur.heroHp : o.hero.hp;
  const maxFoe = o.bossHpMax ?? o.foe.hp;
  const isBoss = o.foe.kind === 'boss';
  const boss = isBoss ? CAMPAIGN.find((b) => b.name === o.foe.name) : undefined;
  const rewards = useMemo(() => (boss && o.killed ? bossRewards(boss.id, traitAvailable) : []), [boss, o.killed]);
  const blow = !done && cur && step >= 0 ? cur : null;

  const verdict = isBoss ? (o.killed ? `${o.foe.name} ist gefallen!` : 'Belagerung fortgesetzt') : o.result.won ? 'Sieg!' : 'Rückzug';
  return (
    <div className="battle fixed inset-0 z-[75] flex flex-col overflow-hidden text-white" role="dialog" aria-modal="true" aria-label={`Kampf gegen ${o.foe.name}`} data-testid="battle">
      <div className="battle-bg absolute inset-0" aria-hidden />
      <div className="relative z-10 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="text-[11px] uppercase tracking-[0.2em] text-gold">
          {o.regionName} · {isBoss ? 'Belagerung' : o.foe.kind === 'elite' ? 'Elite' : 'Gegnertrupp'}
        </div>
        <div className="font-brand text-2xl font-bold" data-testid="battle-boss">
          {o.foe.name}
        </div>
        <Bar value={foeHp} max={maxFoe} color="bg-danger" label={`Lebenspunkte ${o.foe.name}`} />
        <div className="mt-1 flex justify-between text-xs text-white/70">
          <span className="tabular-nums" data-testid="battle-hp">
            {fmt(foeHp)} / {fmt(maxFoe)} LP
          </span>
          {!done && (
            <button className="underline-offset-2 hover:underline" onClick={() => setStep(blows.length)}>
              Überspringen
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-end justify-between px-4 pb-[16vh]">
        <div className={cn('relative z-10 w-[36%] max-w-[200px]', step < 0 && !reduced && 'battle-enter-left', blow?.by === 'hero' && 'battle-lunge', blow?.by === 'foe' && 'battle-hit')} key={`h${step}`}>
          {body ? (
            <HeroFigure bodyType={body.id} width={Math.min(200, typeof window !== 'undefined' ? window.innerWidth * 0.36 : 150)} />
          ) : hero ? (
            <HeroPortrait classId={hero.classId} rankLevel={game?.rank.rank.level ?? 1} crest={hero.color} size={140} />
          ) : null}
          <div className="mt-1">
            <Bar value={heroHp} max={o.hero.hp} color="bg-accent" label="Deine Lebenspunkte" small />
          </div>
          {blow?.by === 'foe' && (
            <div key={step} className="dmg-float absolute left-1/2 top-[10%] -translate-x-1/2 font-brand text-2xl font-bold text-danger drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              −{fmt(blow.dmg)}
            </div>
          )}
        </div>
        <div className="relative w-[46%] max-w-[256px]">
          <div key={`f${step}`} className={cn('relative', step < 0 && !reduced && 'battle-enter-right', blow?.by === 'hero' && 'battle-hit', done && (isBoss ? o.killed : o.result.won) && 'battle-defeat')}>
            <BossFigure boss={boss ?? { id: `foe-${o.foe.kind}`, name: o.foe.name }} idle={!blow} />
          </div>
          {blow?.by === 'hero' && <div className="battle-slash pointer-events-none absolute inset-0" aria-hidden />}
          {blow?.by === 'hero' && (
            <div key={step} className="dmg-float absolute left-1/2 top-[8%] -translate-x-1/2 whitespace-nowrap font-brand text-3xl font-bold text-gold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" data-testid="battle-damage">
              −{fmt(blow.dmg)}
            </div>
          )}
        </div>
      </div>

      {done && (
        <div className="battle-result absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-gold/40 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-fg shadow-2xl" data-testid="battle-result">
          <h2 className={cn('font-brand text-2xl font-bold', (isBoss ? o.killed : o.result.won) ? 'text-gold' : 'text-fg')} data-testid="fight-verdict">
            {verdict}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="flex items-center gap-1">
              <Swords className="h-4 w-4 text-gold" /> {fmt(o.result.dealt)} Schaden
            </span>
            {o.kampfgeist && (
              <span className="flex items-center gap-1 text-gold">
                <Flame className="h-4 w-4" /> Kampfgeist +15 %
              </span>
            )}
            {o.denare > 0 && (
              <span className="flex items-center gap-1">
                <Coins className="h-4 w-4 text-gold" /> +{o.denare} Denare
              </span>
            )}
            {o.mats && matText(o.mats) && (
              <span className="flex items-center gap-1" data-testid="battle-mats">
                <Hammer className="h-4 w-4 text-gold" /> {matText(o.mats)}
              </span>
            )}
          </div>
          {isBoss && !o.killed && <p className="mt-1 text-sm text-muted">Noch {fmt(o.result.foeHpEnd)} LP. Ein Angriff pro Tag – morgen geht die Belagerung weiter.</p>}
          {!isBoss && !o.result.won && <p className="mt-1 text-sm text-muted">Zu stark für dich. Verbessere deine Ausrüstung oder trainiere heute für Kampfgeist.</p>}
          {rewards.length > 0 && (
            <p className="mt-1 text-sm text-gold" data-testid="battle-rewards">
              Freigeschaltet: {rewards.join(' · ')}
            </p>
          )}
          {o.loot.length > 0 && (
            <div className="mt-3" data-testid="battle-loot">
              <div className="text-xs font-semibold uppercase tracking-wide text-gold">Beute{o.pity ? ' · Glück des Tapferen' : ''}</div>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {o.loot.map((id) => {
                  const def = itemById(id);
                  return def ? (
                    <div key={id} className="flex w-20 flex-col items-center gap-0.5">
                      <ItemIcon item={def} rarity="rare" size={52} />
                      <span className="text-center text-[10px] leading-tight">{def.name}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
          <Button className="mt-4 w-full" onClick={close}>
            Weiter
          </Button>
        </div>
      )}
    </div>
  );
}

function Bar({ value, max, color, label, small }: { value: number; max: number; color: string; label: string; small?: boolean }) {
  const pct = `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%`;
  return (
    <div className={cn('relative mt-2 w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-white/20', small ? 'h-2' : 'h-3.5')} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-white/70 transition-[width] delay-300 duration-700 ease-out" style={{ width: pct }} />
      <div className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out', color)} style={{ width: pct }} />
    </div>
  );
}
