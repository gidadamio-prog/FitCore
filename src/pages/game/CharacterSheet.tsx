import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Dumbbell, Salad, Check, Scissors, Eye, EyeOff, Palette } from 'lucide-react';
import { WEAPONS, artById, isBuyable, minRankForQuality, weaponById, weaponStats } from '@/domain/weapons';
import type { Rarity } from '@/domain/equipment';
import { ArmorColorPicker, LookEditor, useNewLooks } from './LookEditor';
import { gearExtra } from '@/domain/gear';
import { ARMOR_CLASS_COLOR, ARMOR_CLASS_LABEL, ARMOR_CLASS_MIN_RANK, ARMOR_SETS, ARMOR_SLOTS, bonusText, fullArmorSet, setBonuses, type ArmorSlot } from '@/domain/armor';

const setIdx = (o: OwnedItem) => (o.def.source.kind === 'armor' ? o.def.source.setIdx : -1);
import { Badge, Button, Card, CardTitle, Sheet, fmt, cn } from '@/components/ui';
import { HeroFigure, HeroPortrait, ItemIcon } from '@/components/rpg/Visuals';
import { useBodyType } from '@/hooks/game';
import { bodyTypeLabel } from '@/domain/bodyType';
import { useCurrentGoalVersion } from './useGoal';
import { useSettings } from '@/hooks/data';
import { applyPath, equipArmorSet, equipToHero, previewPath, setArmorHidden, toggleArmorHidden, unequipFromHero } from '@/data/arena';
import { toast } from '@/stores/ui';
import { RANKS, type GameState } from '@/domain/gamification';
import { APPEARANCE_STAGES, CATEGORY_AURA, CATEGORY_LABEL, RARITY_COLOR, RARITY_LABEL, RARITY_MIN_RANK, SLOTS, appearanceStage, inventory, itemById, normalizeLoadout, setAura, type OwnedItem, type SlotId } from '@/domain/equipment';
import { CLASS_TRAINING, PATHS, classById, pathById, pathForGoal, type Hero, type PathId } from '@/domain/rpg';
import { PLAN_TEMPLATES } from '@/data/planTemplates';

const rankName = (level: number) => RANKS[level - 1]?.name ?? '';

export function useHeroGear(hero: Hero, game: GameState) {
  const { purchases, armorLoot } = useSettings();
  const inv = inventory(game.badges, hero.classId, game.rank.rank.level, purchases, gearExtra(game, armorLoot));
  const loadout = normalizeLoadout(hero.loadout, inv, hero.classId);
  return {
    inv,
    loadout,
    aura: setAura(loadout),
    fullSet: fullArmorSet(loadout),
  };
}

function SlotButton({ slot, itemId, inv, blocked, onClick, flash, hidden }: { slot: SlotId; itemId: string | null; inv: OwnedItem[]; blocked: boolean; onClick: () => void; flash: boolean; hidden?: boolean }) {
  const o = itemId ? inv.find((x) => x.def.id === itemId) : undefined;
  const label = SLOTS.find((s) => s.id === slot)!.label;
  return (
    <button
      onClick={onClick}
      className={cn('flex flex-col items-center gap-0.5 rounded-xl p-1', flash && 'equip-flash')}
      aria-label={`${label}: ${o ? o.def.name : blocked ? 'durch Zweihandwaffe belegt' : 'leer'}${o && hidden ? ' (ausgeblendet)' : ''}`}
      data-testid={`slot-${slot}`}
    >
      {o ? (
        <span key={o.def.id} className={cn('equip-pop relative', hidden && 'opacity-50')}>
          <ItemIcon item={o.def} rarity={o.worn} size={54} />
          {hidden && <EyeOff className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-card p-0.5 text-muted" />}
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
  const { inv, loadout, aura, fullSet } = useHeroGear(hero, game);
  const [open, setOpen] = useState<SlotId | null>(null);
  const [flash, setFlash] = useState<SlotId | null>(null);
  const [lookOpen, setLookOpen] = useState(false);
  const [visOpen, setVisOpen] = useState(false);
  const newLooks = useNewLooks(game);
  const path = pathById(pathForGoal(goal?.primaryGoal) ?? undefined);
  const stage = appearanceStage(game.rank.rank.level);
  const twoHand = !!(loadout.main && itemById(loadout.main)?.twoHanded);
  const body = useBodyType();
  const heroAura = fullSet ? ARMOR_CLASS_COLOR[fullSet.cls] : aura ? CATEGORY_AURA[aura] : path?.aura;
  const col = (slots: SlotId[]) => (
    <div className="flex flex-col justify-around gap-2">
      {slots.map((s) => (
        <SlotButton key={s} slot={s} itemId={loadout[s]} inv={inv} blocked={s === 'off' && twoHand} onClick={() => setOpen(s)} flash={flash === s} hidden={hero.armorHidden?.includes(s)} />
      ))}
    </div>
  );
  return (
    <div data-testid="character-sheet">
      <div className="flex items-stretch justify-between gap-1">
        {col(['head', 'chest', 'hands', 'main'])}
        <div className="flex flex-col items-center">
          {body ? <HeroFigure bodyType={body.id} aura={heroAura} width={128} /> : <HeroPortrait classId={hero.classId} rankLevel={game.rank.rank.level} crest={hero.color} aura={heroAura} size={140} />}
          <div className="mt-1 text-center text-[11px] text-muted" data-testid="appearance-stage">
            Erscheinung {stage}/5 · {APPEARANCE_STAGES[stage - 1]!.name}
          </div>
          {body ? (
            <div className="text-center text-[11px] text-muted" data-testid="body-type" title={`KFA ${fmt(body.bodyFatPct, 1)} % · Muskel-Score ${fmt(body.muscleScore, 1)}`}>
              Körperbau: {bodyTypeLabel(body.id)}
              {body.estimated && ' (geschätzt)'}
            </div>
          ) : (
            <div className="max-w-[140px] text-center text-[10px] text-muted">Gewicht eintragen, damit dein Held deinen Körperbau bekommt.</div>
          )}
          {body && (
            <Button size="sm" variant="secondary" className="relative mt-1.5" onClick={() => setLookOpen(true)}>
              <Scissors className="h-3.5 w-3.5" /> Aussehen
              {newLooks.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white" data-testid="look-new">
                  {newLooks.length}
                </span>
              )}
            </Button>
          )}
          {ARMOR_SLOTS.some((s) => loadout[s]) && (
            <Button size="sm" variant="secondary" className="mt-1.5" data-testid="armor-visibility" onClick={() => setVisOpen(true)}>
              <Palette className="h-3.5 w-3.5" /> Rüstung: Farbe & Anzeige
            </Button>
          )}
          {fullSet && (
            <Badge tone="accent" className="mt-1" data-testid="armor-set-bonus">
              Set-Bonus: {fullSet.name} ({ARMOR_CLASS_LABEL[fullSet.cls]})
            </Badge>
          )}
          {fullSet && (
            <div className="mt-0.5 max-w-[170px] text-center text-[11px] text-gold" data-testid="armor-set-effects">
              {setBonuses(fullSet).map(bonusText).join(' · ')}
            </div>
          )}
          {aura && (
            <Badge tone="accent" className="mt-1" data-testid="set-aura">
              Aura: {CATEGORY_LABEL[aura]}
            </Badge>
          )}
        </div>
        {col(['off', 'legs', 'feet'])}
      </div>
      {lookOpen && <LookEditor hero={hero} game={game} onClose={() => setLookOpen(false)} />}
      <Sheet open={visOpen} onClose={() => setVisOpen(false)} title="Rüstung: Farbe & Anzeige">
        <div className="mb-1 text-sm font-semibold">Farbe</div>
        <p className="mb-2 text-[11px] text-muted">Färbt den roten und purpurnen Stoff deiner Rüstung. Gold, Leder und Metall bleiben. Weitere Farben schaltest du über Rang, Abzeichen und Bosse frei.</p>
        <ArmorColorPicker game={game} />
        <div className="mb-1 mt-4 text-sm font-semibold">Anzeige auf der Figur</div>
        <p className="mb-3 text-xs text-muted">Ausgeblendete Teile bleiben angelegt – Kampfwerte und Set-Bonus gelten weiter. Nur deine Figur zeigt sie nicht (z. B. Helm aus, damit die Frisur zu sehen ist).</p>
        <ul className="space-y-2">
          {ARMOR_SLOTS.filter((s) => loadout[s]).map((s) => {
            const off = !!hero.armorHidden?.includes(s);
            return (
              <li key={s}>
                <button
                  type="button"
                  className={cn('flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm', off ? 'border-fg/10 text-muted' : 'border-gold/40')}
                  onClick={() => void toggleArmorHidden(s)}
                  data-testid={`vis-${s}`}
                  aria-pressed={!off}
                >
                  <span>
                    <span className="font-medium text-fg">{SLOTS.find((x) => x.id === s)!.label}</span> · {itemById(loadout[s]!)?.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs">{off ? <><EyeOff className="h-4 w-4" /> ausgeblendet</> : <><Eye className="h-4 w-4" /> sichtbar</>}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" data-testid="vis-all-on" onClick={() => void setArmorHidden([...ARMOR_SLOTS], false)}>
            Alle zeigen
          </Button>
          <Button variant="secondary" data-testid="vis-all-off" onClick={() => void setArmorHidden([...ARMOR_SLOTS], true)}>
            Alle ausblenden
          </Button>
        </div>
      </Sheet>
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
  const order = (o: OwnedItem) => (o.def.source.kind === 'armor' ? setIdx(o) : (weaponById(o.def.id)?.q ?? 0) * 100 + WEAPONS.findIndex((w) => w.id === o.def.id));
  const all = inv.filter((o) => o.def.slot === slot).sort((a, b) => order(a) - order(b));
  const owned = all.filter((o) => o.worn);
  const locked = all.filter((o) => !o.worn);
  const ownedOfSet = (idx: number) => inv.filter((o) => o.worn && o.def.source.kind === 'armor' && o.def.source.setIdx === idx).length;
  const row = (o: OwnedItem) => {
          const equipped = current === o.def.id;
          return (
            <li key={o.def.id} className={cn('flex items-center gap-3 rounded-xl border p-2', equipped && 'border-gold/60 bg-gold/5')} data-testid={`inv-${o.def.id}`}>
              <ItemIcon item={o.def} rarity={o.worn ?? o.unlocked} locked={!o.worn} size={52} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {o.def.name}
                  {o.def.twoHanded && <span className="ml-1 text-[10px] font-normal text-muted">Zweihand</span>}
                </div>
                {o.def.source.kind === 'armor' && (
                  <div className="text-[11px] text-muted">
                    {`${ARMOR_CLASS_LABEL[ARMOR_SETS[o.def.source.setIdx]!.cls]}-Rüstung · Set ${ARMOR_SETS[o.def.source.setIdx]!.name}`}
                    <span className="text-gold"> · Set-Bonus: {setBonuses(ARMOR_SETS[o.def.source.setIdx]!).map(bonusText).join(', ')}</span>
                  </div>
                )}
                {o.def.source.kind === 'weapon' && <WeaponLine id={o.def.id} rarity={o.worn} />}
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
                <div className="flex flex-col items-end gap-1">
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
                  {o.def.source.kind === 'armor' && ownedOfSet(o.def.source.setIdx) > 1 && (
                    <button
                      type="button"
                      className="text-[10px] text-accent underline"
                      onClick={async () => {
                        const n = await equipArmorSet((o.def.source as { setIdx: number }).setIdx, game);
                        toast(`${n} Teile des Sets angelegt`, 'success');
                        onEquipped(slot);
                        onClose();
                      }}
                    >
                      ganzes Set anlegen
                    </button>
                  )}
                </div>
              ) : (o.def.source.kind === 'weapon' && isBuyable(weaponById(o.def.id)!) && game.rank.rank.level >= minRankForQuality(weaponById(o.def.id)!.q)) || (o.def.source.kind === 'armor' && ARMOR_SETS[o.def.source.setIdx]!.cls !== 'boss' && game.rank.rank.level >= ARMOR_CLASS_MIN_RANK[ARMOR_SETS[o.def.source.setIdx]!.cls]) ? (
                <Button size="sm" variant="secondary" onClick={() => nav('/erfolge?tab=markt')}>
                  Markt
                </Button>
              ) : null}
            </li>
          );
        };
  const label = SLOTS.find((s) => s.id === slot)!.label;
  return (
    <Sheet open onClose={onClose} title={`${label} – Inventar`}>
      {current && ARMOR_SLOTS.includes(slot as ArmorSlot) && (
        <Button variant="secondary" className="mb-3 w-full" data-testid="toggle-armor-hidden" onClick={() => void toggleArmorHidden(slot)}>
          {hero.armorHidden?.includes(slot) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {hero.armorHidden?.includes(slot) ? 'Auf der Figur wieder zeigen' : 'Auf der Figur ausblenden (bleibt angelegt)'}
        </Button>
      )}
      <ul className="space-y-2" data-testid="inventory">
        {owned.map(row)}
      </ul>
      {locked.length > 0 && (
        <details className="mt-3" data-testid="inventory-locked">
          <summary className="cursor-pointer text-sm text-muted">Noch nicht freigeschaltet ({locked.length})</summary>
          <ul className="mt-2 space-y-2">{locked.map(row)}</ul>
        </details>
      )}
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
        Ausrüstung ist rein kosmetisch. Rüstung bekommst du als Start-Set, durch Ränge und Bosse, im Markt (Leder ab {rankName(ARMOR_CLASS_MIN_RANK.leder)}, Schwer ab {rankName(ARMOR_CLASS_MIN_RANK.schwer)}) und als Beute nach Kämpfen; ein
        komplettes Set gibt einen Set-Bonus. Seltenheit von Waffen wächst mit der Stufe des Erfolgs (Bronze = Selten, Silber = Episch, Gold = Legendär); Episch ist ab {rankName(RARITY_MIN_RANK.epic)}, Legendär ab{' '}
        {rankName(RARITY_MIN_RANK.legendary)} tragbar. {hero.name} ist {game.rank.rank.name}.
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
          <button
            key={p.id}
            onClick={() => p.id !== current && choose(p.id)}
            className={cn('rounded-xl border p-3 text-left transition', p.id === current ? 'border-gold bg-gold/10' : 'hover:bg-fg/[0.04]')}
            aria-pressed={p.id === current}
            data-testid={`path-${p.id}`}
          >
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

/** Art, Stufe und Kampfwerte einer Waffe im Inventar */
function WeaponLine({ id, rarity }: { id: string; rarity: Rarity | null }) {
  const w = weaponById(id);
  if (!w) return null;
  const st = weaponStats(w);
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return (
    <div className="text-[11px] text-muted" data-testid={`weapon-line-${id}`}>
      <span style={{ color: rarity ? RARITY_COLOR[rarity] : undefined }}>{w.boss ? 'Boss-Waffe' : `${artById(w.art)?.label} ${ROM[w.q]}`}</span>
      {st.atk != null && <> · Angriff +{st.atk}</>}
      {st.def != null && <> · Abwehr +{st.def}</>}
    </div>
  );
}
