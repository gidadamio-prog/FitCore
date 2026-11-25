// Großer Boss-Auftritt auf dem Dashboard: der aktuelle Feldzug-Gegner, leicht in Bewegung.
import { ChevronRight } from 'lucide-react';
import { fmt } from '@/components/ui';
import type { GameState } from '@/domain/gamification';
import { BossFigure } from './Visuals';

export function BossStage({ game, onOpen, cta, compact = false }: { game: GameState; onOpen: () => void; cta?: string; compact?: boolean }) {
  const c = game.campaign.current;
  const pct = Math.max(0, Math.min(100, (c.remaining / c.boss.hp) * 100));
  return (
    <button onClick={onOpen} className={`boss-stage relative block ${compact ? 'h-[170px]' : 'h-[300px]'} w-full overflow-hidden rounded-3xl text-left text-white shadow-xl shadow-black/30 ring-1 ring-gold/30`} data-testid="boss-stage" aria-label={`Aktueller Gegner ${c.boss.name}, ${fmt(c.remaining)} von ${fmt(c.boss.hp)} Lebenspunkten`}>
      <div className="battle-bg absolute inset-0" aria-hidden />
      <div className="boss-aura absolute right-[-10%] top-[8%] h-[85%] w-[75%] rounded-full" aria-hidden />
      <div className="absolute right-[-6%] top-[22%] h-full w-[68%]">
        <BossFigure boss={c.boss} idle className="!aspect-auto h-full" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" aria-hidden />
      <div className="relative flex h-full max-w-[62%] flex-col justify-between p-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-gold">{c.boss.province} · Hauptstadt</div>
          <div className={`font-brand mt-1 ${compact ? 'text-xl' : 'text-3xl'} font-bold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]`} data-testid="stage-boss-name">
            {c.boss.name}
          </div>
          {!compact && <div className="mt-0.5 text-xs text-white/75">{c.boss.epithet}</div>}
        </div>
        <div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/15 ring-1 ring-white/20" role="progressbar" aria-label={`Lebenspunkte ${c.boss.name}`} aria-valuemin={0} aria-valuemax={c.boss.hp} aria-valuenow={c.remaining}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-danger transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-white/80">
            <span className="tabular-nums" data-testid="stage-boss-hp">
              {fmt(c.remaining)} / {fmt(c.boss.hp)} LP
            </span>
            <span>{game.campaign.defeated.length} erobert</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-gold">
            {cta ?? 'Zum Feldzug'} <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </button>
  );
}
