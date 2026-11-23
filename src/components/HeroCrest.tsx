import { Bird, Crown, Flame, Shield, Sword, Zap } from 'lucide-react';
import { Laurel } from './Laurel';
import type { EmblemId, FrameId } from '@/domain/rpg';

const ICONS: Record<EmblemId, typeof Bird> = { aquila: Bird, gladius: Sword, scutum: Shield, corona: Crown, flamma: Flame, fulmen: Zap };
export const FRAME_COLOR: Record<FrameId, string> = { bronze: '#b0743a', silver: '#aab3bd', gold: 'rgb(var(--gold))', purpur: '#a0244a' };

/** Wappen des Helden: Schild in Wappenfarbe mit Emblem, umrahmt vom Lorbeerkranz. */
export function HeroCrest({ emblem, color, frame = 'bronze', size = 72, label }: { emblem: EmblemId; color: string; frame?: FrameId; size?: number; label?: string }) {
  const Icon = ICONS[emblem] ?? Shield;
  const s = size * 0.5;
  return (
    <Laurel size={size} color={FRAME_COLOR[frame]}>
      <span className="relative inline-flex items-center justify-center" style={{ width: s, height: s * 1.15 }} role="img" aria-label={label ?? 'Wappen'}>
        <svg viewBox="0 0 40 46" width={s} height={s * 1.15} className="absolute inset-0" aria-hidden>
          <path d="M20 1 L38 7 V22 C38 34 29 41 20 45 C11 41 2 34 2 22 V7 Z" fill={color} stroke="rgb(var(--gold))" strokeWidth="1.6" />
        </svg>
        <Icon className="relative" style={{ width: s * 0.5, height: s * 0.5, color: '#f6efe6' }} />
      </span>
    </Laurel>
  );
}
