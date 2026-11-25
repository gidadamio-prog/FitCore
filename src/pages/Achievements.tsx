import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Flame, Shield, Swords, Trophy, Info } from 'lucide-react';
import { Card, CardTitle, Progress, Badge, Tabs, fmt, cn } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { Laurel } from '@/components/Laurel';
import { useGame } from '@/hooks/game';
import { RANKS, TIER_LABEL, XP_RULES, type BadgeStatus, type GameState, type Quest, type Tier } from '@/domain/gamification';
import { formatDate } from '@/domain/dates';
import { RARITY_LABEL, itemById } from '@/domain/equipment';
import { BADGE_WEAPONS, weaponById, weaponRarity } from '@/domain/weapons';
import { ItemIcon } from '@/components/rpg/Visuals';
import type { SecretAchievement } from '@/domain/achievements';
import { HeroTab } from './game/HeroTab';
import { DailyQuestBanner, QuestBoard } from '@/components/QuestBoard';
import { CampaignTab } from './game/CampaignTab';
import { ArenaTab } from './game/ArenaTab';
import { MarketTab } from './game/MarketTab';
import { InventoryTab } from './game/InventoryTab';

type GameTab = 'held' | 'inventar' | 'feldzug' | 'arena' | 'ruhm' | 'markt';
const GAME_TABS: { value: GameTab; label: string }[] = [
  { value: 'held', label: 'Held' },
  { value: 'inventar', label: 'Inventar' },
  { value: 'feldzug', label: 'Feldzug' },
  { value: 'arena', label: 'Arena' },
  { value: 'ruhm', label: 'Ruhm' },
  { value: 'markt', label: 'Markt' },
];

export function Achievements() {
  const game = useGame();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('tab') as GameTab) || 'held';
  const [tab, setTab] = useState<GameTab>(GAME_TABS.some((t) => t.value === initial) ? initial : 'held');
  // Links innerhalb der Ruhmeshalle (z. B. „Inventar“ am Charakterbogen) wechseln den Reiter
  useEffect(() => {
    if (GAME_TABS.some((t) => t.value === initial) && initial !== tab) setTab(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  if (!game) return null;
  return (
    <div className="space-y-4">
      <PageHeader title="Ruhmeshalle" subtitle="Dein Held, Inventar, Feldzug, Arena und Abzeichen – berechnet aus deinen echten Einträgen." />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          const next = new URLSearchParams(params);
          next.set('tab', t);
          setParams(next, { replace: true });
        }}
        items={GAME_TABS}
      />
      {tab === 'held' && <HeroTab game={game} />}
      {tab === 'feldzug' && (
        <div className="space-y-4">
          <Card data-testid="week-quests">
            <CardTitle>Feldzug der Woche</CardTitle>
            {game.dailyQuest && (
              <div className="mb-3">
                <DailyQuestBanner q={game.dailyQuest} />
              </div>
            )}
            <QuestBoard game={game} />
          </Card>
          <CampaignTab game={game} />
        </div>
      )}
      {tab === 'arena' && <ArenaTab game={game} />}
      {tab === 'ruhm' && <FameTab game={game} />}
      {tab === 'markt' && <MarketTab game={game} />}
      {tab === 'inventar' && <InventoryTab game={game} />}
    </div>
  );
}

export const TIER_COLOR: Record<Tier, string> = { bronze: '#b0743a', silver: '#aab3bd', gold: 'rgb(var(--gold))' };

export function RankHeader({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const { rank, next, progress, toNext } = game.rank;
  return (
    <div className="flex items-center gap-4">
      <Laurel size={compact ? 64 : 88}>
        <span className={cn('font-brand font-bold text-gold', compact ? 'text-lg' : 'text-2xl')}>{rank.level}</span>
      </Laurel>
      <div className="min-w-0 flex-1">
        <div className={cn('font-brand truncate font-bold', compact ? 'text-lg' : 'text-2xl')} data-testid="rank-name">
          {rank.name}
        </div>
        <div className="text-xs text-muted">
          {rank.title} · <span data-testid="xp-total">{fmt(game.xp)}</span> EP
        </div>
        <Progress className="mt-2" value={progress * 100} max={100} label="Fortschritt zum nächsten Rang" />
        <div className="mt-1 text-[11px] text-muted">{next ? `Noch ${fmt(toNext)} EP bis ${next.name}` : 'Höchster Rang erreicht – Ave, Imperator!'}</div>
      </div>
    </div>
  );
}

export function StreakChips({ game }: { game: GameState }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1" data-testid="log-streak">
        <Flame className="h-4 w-4 text-primary" /> {game.logStreak.current} Tage protokolliert
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1" data-testid="train-streak">
        <Swords className="h-4 w-4 text-accent" /> {game.trainStreak.current} Wochen trainiert
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-fg/[0.06] px-3 py-1 text-muted" title="Pro Woche darf ein Tag fehlen, ohne dass die Ernährungs-Serie reißt.">
        <Shield className="h-4 w-4" /> Schild {game.logStreak.shieldUsedThisWeek ? 'diese Woche verbraucht' : 'bereit'}
      </span>
    </div>
  );
}

export function QuestList({ quests }: { quests: Quest[] }) {
  return (
    <ul className="space-y-3">
      {quests.map((q) => (
        <li key={q.id} data-testid="quest">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className={cn('font-medium', q.done && 'text-accent')}>
              {q.done ? '✓ ' : ''}
              {q.title}
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              {fmt(q.progress)}/{fmt(q.target)} {q.unit}
            </span>
          </div>
          <Progress className="mt-1" value={q.progress} max={q.target} label={q.title} />
          <div className="mt-0.5 text-[11px] text-muted">{q.description}</div>
        </li>
      ))}
    </ul>
  );
}

function BadgeTile({ b }: { b: BadgeStatus }) {
  const color = b.tier ? TIER_COLOR[b.tier] : 'rgb(var(--muted) / 0.45)';
  const shownTarget = b.nextTarget ?? b.tiers[2];
  // Belohnung: Waffe der erreichten Stufe (sonst die Bronze-Waffe als Ausblick)
  const ids = BADGE_WEAPONS[b.id];
  const tierIdx = b.tier ? ['bronze', 'silver', 'gold'].indexOf(b.tier) : -1;
  const reward = ids ? itemById(ids[Math.max(0, tierIdx)]) : undefined;
  const rarity = reward && tierIdx >= 0 ? weaponRarity(weaponById(reward.id)!) : null;
  return (
    <div className={cn('rounded-2xl border p-3 text-center', !b.tier && 'opacity-70')} data-testid={`badge-${b.id}`}>
      <Laurel size={56} color={color} className="mx-auto">
        <Trophy className="h-5 w-5" style={{ color }} />
      </Laurel>
      <div className="mt-1 text-sm font-semibold">{b.name}</div>
      <div className="text-[11px]" style={{ color: b.tier ? color : undefined }}>
        {b.tier ? TIER_LABEL[b.tier] : 'noch offen'}
      </div>
      <div className="mt-1 text-[11px] text-muted">{b.description(shownTarget)}</div>
      {b.nextTarget != null && <Progress className="mt-2" value={b.value} max={b.nextTarget} label={b.name} />}
      <div className="mt-0.5 text-[10px] tabular-nums text-muted">
        {fmt(b.value)}
        {b.nextTarget != null ? ` / ${fmt(b.nextTarget)}` : ''} {b.unit ?? ''}
      </div>
      {reward && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-fg/[0.04] p-1.5 text-left" data-testid={`reward-${b.id}`}>
          <ItemIcon item={reward} rarity={rarity} locked={!rarity} size={32} animate={false} />
          <span className="min-w-0 text-[10px] leading-tight">
            <span className="block truncate font-semibold">{reward.name}</span>
            <span className="text-muted">{rarity ? `${RARITY_LABEL[rarity]}${tierIdx < 2 && ids ? ` · nächste: ${itemById(ids[tierIdx + 1])?.name}` : ''}` : 'Belohnung bei Bronze'}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function SecretTile({ a }: { a: SecretAchievement }) {
  return (
    <div className={cn('rounded-2xl border p-3 text-center', !a.achieved && 'opacity-75')} data-testid={`secret-${a.id}`}>
      <div className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-full font-brand text-xl', a.achieved ? 'bg-gold/20 text-gold' : 'bg-fg/[0.06] text-muted')}>{a.achieved ? '★' : '?'}</div>
      <div className="mt-1 text-sm font-semibold">{a.achieved ? a.name : '???'}</div>
      <div className="mt-0.5 text-[11px] text-muted">{a.achieved ? a.description : a.hint}</div>
      {!a.achieved && a.progress && a.progress.value > 0 && <Progress className="mt-2" value={a.progress.value} max={a.progress.target} label="Fortschritt geheimer Erfolg" />}
      {a.achieved && (
        <div className="mt-1 text-[10px] text-gold">
          Titel „{a.reward.title}“ · +{a.reward.denare} Denare{a.date ? ` · ${formatDate(a.date)}` : ''}
        </div>
      )}
    </div>
  );
}

function FameTab({ game }: { game: GameState }) {
  const nav = useNavigate();
  const maxDay = Math.max(1, ...game.xpLast7.map((d) => d.xp));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <RankHeader game={game} />
          <StreakChips game={game} />
          <div>
            <div className="mb-1 text-xs text-muted">Erfahrungspunkte der letzten 7 Tage</div>
            <div className="flex h-16 items-end gap-1" aria-label="EP der letzten 7 Tage">
              {game.xpLast7.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${formatDate(d.date)}: ${d.xp} EP`}>
                  <div className="w-full rounded-t-md bg-gold/80" style={{ height: `${(d.xp / maxDay) * 48 + (d.xp ? 4 : 1)}px` }} />
                  <span className="text-[9px] text-muted">{formatDate(d.date, { weekday: 'short' })}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle action={game.season.won ? <Badge tone="accent">gewonnen</Badge> : undefined}>Saison {game.season.name}</CardTitle>
          <QuestList quests={game.season.challenges} />
          <p className="mt-3 text-[11px] text-muted">Je Herausforderung {XP_RULES.season.xp} EP. Alle drei = Saisonsieg.</p>
        </Card>
        <Card>
          <CardTitle>Ränge</CardTitle>
          <ol className="space-y-1 text-sm">
            {RANKS.map((r) => (
              <li key={r.level} className={cn('flex justify-between gap-2', r.level === game.rank.rank.level ? 'font-semibold text-gold' : r.minXp > game.xp ? 'text-muted' : '')}>
                <span>
                  {r.level}. {r.name} <span className="text-xs text-muted">– {r.title}</span>
                </span>
                <span className="tabular-nums">{fmt(r.minXp)} EP</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <CardTitle>Abzeichen & Ausrüstung</CardTitle>
        <p className="mb-3 text-xs text-muted">Jedes Abzeichen schaltet bei Bronze ein Ausrüstungsteil frei; Silber und Gold werten es zu Episch und Legendär auf.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="badge-grid">
          {[...game.badges].sort((a, b) => (b.tier ? ['bronze', 'silver', 'gold'].indexOf(b.tier) + 1 : 0) - (a.tier ? ['bronze', 'silver', 'gold'].indexOf(a.tier) + 1 : 0)).map((b) => (
            <BadgeTile key={b.id} b={b} />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle action={<Badge>{game.secrets.filter((x) => x.achieved).length}/{game.secrets.length}</Badge>}>Geheime Erfolge</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="secret-grid">
          {game.secrets.map((a) => (
            <SecretTile key={a.id} a={a} />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Ruhmeshalle der Bestleistungen</CardTitle>
        {game.prs.length ? (
          <ul className="divide-y text-sm" data-testid="hall-of-fame">
            {[...game.prs].reverse().slice(0, 25).map((p) => (
              <li key={p.workoutId + p.exerciseId}>
                <button className="flex w-full justify-between gap-2 py-2 text-left" onClick={() => nav('/training/exercise/' + p.exerciseId)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted">{p.detail}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(p.date, { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Noch keine Bestleistungen. Die erste Steigerung gegenüber einer früheren Einheit landet hier.</p>
        )}
      </Card>

      <Card>
        <CardTitle>
          <span className="flex items-center gap-1">
            <Info className="h-4 w-4" /> So gibt es Erfahrungspunkte
          </span>
        </CardTitle>
        <table className="w-full text-sm" data-testid="xp-table">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1">Aktion</th>
              <th className="py-1 text-right">EP</th>
              <th className="py-1 text-right">Anzahl</th>
              <th className="py-1 text-right">Summe</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(XP_RULES) as (keyof typeof XP_RULES)[]).map((k) => (
              <tr key={k} className="border-t">
                <td className="py-1.5">{XP_RULES[k].label}</td>
                <td className="py-1.5 text-right tabular-nums">{XP_RULES[k].xp}</td>
                <td className="py-1.5 text-right tabular-nums">{game.breakdown[k].count}</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(game.breakdown[k].xp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted">
          Punkte gibt es für Regelmäßigkeit, Training und Zielnähe (Punktlandungen max. 4 pro Tag) – bewusst nicht für möglichst wenig Kalorien oder schnelles Abnehmen. Krafttraining und Ausdauer zählen max. 2× pro Tag, Bestleistungen max. 5× pro Workout. Löschst du Einträge, werden die Punkte neu berechnet.
        </p>
      </Card>
    </div>
  );
}
