import { useEffect, useMemo, useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { Sheet, Tabs, cn } from '@/components/ui';
import { BodyPreview, HeadPreview, rpgAsset } from '@/components/rpg/Visuals';
import { HAIR_COLORS, TRAITS, normalizeLook, traitFile, unlockStatus, unlockedLookKeys, type HeroLook, type TraitCategory, type TraitDef, type UnlockContext } from '@/domain/appearance';
import type { GameState } from '@/domain/gamification';
import type { Hero } from '@/domain/rpg';
import { setHeroLook } from '@/data/arena';
import { setSetting } from '@/data/profileRepo';
import { useSettings } from '@/hooks/data';
import { toast } from '@/stores/ui';

export const lookContext = (game: GameState): UnlockContext => ({
  defeatedBossIds: game.campaign.defeated.map((d) => d.boss.id),
  rankLevel: game.rank.rank.level,
  badges: game.badges,
});

/** Nur Merkmale, deren Bild schon in der App liegt. */
export const traitAvailable = (tr: TraitDef) => !!rpgAsset(traitFile(tr));

/** Anzahl neu freigeschalteter Frisuren, Bärte und Farben seit dem letzten Öffnen. */
export function useNewLooks(game: GameState) {
  const { lookSeen } = useSettings();
  return useMemo(() => unlockedLookKeys(lookContext(game), traitAvailable).filter((k) => !lookSeen.includes(k)), [game, lookSeen]);
}

type Tab = 'hair' | 'beard' | 'color' | 'tattoo' | 'scar' | 'eyes';

export function LookEditor({ hero, game, onClose }: { hero: Hero; game: GameState; onClose: () => void }) {
  const ctx = lookContext(game);
  const [look, setLook] = useState<Required<HeroLook>>(() => normalizeLook(hero.look, ctx));
  const [tab, setTab] = useState<Tab>('hair');
  const fresh = useNewLooks(game);
  const [newKeys] = useState(() => new Set(fresh));
  const { lookSeen } = useSettings();
  useEffect(() => {
    if (fresh.length) void setSetting('lookSeen', [...new Set([...lookSeen, ...fresh])]);
  }, [fresh, lookSeen]);

  const apply = (next: Required<HeroLook>) => {
    setLook(next);
    void setHeroLook(next);
  };

  const traitGrid = (cat: TraitCategory) => {
    const list = TRAITS.filter((t) => t.category === cat && traitAvailable(t)).map((t) => ({ t, st: unlockStatus(t.unlock, ctx) }));
    list.sort((a, b) => Number(b.st.unlocked) - Number(a.st.unlocked));
    const field = cat as 'hair' | 'beard' | 'tattoo' | 'scar' | 'eyes';
    const current = look[field];
    const set = (id: string | null) => apply({ ...look, [field]: id });
    const full = cat === 'tattoo' || cat === 'scar';
    const NONE: Record<string, string> = { hair: 'Grundschnitt', beard: 'Kein Bart', tattoo: 'Kein Tattoo', scar: 'Keine Narbe', eyes: 'Nichts' };
    const tile = (key: string, id: string | null, name: string, unlocked: boolean, hint?: string) => {
      const active = current === id;
      return (
        <button
          key={key}
          type="button"
          onClick={() => (unlocked ? set(id) : toast(`${name}: ${hint}`, 'info'))}
          className={cn('relative flex flex-col items-center gap-1 rounded-xl border p-1.5 text-center', active ? 'border-gold bg-gold/10' : 'border-transparent')}
          aria-pressed={active}
          aria-label={unlocked ? name : `${name} (gesperrt: ${hint})`}
          data-testid={`look-${cat}-${id ?? 'none'}`}
        >
          {full ? (
            <BodyPreview look={{ ...look, [field]: id }} width={64} className={cn(!unlocked && 'opacity-35 grayscale')} />
          ) : (
            <HeadPreview look={{ ...look, [field]: id }} size={76} className={cn(!unlocked && 'opacity-35 grayscale')} />
          )}
          {!unlocked && <Lock className="absolute right-2 top-2 h-4 w-4 text-gold" />}
          {active && <Check className="absolute right-2 top-2 h-4 w-4 text-gold" />}
          {newKeys.has(`${cat}:${id}`) && <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 text-[9px] font-bold text-white">NEU</span>}
          <span className="line-clamp-2 text-[11px] font-medium leading-tight">{name}</span>
          {!unlocked && <span className="line-clamp-2 text-[9px] leading-tight text-muted">{hint}</span>}
        </button>
      );
    };
    return (
      <div className="grid grid-cols-3 gap-1.5" data-testid={`look-grid-${cat}`}>
        {tile('none', null, NONE[cat]!, true)}
        {list.map(({ t, st }) => tile(t.id, t.id, t.name, st.unlocked, st.hint))}
      </div>
    );
  };

  const swatches = (which: 'hairColor' | 'beardColor') => (
    <div className="flex flex-wrap gap-2" role="group" aria-label={which === 'hairColor' ? 'Haarfarbe' : 'Bartfarbe'}>
      {HAIR_COLORS.map((c) => {
        const st = unlockStatus(c.unlock, ctx);
        const active = look[which] === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => (st.unlocked ? apply(which === 'hairColor' && look.beardColor === look.hairColor ? { ...look, hairColor: c.id, beardColor: c.id } : { ...look, [which]: c.id }) : toast(`${c.label}: ${st.hint}`, 'info'))}
            className="flex w-14 flex-col items-center gap-1"
            aria-pressed={active}
            aria-label={st.unlocked ? c.label : `${c.label} (gesperrt: ${st.hint})`}
            data-testid={`color-${which}-${c.id}`}
          >
            <span className={cn('relative flex h-10 w-10 items-center justify-center rounded-full border-2', active ? 'border-gold' : 'border-white/15', !st.unlocked && 'opacity-40')} style={{ background: c.hex }}>
              {!st.unlocked && <Lock className="h-4 w-4 text-white/90" />}
              {active && <Check className="h-4 w-4 text-white" />}
              {newKeys.has(`color:${c.id}`) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />}
            </span>
            <span className="text-[10px] leading-tight text-muted">{c.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Sheet open onClose={onClose} title="Aussehen">
      <div className="space-y-3" data-testid="look-editor">
        <div className="flex items-center gap-3">
          <HeadPreview look={look} size={96} />
          <p className="text-xs text-muted">Zum Start stehen 5 Frisuren, 5 Bärte, gedeckte Farben und je ein paar Tattoos, Narben und Brillen bereit. Weitere schaltest du frei, indem du Bosse besiegst, im Rang aufsteigst und Abzeichen sammelst.</p>
        </div>
        <Tabs
          className="[&>button]:px-2"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'hair', label: 'Frisur' },
            { value: 'beard', label: 'Bart' },
            { value: 'color', label: 'Farben' },
            { value: 'tattoo', label: 'Tattoo' },
            { value: 'scar', label: 'Narbe' },
            { value: 'eyes', label: 'Brille' },
          ]}
        />
        {tab === 'hair' && traitGrid('hair')}
        {tab === 'beard' && traitGrid('beard')}
        {tab === 'tattoo' && traitGrid('tattoo')}
        {tab === 'scar' && traitGrid('scar')}
        {tab === 'eyes' && traitGrid('eyes')}
        {tab === 'color' && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold">Haarfarbe</div>
              {swatches('hairColor')}
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">Bartfarbe</div>
              {swatches('beardColor')}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
