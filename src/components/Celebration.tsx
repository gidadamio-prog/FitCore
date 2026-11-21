// Feier-Overlay (Bestleistung, Rangaufstieg, Abzeichen, Feldzug) und Beobachter für neue Erfolge.
import { useEffect, useRef } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from './ui';
import { Laurel } from './Laurel';
import { useCelebrate, celebrate } from '@/stores/celebrate';
import { useGame } from '@/hooks/game';
import { db } from '@/data/db';
import { earnedBadgeKeys, TIER_LABEL, type Tier } from '@/domain/gamification';
import { startOfWeek, today } from '@/domain/dates';

export function CelebrationHost() {
  const { queue, shift } = useCelebrate();
  const c = queue[0];
  useEffect(() => {
    if (c) navigator.vibrate?.([30, 40, 30]);
  }, [c]);
  if (!c) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={c.title} onClick={shift}>
      <div className="celebrate-pop relative w-full max-w-sm rounded-3xl border border-gold/40 bg-card p-6 text-center shadow-2xl shadow-primary/30" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-rays pointer-events-none absolute inset-0 rounded-3xl" />
        <div className="relative mx-auto mb-3 flex justify-center">
          <Laurel size={120} className="celebrate-spin-in">
            <Trophy className="h-10 w-10 text-gold" />
          </Laurel>
        </div>
        <div className="font-brand relative text-xs uppercase tracking-[0.2em] text-gold">{{ pr: 'Neue Bestleistung', rank: 'Rangaufstieg', badge: 'Abzeichen', quest: 'Feldzug erfüllt', season: 'Saison-Triumph' }[c.kind]}</div>
        <h2 className="font-brand relative mt-1 text-2xl font-bold" data-testid="celebration-title">
          {c.title}
        </h2>
        {c.subtitle && <p className="relative mt-1 text-sm text-muted">{c.subtitle}</p>}
        {c.lines && c.lines.length > 0 && (
          <ul className="relative mt-3 space-y-1 text-sm">
            {c.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <Button className="relative mt-5 w-full" onClick={shift}>
          {useCelebrate.getState().queue.length > 1 ? 'Weiter' : 'Ave!'}
        </Button>
      </div>
    </div>
  );
}

interface Ack {
  rankLevel: number;
  badges: string[];
  quests: string[];
  seasons: string[];
}

/** Erkennt neue Ränge, Abzeichen, Feldzüge und Saisonsiege und feiert sie einmalig. Beim ersten Start wird still initialisiert. */
export function GameWatcher() {
  const game = useGame();
  const busy = useRef(false);
  useEffect(() => {
    if (!game || busy.current) return;
    busy.current = true;
    (async () => {
      const week = startOfWeek(today());
      const now: Ack = {
        rankLevel: game.rank.rank.level,
        badges: earnedBadgeKeys(game.badges),
        quests: game.quests.filter((q) => q.done).map((q) => `${week}:${q.id}`),
        seasons: game.season.challenges.filter((c) => c.done).map((c) => `${game.season.month}:${c.id}`),
      };
      const row = await db.settings.get('gameAck');
      const ack = row?.value as Ack | undefined;
      if (!ack) {
        await db.settings.put({ key: 'gameAck', value: now });
        return;
      }
      if (now.rankLevel > ack.rankLevel) celebrate({ kind: 'rank', title: `${game.rank.rank.name}`, subtitle: `Du bist jetzt ${game.rank.rank.title} (Rang ${game.rank.rank.level} von 10).`, lines: [`${game.xp.toLocaleString('de-DE')} Erfahrungspunkte`] });
      for (const k of now.badges.filter((b) => !ack.badges.includes(b))) {
        const [id, tier] = k.split(':') as [string, Tier];
        const b = game.badges.find((x) => x.id === id);
        if (b) celebrate({ kind: 'badge', title: `${b.name} · ${TIER_LABEL[tier]}`, subtitle: b.description(b.tiers[['bronze', 'silver', 'gold'].indexOf(tier)]!) });
      }
      for (const k of now.quests.filter((q) => !ack.quests.includes(q))) {
        const q = game.quests.find((x) => k.endsWith(':' + x.id));
        if (q) celebrate({ kind: 'quest', title: q.title, subtitle: '+100 Erfahrungspunkte' });
      }
      for (const k of now.seasons.filter((q) => !ack.seasons.includes(q))) {
        const c = game.season.challenges.find((x) => k.endsWith(':' + x.id));
        if (c) celebrate({ kind: 'season', title: c.title, subtitle: `Saison ${game.season.name} · +250 Erfahrungspunkte` });
      }
      // Bestätigte Stände zusammenführen (nie verlieren – sonst würden gelöschte und wieder erreichte Erfolge mehrfach gefeiert)
      await db.settings.put({
        key: 'gameAck',
        value: {
          rankLevel: Math.max(ack.rankLevel, now.rankLevel),
          badges: [...new Set([...ack.badges, ...now.badges])],
          quests: [...new Set([...ack.quests, ...now.quests])].slice(-200),
          seasons: [...new Set([...ack.seasons, ...now.seasons])].slice(-100),
        },
      });
    })().finally(() => {
      busy.current = false;
    });
  }, [game]);
  return null;
}
