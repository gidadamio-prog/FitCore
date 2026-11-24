import { bossRewards } from '@/domain/appearance';
import { traitAvailable } from './LookEditor';
import { useEffect, useState } from 'react';
import { Check, Lock, Skull, Swords, Ghost } from 'lucide-react';
import { rpgAsset } from '@/components/rpg/Visuals';
import { useReducedMotion } from '@/hooks/motion';
import { Badge, Card, CardTitle, Progress, fmt, cn } from '@/components/ui';
import { CAMPAIGN, DOMAIN_LABEL, bossAt, bossFile, dayDamage, type Domain } from '@/domain/rpg';
import type { GameState } from '@/domain/gamification';
import { addDays, formatDate, rangeDates, startOfWeek, today } from '@/domain/dates';
import { XP_RULES } from '@/domain/gamification';
import { useSettings } from '@/hooks/data';

const SEEN_KEY = 'fitcore-boss-seen';

/** Zuletzt gesehener Stand des Bosses – für die Treffer-Animation seit dem letzten Besuch. */
function useBossHit(bossId: string, remaining: number) {
  const reduced = useReducedMotion();
  const [hit, setHit] = useState<{ from: number; dmg: number } | null>(null);
  useEffect(() => {
    let prev: { id: string; remaining: number } | null = null;
    try {
      prev = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null');
      localStorage.setItem(SEEN_KEY, JSON.stringify({ id: bossId, remaining }));
    } catch {
      /* Speicher nicht verfügbar – dann ohne Animation */
    }
    if (!reduced && prev && prev.id === bossId && prev.remaining > remaining) setHit({ from: prev.remaining, dmg: prev.remaining - remaining });
  }, [bossId, remaining, reduced]);
  return hit;
}

export function BossCard({ game }: { game: GameState }) {
  const c = game.campaign.current;
  const hit = useBossHit(c.boss.id, c.remaining);
  const [drained, setDrained] = useState(false);
  useEffect(() => {
    if (!hit) return;
    const t = setTimeout(() => setDrained(true), 350);
    return () => clearTimeout(t);
  }, [hit]);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / c.boss.hp) * 100))}%`;
  const shown = hit && !drained ? hit.from : c.remaining;
  const portrait = rpgAsset(bossFile(c.boss));
  return (
    <div data-testid="boss-card">
      <div className="flex items-center gap-3">
        <div className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/15', hit && 'hit-shake')}>
          {portrait ? <img src={portrait} alt="" className="h-full w-full origin-top scale-[1.8] object-cover object-top" /> : <Skull className="h-7 w-7 text-primary" />}
          {hit && (
            <span className="dmg-float absolute left-1/2 top-1 -translate-x-1/2 font-brand text-lg font-bold text-gold drop-shadow" data-testid="boss-damage">
              −{fmt(hit.dmg)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted">{c.boss.province}</div>
          <div className="font-brand truncate text-lg font-bold" data-testid="boss-name">
            {c.boss.name}
          </div>
          <div className="truncate text-xs text-muted">{c.boss.epithet}</div>
        </div>
      </div>
      <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-fg/[0.07]" role="progressbar" aria-label={`Lebenspunkte ${c.boss.name}`} aria-valuemin={0} aria-valuemax={c.boss.hp} aria-valuenow={c.remaining}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/70 transition-[width] delay-500 duration-1000 ease-out" style={{ width: pct(shown) }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-danger transition-[width] duration-300 ease-out" style={{ width: pct(c.remaining) }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span data-testid="boss-hp">
          {fmt(c.remaining)} / {fmt(c.boss.hp)} LP
        </span>
        <span>{game.campaign.defeated.length} besiegt</span>
      </div>
      {bossRewards(c.boss.id, traitAvailable).length > 0 && (
        <div className="mt-1 text-[11px] text-gold" data-testid="boss-rewards">
          Belohnung: {bossRewards(c.boss.id, traitAvailable).join(' · ')}
        </div>
      )}
    </div>
  );
}

export function CampaignTab({ game }: { game: GameState }) {
  const { hero } = useSettings();
  const t = today();
  const weekDays = rangeDates(startOfWeek(t), t);
  const domains = Object.keys(DOMAIN_LABEL) as Domain[];
  const weekSplit = Object.fromEntries(domains.map((d) => [d, 0])) as Record<Domain, number>;
  for (const d of weekDays) {
    const f = game.facts.get(d);
    if (!f) continue;
    const s = dayDamage(f, hero?.classId);
    for (const k of domains) weekSplit[k] += s[k];
  }
  const weekTotal = domains.reduce((a, k) => a + weekSplit[k], 0);
  const col = game.colosseum;
  const duel = game.duel;
  const defeatedIdx = game.campaign.defeated.length;
  const shown = Math.max(CAMPAIGN.length, defeatedIdx + 1);
  return (
    <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="space-y-4">
        <CardTitle>Aktueller Gegner</CardTitle>
        <BossCard game={game} />
        <div>
          <div className="mb-1 text-xs text-muted">Dein Schaden diese Woche: {fmt(weekTotal)}</div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" data-testid="week-damage">
            {domains.map((k) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted">{DOMAIN_LABEL[k]}</span>
                <span className="tabular-nums">{fmt(weekSplit[k])}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-muted">
          Schaden entsteht aus echtem Training und Zielnähe: 1 je 40 kg Volumen, 4 je Ausdauerminute, 40 je Bestleistung, 8 je Mobility-Satz, dazu Protokoll, Protein-/Kalorienziel, Punktlandungen, Wasser und Erholung. Weniger essen bringt keinen Schaden. Je besiegtem Boss +{XP_RULES.boss.xp} EP.
          {!hero && ' Erschaffe deinen Helden, um den Klassenbonus zu nutzen.'}
        </p>
      </Card>

      <Card className="relative space-y-3 overflow-hidden">
        <span className="sand-drift" style={{ top: '30%' }} aria-hidden />
        <span className="sand-drift" style={{ top: '62%', animationDelay: '-2s', animationDuration: '6.5s' }} aria-hidden />
        <span className="sand-drift" style={{ top: '84%', animationDelay: '-3.5s' }} aria-hidden />
        <CardTitle action={col.defeatedOn ? <Badge tone="accent">besiegt</Badge> : undefined}>
          <span className="flex items-center gap-1">
            <Swords className="h-4 w-4 text-gold" /> Kolosseum – Champion des Monats
          </span>
        </CardTitle>
        <div className="flex items-center justify-between gap-2">
          {rpgAsset(`gladiator_${col.name.toLowerCase().replace(/\s+/g, '-')}`) && <img src={rpgAsset(`gladiator_${col.name.toLowerCase().replace(/\s+/g, '-')}`)} alt="" className="h-12 w-12 rounded-xl object-cover" />}
          <span className="flex-1 font-brand text-lg font-bold" data-testid="colosseum-name">
            {col.name}
          </span>
          <span className="text-xs text-muted">{formatDate(col.month + '-01', { month: 'long', year: 'numeric' })}</span>
        </div>
        <Progress className="h-3" value={col.hp - col.dealt} max={col.hp} color="danger" label={`Lebenspunkte ${col.name}`} />
        <div className="text-[11px] text-muted" data-testid="colosseum-hp">
          {col.defeatedOn ? `Besiegt am ${formatDate(col.defeatedOn)} – +${XP_RULES.colosseum.xp} EP` : `${fmt(col.hp - col.dealt)} / ${fmt(col.hp)} LP · jeden Monat ein neuer Gladiator`}
        </div>
        {game.colosseumWins.length > 0 && <div className="text-[11px] text-muted">Bisherige Siege: {game.colosseumWins.map((w) => w.name).join(', ')}</div>}
      </Card>

      <Card className="space-y-3">
        <CardTitle action={duel.won == null ? <Badge>kein Schatten</Badge> : duel.complete ? <Badge tone={duel.won ? 'accent' : 'warn'}>{duel.won ? 'gewonnen' : 'verloren'}</Badge> : <Badge tone="info">läuft</Badge>}>
          <span className="flex items-center gap-1">
            <Ghost className="h-4 w-4" /> Schatten-Gladiator
          </span>
        </CardTitle>
        <p className="text-xs text-muted">Du gegen dich selbst vor 4 Wochen (Woche ab {formatDate(duel.shadowWeekStart, { day: '2-digit', month: '2-digit' })}), jeweils gleich viele Tage. Gewonnen, wenn mehr Werte besser sind – +{XP_RULES.duel.xp} EP.</p>
        <table className="w-full text-sm" data-testid="duel">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1">Wert</th>
              <th className="py-1 text-right">Du</th>
              <th className="py-1 text-right">Schatten</th>
            </tr>
          </thead>
          <tbody>
            {duel.metrics.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="py-1.5">{m.label}</td>
                <td className={cn('py-1.5 text-right tabular-nums', m.me > m.shadow && 'font-semibold text-gold')}>
                  {fmt(m.me)} {m.unit}
                </td>
                <td className={cn('py-1.5 text-right tabular-nums text-muted', m.shadow > m.me && 'font-semibold')}>
                  {fmt(m.shadow)} {m.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-[11px] text-muted">Gewonnene Duelle insgesamt: {game.duelsWon}</div>
      </Card>

      <Card>
        <CardTitle>Feldzugskarte</CardTitle>
        <ol className="relative space-y-1 border-l-2 border-gold/30 pl-4" data-testid="campaign-map">
          {Array.from({ length: shown }, (_, k) => {
            const b = bossAt(k);
            const won = game.campaign.defeated[k];
            const current = k === defeatedIdx;
            return (
              <li key={b.id} className={cn('relative py-1.5', !won && !current && 'text-muted')} data-testid={won ? 'province-won' : current ? 'province-current' : 'province-locked'}>
                <span className={cn('absolute -left-[25px] top-2 flex h-4 w-4 items-center justify-center rounded-full', won ? 'bg-gold text-bg' : current ? 'bg-primary' : 'bg-fg/20')}>
                  {won ? <Check className="h-3 w-3" /> : !current ? <Lock className="h-2.5 w-2.5" /> : null}
                </span>
                <div className="flex justify-between gap-2 text-sm">
                  <span className={cn(current && 'font-semibold')}>
                    {b.province} <span className="text-xs text-muted">– {b.name}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">{won ? formatDate(won.date, { day: '2-digit', month: '2-digit', year: '2-digit' }) : `${fmt(b.hp)} LP`}</span>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[11px] text-muted">Nach Maxentius an der Milvischen Brücke geht der Feldzug am Limes endlos weiter. Gesamtschaden bisher: {fmt(game.campaign.totalDamage)}.</p>
        <p className="mt-1 text-[11px] text-muted">Letzte 7 Tage: {fmt(rangeDates(addDays(t, -6), t).reduce((a, d) => a + (game.damageByDay.get(d) ?? 0), 0))} Schaden.</p>
      </Card>
    </div>
  );
}
