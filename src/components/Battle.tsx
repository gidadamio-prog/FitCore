// Kampf-Inszenierung gegen den Feldzug-Boss nach Training oder abgeschlossener Mahlzeit.
// Der Schaden ist der Zuwachs seit dem letzten Kampf (persistiert in settings.battleAck).
import { bossRewards } from '@/domain/appearance';
import { traitAvailable } from '@/pages/game/LookEditor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Swords } from 'lucide-react';
import { Button, cn, fmt } from './ui';
import { useBattle, type BattleScene as Scene } from '@/stores/battle';
import { useGame, useBodyType } from '@/hooks/game';
import { useSettings } from '@/hooks/data';
import { useReducedMotion } from '@/hooks/motion';
import { db } from '@/data/db';
import { toast } from '@/stores/ui';
import { today } from '@/domain/dates';
import { battlePlan, type BattleHit } from '@/domain/battle';
import { bossAt, dayDamage, type Boss } from '@/domain/rpg';
import { BossFigure, HeroFigure, HeroPortrait, ItemIcon } from './rpg/Visuals';
import { LOOT_CHANCE, bonusValue, rollLoot } from '@/domain/armor';
import { itemById } from '@/domain/equipment';

const ACK_KEY = 'battleAck';

/** Startet einen angeforderten Kampf, sobald die neuen Daten im Spielstand angekommen sind. */
export function BattleWatcher() {
  const game = useGame();
  const { hero, purchases, armorLoot } = useSettings();
  const pending = useBattle((s) => s.pending);
  const [tick, setTick] = useState(0);
  const busy = useRef(false);
  const init = useRef(false);

  // Beim ersten Start still initialisieren – kein Kampf für die ganze Vergangenheit
  useEffect(() => {
    if (!game || init.current) return;
    init.current = true;
    void db.settings.get(ACK_KEY).then((r) => (r ? undefined : db.settings.put({ key: ACK_KEY, value: { total: game.campaign.totalDamage } })));
  }, [game]);

  useEffect(() => {
    if (!pending || !game || busy.current) return;
    const total = game.campaign.totalDamage;
    if (pending.seenTotal != null && total === pending.seenTotal && Date.now() - pending.at < 3000) {
      const t = setTimeout(() => setTick((x) => x + 1), 200);
      return () => clearTimeout(t);
    }
    busy.current = true;
    const { open, clearPending } = useBattle.getState();
    void (async () => {
      const row = await db.settings.get(ACK_KEY);
      const from = (row?.value as { total?: number } | undefined)?.total ?? pending.seenTotal ?? total;
      await db.settings.put({ key: ACK_KEY, value: { total } });
      if (!hero) return clearPending();
      if (total <= from) {
        clearPending();
        if (pending.reason === 'meal') toast(`${pending.title} – seit dem letzten Kampf kein neuer Schaden.`);
        return;
      }
      const facts = game.facts.get(today());
      const plan = battlePlan(from, total, facts ? dayDamage(facts, hero.classId) : null);
      const loot = rollLoot(`${from}-${total}`, plan.defeated.length, { rankLevel: game.rank.rank.level, defeatedBossIds: game.campaign.defeated.map((d) => d.boss.id), loot: armorLoot, purchases }, LOOT_CHANCE + bonusValue(game.setBonus, 'loot') / 100);
      if (loot.length) await db.settings.put({ key: 'armorLoot', value: [...armorLoot, ...loot] });
      open({ request: pending, plan, loot });
    })().finally(() => {
      busy.current = false;
    });
  }, [pending, game, hero, tick, purchases, armorLoot]);
  return null;
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

type Beat = { t: 'intro' } | { t: 'lunge'; hit: number } | { t: 'impact'; hit: number } | { t: 'defeat'; boss: number } | { t: 'enter'; boss: number } | { t: 'result' };

function timeline(hits: BattleHit[]): Beat[] {
  const out: Beat[] = [{ t: 'intro' }];
  hits.forEach((h, i) => {
    out.push({ t: 'lunge', hit: i }, { t: 'impact', hit: i });
    if (h.kill) out.push({ t: 'defeat', boss: h.bossIndex }, { t: 'enter', boss: h.bossIndex + 1 });
  });
  out.push({ t: 'result' });
  return out;
}

const DURATION: Record<Beat['t'], number> = { intro: 1100, lunge: 380, impact: 900, defeat: 1700, enter: 900, result: 0 };

export function BattleHost() {
  const scene = useBattle((s) => s.scene);
  if (!scene) return null;
  return <BattleStage key={scene.id} scene={scene} />;
}

function BattleStage({ scene }: { scene: Scene }) {
  const close = useBattle((s) => s.close);
  const reduced = useReducedMotion();
  const { hero } = useSettings();
  const body = useBodyType();
  const game = useGame();
  const { plan, request } = scene;
  const beats = useMemo(() => timeline(plan.hits), [plan.hits]);
  const fast = plan.hits.length > 6; // viele Bosse auf einmal: schneller abspielen
  const [step, setStep] = useState(reduced ? beats.length - 1 : 0);
  const beat = beats[step]!;

  useEffect(() => {
    if (beat.t === 'result') return;
    if (beat.t === 'impact') navigator.vibrate?.(plan.hits[beat.hit]!.kill ? [60, 40, 120] : 35);
    const t = setTimeout(() => setStep((s) => Math.min(beats.length - 1, s + 1)), DURATION[beat.t] * (fast ? 0.55 : 1));
    return () => clearTimeout(t);
  }, [beat, beats.length, fast, plan.hits]);

  // Zustand aus den bisher abgespielten Takten
  const view = useMemo(() => {
    let bossIndex = plan.start.index;
    let hp = plan.start.remaining;
    let lastHit: number | null = null;
    for (let k = 0; k <= step; k++) {
      const b = beats[k]!;
      if (b.t === 'impact') {
        const h = plan.hits[b.hit]!;
        bossIndex = h.bossIndex;
        hp = h.hpAfter;
        lastHit = b.hit;
      }
      if (b.t === 'enter') {
        bossIndex = b.boss;
        hp = bossAt(b.boss).hp;
        lastHit = null;
      }
    }
    if (beat.t === 'result') {
      bossIndex = plan.end.index;
      hp = plan.end.remaining;
    }
    return { boss: bossAt(bossIndex), hp, lastHit };
  }, [step, beats, beat.t, plan]);

  const done = beat.t === 'result';
  const hit = view.lastHit != null ? plan.hits[view.lastHit]! : null;
  const domains = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of plan.hits) m.set(h.label, (m.get(h.label) ?? 0) + h.dmg);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [plan.hits]);

  return (
    <div className="battle fixed inset-0 z-[75] flex flex-col overflow-hidden text-white" role="dialog" aria-modal="true" aria-label={`Kampf gegen ${view.boss.name}`} data-testid="battle">
      <div className="battle-bg absolute inset-0" aria-hidden />
      {/* Kopf: Boss und Lebenspunkte */}
      <div className="relative z-10 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="text-[11px] uppercase tracking-[0.2em] text-gold">{view.boss.province}</div>
        <div className="font-brand text-2xl font-bold" data-testid="battle-boss">
          {view.boss.name}
        </div>
        <HpBar boss={view.boss} hp={view.hp} />
        <div className="mt-1 flex justify-between text-xs text-white/70">
          <span className="tabular-nums" data-testid="battle-hp">
            {fmt(view.hp)} / {fmt(view.boss.hp)} LP
          </span>
          {!done && (
            <button className="underline-offset-2 hover:underline" onClick={() => setStep(beats.length - 1)}>
              Überspringen
            </button>
          )}
        </div>
      </div>

      {/* Arena */}
      <div className="relative z-10 flex flex-1 items-end justify-between px-4 pb-[18vh]">
        <div className={cn('relative z-10 w-[36%] max-w-[200px]', beat.t === 'intro' && !reduced && 'battle-enter-left', beat.t === 'lunge' && 'battle-lunge', beat.t === 'impact' && 'battle-return')}>
          {body ? (
            <HeroFigure bodyType={body.id} width={Math.min(200, typeof window !== 'undefined' ? window.innerWidth * 0.36 : 150)} />
          ) : hero ? (
            <HeroPortrait classId={hero.classId} rankLevel={game?.rank.rank.level ?? 1} crest={hero.color} size={140} />
          ) : null}
        </div>
        <div className="relative w-[46%] max-w-[256px]">
          <div
            key={`${view.boss.id}-${beat.t}-${view.lastHit}`}
            className={cn(
              'relative',
              beat.t === 'intro' && !reduced && 'battle-enter-right',
              beat.t === 'enter' && 'battle-enter-right',
              beat.t === 'impact' && 'battle-hit',
              beat.t === 'defeat' && 'battle-defeat',
            )}
          >
            <BossFigure boss={view.boss} idle={beat.t !== 'impact' && beat.t !== 'defeat'} />
          </div>
          {beat.t === 'impact' && <div className="battle-slash pointer-events-none absolute inset-0" aria-hidden />}
          {beat.t === 'impact' && hit && (
            <div key={view.lastHit} className="dmg-float absolute left-1/2 top-[8%] -translate-x-1/2 whitespace-nowrap text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" data-testid="battle-damage">
              <div className={cn('font-brand font-bold text-gold', hit.kill ? 'text-4xl' : 'text-3xl')}>−{fmt(hit.dmg)}</div>
              <div className="text-xs font-semibold uppercase tracking-wider">{hit.label}</div>
            </div>
          )}
        </div>
        {beat.t === 'defeat' && (
          <div className="battle-banner absolute inset-x-4 top-[30%] text-center">
            <div className="font-brand text-3xl font-bold text-gold drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">{bossAt(beat.boss).name} besiegt!</div>
            <div className="text-sm text-white/80">{bossAt(beat.boss).province} ist erobert</div>
          </div>
        )}
      </div>

      {/* Ergebnis */}
      {done && (
        <div className="battle-result absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-gold/40 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-fg shadow-2xl" data-testid="battle-result">
          <div className="text-[11px] uppercase tracking-[0.2em] text-gold">{request.reason === 'workout' ? 'Training beendet' : 'Mahlzeit abgeschlossen'}</div>
          <h2 className="font-brand text-xl font-bold">{request.title}</h2>
          {request.lines && request.lines.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm" data-testid="battle-summary">
              {request.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Swords className="h-4 w-4 shrink-0 text-gold" />
            <span>
              <b className="tabular-nums" data-testid="battle-total">
                {fmt(plan.damage)}
              </b>{' '}
              Schaden
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">{domains.map(([l, d]) => `${l} ${fmt(d)}`).join(' · ')}</p>
          <p className="mt-1 text-sm text-muted">
            {plan.defeated.length > 0 && <>{plan.defeated.map((b) => b.name).join(', ')} besiegt · </>}
            {plan.end.boss.name}: noch {fmt(plan.end.remaining)} LP
          </p>
          {plan.defeated.flatMap((b) => bossRewards(b.id, traitAvailable)).length > 0 && (
            <p className="mt-1 text-sm text-gold" data-testid="battle-rewards">
              Freigeschaltet: {plan.defeated.flatMap((b) => bossRewards(b.id, traitAvailable)).join(' · ')}
            </p>
          )}
          {scene.loot && scene.loot.length > 0 && (
            <div className="mt-3" data-testid="battle-loot">
              <div className="text-xs font-semibold uppercase tracking-wide text-gold">Beute</div>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {scene.loot.map((id) => {
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
            Ave!
          </Button>
        </div>
      )}
    </div>
  );
}

function HpBar({ boss, hp }: { boss: Boss; hp: number }) {
  const pct = `${Math.max(0, Math.min(100, (hp / boss.hp) * 100))}%`;
  return (
    <div className="relative mt-2 h-3.5 w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-white/20" role="progressbar" aria-label={`Lebenspunkte ${boss.name}`} aria-valuemin={0} aria-valuemax={boss.hp} aria-valuenow={hp}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-white/70 transition-[width] delay-300 duration-700 ease-out" style={{ width: pct }} />
      <div className="absolute inset-y-0 left-0 rounded-full bg-danger transition-[width] duration-200 ease-out" style={{ width: pct }} />
    </div>
  );
}
