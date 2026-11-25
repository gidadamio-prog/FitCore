import { useSearchParams } from 'react-router-dom';
import { HeroFigure, type WornArmor } from '@/components/rpg/Visuals';
import { BODY_TYPES, type BodyTypeId } from '@/domain/bodyType';
import { weaponById } from '@/domain/weapons';

/** Prüfansicht: alle Grundkörper mit einer Ausrüstung (…/#/vorschau?main=waffe-schwert-03&off=waffe-schild-05&set=12). */
export function Vorschau() {
  const [q] = useSearchParams();
  const set = q.get('set');
  const idx = set == null ? null : Number(set);
  const armor: WornArmor = { head: q.get('kopf') === '1' ? idx : null, chest: idx, hands: idx, legs: idx, feet: idx, main: q.get('main'), off: q.get('off') };
  const title = [armor.main, armor.off].map((id) => weaponById(id)?.name).filter(Boolean).join(' + ');
  return (
    <div className="space-y-2" data-testid="vorschau">
      <div className="text-sm font-semibold">{title || 'Ohne Waffe'}</div>
      <div className="grid grid-cols-4 gap-1">
        {BODY_TYPES.map((b) => (
          <div key={b.id} className="flex flex-col items-center rounded-lg bg-fg/[0.04]">
            <HeroFigure bodyType={b.id as BodyTypeId} armor={armor} look={{}} width={88} />
            <span className="text-[9px] text-muted">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
