import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Dumbbell, Salad, Check } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Sheet, fmt, cn } from '@/components/ui';
import { HeroPortrait, ItemIcon } from '@/components/rpg/Visuals';
import { useCurrentGoalVersion } from './useGoal';
import { useSettings } from '@/hooks/data';
import { applyPath, equipToHero, previewPath, unequipFromHero } from '@/data/arena';
import { toast } from '@/stores/ui';
import { RANKS, type GameState } from '@/domain/gamification';
import {
  APPEARANCE_STAGES, CATEGORY_AURA, CATEGORY_LABEL, RARITY_COLOR, RARITY_LABEL, RARITY_MIN_RANK, SLOTS, appearanceStage, inventory, itemById, normalizeLoadout, setAura,
  type OwnedItem, type SlotId,
} from '@/domain/equipment';
import { CLASS_TRAINING, PATHS, classById, pathById, pathForGoal, type Hero, type PathId } from '@/domain/rpg';
import { PLAN_TEMPLATES } from '@/data/planTemplates';

const rankName = (level: number) => RANKS[level - 1]?.name ?? '';

export function useHeroGear(hero: Hero, game: GameState) {
  const { purchases } = useSettings();
  const inv = inventory(game.badges, hero.classId, game.rank.rank.level, purchases);
  const loadout = normalizeLoadout(hero.loadout, inv, hero.classId);
  return { inv, loadout, aura: setAura(loadout) };
}

function SlotButton({ slot, itemId, inv, blocked, onClick, flash }: { slot: SlotId; itemId: string | null; inv: OwnedItem[]; blocked: boolean; onClick: () => void; flash: boolean }) {
  const o = itemId ? inv.find((x) => x.def.id === itemId) : undefined;
  const label = SLOTS.find((s) => s.id === slot)!.label;
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-0.5 rounded-xl p-1', flash && 'equip-flash')} aria-label={`${label}: ${o ? o.def.name : blocked ? 'durch Zweihandwaffe belegt' : 'leer'}`} data-testid={`slot-${slot}`}>
      {o ? (
        <span key={o.def.id} className="equip-pop">
          <ItemIcon item={o.def} rarity={o.worn} size={54} />
        </span>
      ) : (
        <span className="flex h-[54px] w-[54px] items-center justify-center rounded-xl border border-dashed text-[10px] text-muted">{blocked ? 'Zweihand' : 'leer'}</span>
      )}
      <span className="text-[10px] text-muted">{label}</span>
    </button>
  );
}

export function CharacterSheet({ hero, game }: { hero: Hero; game: GameState }) {
  const goal = useCurrentGoalVersion();
  const { inv, loadout, aura } = useHeroGear(hero, game);
  const [open, setOpen] = useState<SlotId | null>(null);
  const [flash, setFlash] = useState<SlotId | null>(null);
  const path = pathById(pathForGoal(goal?.primaryGoal) ?? undefined);
  const stage = appearanceStage(game.rank.rank.level);
  const twoHand = !!(loadout.main && itemById(loadout.main)?.twoHanded);
  const col = (slots: SlotId[]) => (
    <div className="flex flex-col justify-around gap-2">
      {slots.map((s) => (
        <SlotButton key={s} slot={s} itemId={loadout[s]} inv={inv} blocked={s === 'off' && twoHand} onClick={() => setOpen(s)} flash={flash === s} />
      ))}
    </div>
  );
  return (
    <div data-testid="character-sheet">
      <div className="flex items-stretch justify-between gap-1">
        {col(['main', 'head', 'hands'])}
        <div className="flex flex-col items-center">
          <HeroPortrait classId={hero.classId} rankLevel={game.rank.rank.level} crest={hero.color} aura={aura ? CATEGORY_AURA[aura] : path?.aura} size={140} />
          <div className="mt-1 text-center text-[11px] text-muted" data-testid="appearance-stage">
            Erscheinung {stage}/5 · {APPEARANCE_STAGES[stage - 1]!.name}
          </div>
          {aura && (
            <Badge tone="accent" className="mt-1" data-testid="set-aura">
              Aura: {CATEGORY_LABEL[aura]}
            </Badge>
          )}
        </div>
        {col(['off', 'legs', 'feet'])}
      </div>
      {open && (
        <SlotSheet
          slot={open}
          hero={hero}
          game={game}
          inv={inv}
          current={loadout[open]}
          onClose={() => setOpen(null)}
          onEquipped={(s) => {
            setFlash(s);
            setTimeout(() => setFlash(null), 800);
          }}
        />
      )}
    </div>
  );
}

function SlotSheet({ slot, hero, game, inv, current, onClose, onEquipped }: { slot: SlotId; hero: Hero; game: GameState; inv: OwnedItem[]; current: string | null; onClose: () => void; onEquipped: (s: SlotId) => void }) {
  const nav = useNavigate();
  const items = inv.filter((o) => o.def.slot === slot).sort((a, b) => Number(!!b.worn) - Number(!!a.worn) || Number(a.def.source.kind === 'badge') - Number(b.def.source.kind === 'badge'));
  const label = SLOTS.find((s) => s.id === slot)!.label;
  return (
    <Sheet open onClose={onClose} title={`${label} – Inventar`}>
      <ul className="space-y-2" data-testid="inventory">
        {items.map((o) => {
          const equipped = current === o.def.id;
          return (
            <li key={o.def.id} className={cn('flex items-center gap-3 rounded-xl border p-2', equipped && 'border-gold/60 bg-gold/5')} data-testid={`inv-${o.def.id}`}>
              <ItemIcon item={o.def} rarity={o.worn ?? o.unlocked} locked={!o.worn} size={52} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {o.def.name}
                  {o.def.twoHanded && <span className="ml-1 text-[10px] font-normal text-muted">Zweihand</span>}
                </div>
                {o.worn && (
                  <div className="text-[11px]" style={{ color: RARITY_COLOR[o.worn] }}>
                    {RARITY_LABEL[o.worn]}
                    {o.def.effectText && <span className="text-muted"> · {o.def.effectText}</span>}
                  </div>
                )}
                {o.rankLocked && (
                  <div className="flex items-center gap-1 text-[11px] text-warn">
                    <Lock className="h-3 w-3" /> {RARITY_LABEL[o.rankLocked]} freigeschaltet – tragbar ab {rankName(RARITY_MIN_RANK[o.rankLocked])}
                  </div>
                )}
                {o.hint && <div className="text-[11px] text-muted">{o.hint}</div>}
              </div>
              {equipped ? (
                <Badge tone="accent">
                  <Check className="h-3 w-3" /> angelegt
                </Badge>
              ) : o.worn ? (
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const notice = await equipToHero(o.def.id, game);
                      if (notice) toast(notice, 'info');
                      onEquipped(slot);
                      onClose();
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    }
                  }}
                >
                  Anlegen
                </Button>
              ) : o.def.source.kind === 'starter' ? (
                <Button size="sm" variant="secondary" onClick={() => nav('/erfolge?tab=markt')}>
                  Markt
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {current && (
        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={async () => {
            await unequipFromHero(slot, game);
            onClose();
          }}
        >
          {label} ablegen
        </Button>
      )}
      <p className="mt-3 text-[11px] text-muted">
        Ausrüstung ist rein kosmetisch. Seltenheit wächst mit der Stufe des Erfolgs (Bronze = Selten, Silber = Episch, Gold = Legendär); Episch ist ab {rankName(RARITY_MIN_RANK.epic)}, Legendär ab {rankName(RARITY_MIN_RANK.legendary)} tragbar. {hero.name} ist {game.rank.rank.name}.
      </p>
    </Sheet>
  );
}

export function ClassFocusCard({ hero }: { hero: Hero }) {
  const nav = useNavigate();
  const t = CLASS_TRAINING[hero.classId];
  const templates = t.templates.map((id) => PLAN_TEMPLATES.find((p) => p.id === id)).filter((x): x is (typeof PLAN_TEMPLATES)[number] => !!x);
  return (
    <Card data-testid="class-focus">
      <CardTitle>
        <span className="flex items-center gap-1">
          <Dumbbell className="h-4 w-4 text-gold" /> Training als {classById(hero.classId)?.name}
        </span>
      </CardTitle>
      <div className="text-sm font-semibold">{t.focus}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
        {t.guidance.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <div className="mt-2 text-xs text-muted">
        Klassen-Feldzug jede Woche: <b className="text-fg">{t.quest.title}</b> – {t.quest.description}
      </div>
      <div className="mt-3 text-xs text-muted">Empfohlene Planvorlagen:</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {templates.map((p) => (
          <Badge key={p.id}>{p.name}</Badge>
        ))}
      </div>
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => nav('/training?vorlagen=1')}>
        Plan aus Vorlage erstellen
      </Button>
    </Card>
  );
}

export function LifePathCard() {
  const goal = useCurrentGoalVersion();
  const current = pathForGoal(goal?.primaryGoal);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewPath>> | null>(null);
  const choose = async (id: PathId) => {
    try {
      setPreview(await previewPath(id));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Card data-testid="life-path">
      <CardTitle>
        <span className="flex items-center gap-1">
          <Salad className="h-4 w-4 text-gold" /> Lebensweg (Ernährung)
        </span>
      </CardTitle>
      <p className="mb-2 text-xs text-muted">Der Lebensweg setzt dein Kalorien- und Makroziel. Berechnet wird wie im Zielrechner, mit denselben Sicherheitsgrenzen; ein Wechsel legt eine neue Zielversion ab heute an.</p>
      <div className="grid gap-2">
        {PATHS.map((p) => (
          <button key={p.id} onClick={() => p.id !== current && choose(p.id)} className={cn('rounded-xl border p-3 text-left transition', p.id === current ? 'border-gold bg-gold/10' : 'hover:bg-fg/[0.04]')} aria-pressed={p.id === current} data-testid={`path-${p.id}`}>
            <div className="flex items-center justify-between">
              <span className="font-brand font-semibold">{p.name}</span>
              {p.id === current && <Badge tone="accent">aktiv</Badge>}
            </div>
            <div className="text-xs italic text-muted">„{p.motto}“</div>
            <div className="mt-0.5 text-xs">{p.description}</div>
          </button>
        ))}
      </div>
      {!current && <p className="mt-2 text-[11px] text-muted">Dein aktuelles Ziel passt zu keinem Lebensweg genau – wähle einen, um es anzugleichen.</p>}
      {preview && (
        <Sheet
          open
          onClose={() => setPreview(null)}
          title={`Lebensweg ${preview.path.name}`}
          footer={
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  try {
                    await applyPath(preview.path.id);
                    toast(`Lebensweg ${preview.path.name} gewählt – neues Ziel gilt ab heute`, 'success');
                    setPreview(null);
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  }
                }}
              >
                Übernehmen
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Abbrechen
              </Button>
            </div>
          }
        >
          <div className="space-y-2 text-sm" data-testid="path-preview">
            <p className="italic text-muted">„{preview.path.motto}“</p>
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1" />
                  <th className="py-1 text-right">bisher</th>
                  <th className="py-1 text-right">neu</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(
                  [
                    ['Kalorien', preview.goal.calorieTarget, preview.computed.calorieTarget, 'kcal'],
                    ['Eiweiß', preview.goal.proteinG, preview.computed.proteinG, 'g'],
                    ['Kohlenhydrate', preview.goal.carbsG, preview.computed.carbsG, 'g'],
                    ['Fett', preview.goal.fatG, preview.computed.fatG, 'g'],
                  ] as const
                ).map(([l, a, b, u]) => (
                  <tr key={l} className="border-t">
                    <td className="py-1.5">{l}</td>
                    <td className="py-1.5 text-right text-muted">
                      {fmt(a)} {u}
                    </td>
                    <td className="py-1.5 text-right font-semibold">
                      {fmt(b)} {u}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted">Wöchentliche Veränderung: {fmt(preview.computed.weeklyRateKg, 2)} kg</p>
            {preview.computed.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-warn">
                {preview.computed.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </Sheet>
      )}
    </Card>
  );
}
