// Quest-Brett: Feldzug der Woche wählen (3 aus 5) und Tagesauftrag anzeigen.
import { useState } from 'react';
import { Check, Scroll, Sparkles } from 'lucide-react';
import { Badge, Button, Progress, cn, fmt } from './ui';
import { useSettings } from '@/hooks/data';
import { setSetting } from '@/data/profileRepo';
import { toast } from '@/stores/ui';
import { XP_RULES, type GameState, type Quest } from '@/domain/gamification';
import { PICKS_PER_WEEK, type QuestCategory, type QuestOffer } from '@/domain/quests';

const CAT: Record<QuestCategory, { label: string; tone: 'accent' | 'info' | 'warn' }> = {
  training: { label: 'Training', tone: 'accent' },
  ernaehrung: { label: 'Ernährung', tone: 'info' },
  alltag: { label: 'Alltag', tone: 'warn' },
};

function QuestRow({ q }: { q: Quest | QuestOffer }) {
  const cat = 'category' in q ? CAT[q.category as QuestCategory] : null;
  return (
    <li data-testid="quest">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={cn('min-w-0 font-medium', q.done && 'text-accent')}>
          {q.done ? '✓ ' : ''}
          {q.title}
        </span>
        <span className="shrink-0 tabular-nums text-muted">
          {fmt(q.progress)}/{fmt(q.target)} {q.unit}
        </span>
      </div>
      <Progress className="mt-1" value={q.progress} max={q.target} label={q.title} />
      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
        {cat && <Badge tone={cat.tone}>{cat.label}</Badge>}
        <span>{q.description}</span>
      </div>
    </li>
  );
}

export function QuestBoard({ game }: { game: GameState }) {
  const settings = useSettings();
  const [sel, setSel] = useState<string[]>([]);

  if (game.questsPicked || !game.questOffers.length) {
    const done = game.quests.filter((q) => q.done).length;
    return (
      <div>
        <ul className="space-y-3">
          {game.quests.map((q) => (
            <QuestRow key={q.id} q={q} />
          ))}
        </ul>
        {game.questsPicked && (
          <p className="mt-3 text-[11px] text-muted">
            Je Feldzug {XP_RULES.quest.xp} EP, alle drei geschafft: +{XP_RULES.questAll.xp} EP Bonus{done === game.quests.length && done > 0 ? ' ✓' : ''}. Nächste Woche gibt es neue Angebote.
          </p>
        )}
      </div>
    );
  }

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < PICKS_PER_WEEK ? [...s, id] : s));
  const start = async () => {
    await setSetting('questPicks', { ...settings.questPicks, [game.weekStart]: sel });
    toast('Feldzug der Woche steht – auf in die Schlacht!', 'success');
  };
  return (
    <div data-testid="quest-offers">
      <p className="mb-2 text-sm text-muted">
        Wähle <b className="text-fg">{PICKS_PER_WEEK} von {game.questOffers.length}</b> Aufträgen als deinen Feldzug der Woche. Die Ziele richten sich nach deinem Schnitt der letzten 4 Wochen – mit etwas mehr Anspruch.
      </p>
      <ul className="space-y-2">
        {game.questOffers.map((q) => {
          const on = sel.includes(q.id);
          return (
            <li key={q.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(q.id)}
                className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition', on ? 'border-gold bg-gold/10' : 'hover:bg-fg/[0.04]', !on && sel.length >= PICKS_PER_WEEK && 'opacity-50')}
              >
                <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', on ? 'border-gold bg-gold text-bg' : 'border-fg/30')}>{on && <Check className="h-3.5 w-3.5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{q.title}</span>
                  <span className="block text-xs text-muted">{q.description}</span>
                  <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                    <Badge tone={CAT[q.category].tone}>{CAT[q.category].label}</Badge>
                    {q.progress > 0 && (
                      <span>
                        bisher {fmt(q.progress)}/{fmt(q.target)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button className="mt-3 w-full" disabled={sel.length !== PICKS_PER_WEEK} onClick={() => void start()}>
        <Scroll className="h-4 w-4" /> Feldzug starten ({sel.length}/{PICKS_PER_WEEK})
      </Button>
    </div>
  );
}

export function DailyQuestBanner({ q }: { q: Quest }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-3', q.done ? 'border-accent/40 bg-accent/10' : 'border-gold/40 bg-gold/[0.07]')} data-testid="daily-quest">
      <Sparkles className={cn('h-5 w-5 shrink-0', q.done ? 'text-accent' : 'text-gold')} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-gold">Tagesauftrag · +{XP_RULES.daily.xp} EP</div>
        <div className="text-sm font-semibold">
          {q.done ? '✓ ' : ''}
          {q.title}
        </div>
        <div className="text-xs text-muted">{q.description}</div>
      </div>
      {q.target > 1 && (
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {fmt(q.progress)}/{fmt(q.target)}
        </span>
      )}
    </div>
  );
}
