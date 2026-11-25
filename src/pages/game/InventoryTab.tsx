import { useMemo, useState } from 'react';
import { Check, Hammer, Shirt, Swords } from 'lucide-react';
import { Badge, Button, Card, Progress, Sheet, cn, fmt } from '@/components/ui';
import { ItemIcon } from '@/components/rpg/Visuals';
import { useSettings } from '@/hooks/data';
import { equipArmorSet, equipToHero } from '@/data/arena';
import { dismantleCheck, dismantleItem, isUnique, upgradeItem } from '@/data/forgeRepo';
import { MATS, MAX_FORGE_LEVEL, canAfford, dismantleGain, forgeLevels, matBalance, matText, upgradeCost, type Mat, type Mats } from '@/domain/forge';
import { confirmDialog } from '@/stores/ui';
import { gearExtra } from '@/domain/gear';
import { RARITY_COLOR, RARITY_LABEL, RARITIES, SLOTS, inventory, normalizeLoadout, type OwnedItem, type SlotId } from '@/domain/equipment';
import { ARMOR_CLASS_LABEL, ARMOR_SETS, bonusText, setBonuses } from '@/domain/armor';
import { artById, weaponById, weaponStats } from '@/domain/weapons';
import { itemStats } from '@/domain/combat';
import type { GameState } from '@/domain/gamification';
import { toast } from '@/stores/ui';

type Filter = 'alle' | 'waffen' | 'ruestung';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'waffen', label: 'Waffen' },
  { id: 'ruestung', label: 'Rüstung' },
];
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const isWeapon = (o: OwnedItem) => o.def.source.kind === 'weapon';

/** Stärke für die Sortierung: Seltenheit, dann Stufe bzw. Set */
const power = (o: OwnedItem) => {
  const r = RARITIES.indexOf(o.worn ?? o.unlocked ?? 'common') * 100;
  if (o.def.source.kind === 'weapon') return r + (weaponById(o.def.id)?.q ?? 0) * 10;
  return r + ARMOR_SETS[o.def.source.setIdx]!.tier * 10;
};

/** Untertitel: Art und Stufe bzw. Rüstungsklasse und Set */
export function itemKindLabel(o: OwnedItem) {
  if (o.def.source.kind === 'weapon') {
    const w = weaponById(o.def.id)!;
    return w.boss ? 'Boss-Waffe' : `${artById(w.art)?.label} ${ROM[w.q]}`;
  }
  const set = ARMOR_SETS[o.def.source.setIdx]!;
  return `${ARMOR_CLASS_LABEL[set.cls]} · Set ${set.name}`;
}

/** Sammlung aller Waffen und Rüstungsteile: Filter, Sortierung, Details und Anlegen. */
export function InventoryTab({ game }: { game: GameState }) {
  const settings = useSettings();
  const { hero, purchases, armorLoot, forgeLog, worldLog } = settings;
  const mats = matBalance(worldLog, forgeLog);
  const levels = forgeLevels(forgeLog);
  const inv = useMemo(() => inventory(game.badges, hero?.classId, game.rank.rank.level, purchases, gearExtra(game, armorLoot, forgeLog)), [game, hero?.classId, purchases, armorLoot, forgeLog]);
  const loadout = hero ? normalizeLoadout(hero.loadout, inv, hero.classId) : null;
  const equipped = new Set(Object.values(loadout ?? {}).filter(Boolean) as string[]);
  const [filter, setFilter] = useState<Filter>('alle');
  const [slot, setSlot] = useState<SlotId | 'alle'>('alle');
  const [showLocked, setShowLocked] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const owned = inv.filter((o) => o.worn);
  const weaponsOwned = owned.filter(isWeapon).length;
  const armorOwned = owned.length - weaponsOwned;
  const weaponsAll = inv.filter(isWeapon).length;
  const armorAll = inv.length - weaponsAll;
  const setsDone = ARMOR_SETS.filter((st) => owned.filter((o) => o.def.source.kind === 'armor' && o.def.source.setIdx === st.idx).length === 5).length;

  const slots = SLOTS.filter((s) => (filter === 'waffen' ? s.id === 'main' || s.id === 'off' : filter === 'ruestung' ? s.id !== 'main' && s.id !== 'off' : true));
  const list = inv
    .filter((o) => (filter === 'waffen' ? isWeapon(o) : filter === 'ruestung' ? !isWeapon(o) : true))
    .filter((o) => slot === 'alle' || o.def.slot === slot)
    .filter((o) => showLocked || o.worn)
    .sort((a, b) => Number(!!b.worn) - Number(!!a.worn) || Number(equipped.has(b.def.id)) - Number(equipped.has(a.def.id)) || power(b) - power(a));
  const current = open ? inv.find((o) => o.def.id === open) : undefined;

  return (
    <div className="space-y-4" data-testid="inventory-tab">
      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <Swords className="mx-auto h-5 w-5 text-gold" />
            <div className="mt-1 text-lg font-bold tabular-nums" data-testid="inv-count-weapons">
              {weaponsOwned}
              <span className="text-xs font-normal text-muted">/{weaponsAll}</span>
            </div>
            <div className="text-[11px] text-muted">Waffen</div>
          </div>
          <div>
            <Shirt className="mx-auto h-5 w-5 text-gold" />
            <div className="mt-1 text-lg font-bold tabular-nums" data-testid="inv-count-armor">
              {armorOwned}
              <span className="text-xs font-normal text-muted">/{armorAll}</span>
            </div>
            <div className="text-[11px] text-muted">Rüstungsteile</div>
          </div>
          <div>
            <Check className="mx-auto h-5 w-5 text-gold" />
            <div className="mt-1 text-lg font-bold tabular-nums" data-testid="inv-count-sets">
              {setsDone}
              <span className="text-xs font-normal text-muted">/{ARMOR_SETS.length}</span>
            </div>
            <div className="text-[11px] text-muted">komplette Sets</div>
          </div>
        </div>
        <Progress className="mt-3" value={owned.length} max={inv.length} label="Sammlung" />
        <div className="mt-1 text-center text-[11px] text-muted">{fmt(Math.round((owned.length / Math.max(1, inv.length)) * 100))} % der Sammlung</div>
      </Card>

      <Card data-testid="forge-card">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Hammer className="h-4 w-4 text-gold" /> Schmiede
        </div>
        <MatRow have={mats} />
        <p className="mt-2 text-[11px] text-muted">Tippe ein Teil an, um es zu verbessern (+1 bis +10, je Stufe +6 % Angriff bzw. Abwehr, ohne Fehlschlag) oder Überzähliges zu zerlegen. Material gibt es bei Siegen, aus Truhen und von Bossen auf der Weltkarte.</p>
      </Card>

      <div className="space-y-2">
        <div className="flex gap-1" role="tablist" aria-label="Art">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setSlot('alle');
              }}
              className={cn('flex-1 rounded-lg py-1.5 text-sm', filter === f.id ? 'bg-gold/20 font-semibold text-gold' : 'bg-fg/[0.05] text-muted')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Platz">
          {[{ id: 'alle' as const, label: 'Alle Plätze' }, ...slots].map((s) => (
            <button key={s.id} type="button" aria-pressed={slot === s.id} onClick={() => setSlot(s.id)} className={cn('shrink-0 rounded-full px-3 py-1 text-xs', slot === s.id ? 'bg-fg/[0.12] text-fg' : 'bg-fg/[0.04] text-muted')}>
              {s.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} data-testid="inv-show-locked" />
          Auch noch fehlende zeigen
        </label>
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Hier ist noch nichts. Beute gibt es auf der Weltkarte, Ausrüstung im Markt.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2" data-testid="inv-grid">
          {list.map((o) => (
            <li key={o.def.id}>
              <button type="button" onClick={() => setOpen(o.def.id)} className="flex w-full flex-col items-center gap-1 rounded-xl p-1 text-center" data-testid={`inv-tile-${o.def.id}`} aria-label={`${o.def.name}${equipped.has(o.def.id) ? ', angelegt' : ''}${o.worn ? '' : ', fehlt noch'}`}>
                <span className="relative">
                  <ItemIcon item={o.def} rarity={o.worn ?? o.unlocked} locked={!o.worn} size={62} animate={false} />
                  {equipped.has(o.def.id) && <Check className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-gold p-0.5 text-black" />}
                  {(levels.get(o.def.id) ?? 0) > 0 && o.worn && (
                    <span className="absolute -bottom-1 -left-1 rounded-md bg-black/80 px-1 text-[10px] font-bold text-gold" data-testid={`forge-level-${o.def.id}`}>
                      +{levels.get(o.def.id)}
                    </span>
                  )}
                </span>
                <span className={cn('line-clamp-2 text-[10px] leading-tight', o.worn ? 'text-fg' : 'text-muted')}>{o.def.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && (
        <ItemSheet
          o={current}
          game={game}
          equipped={equipped.has(current.def.id)}
          owned={owned}
          canEquip={!!hero}
          level={levels.get(current.def.id) ?? 0}
          mats={mats}
          dismantleBlock={dismantleCheck(current.def.id, settings, equipped)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function ItemSheet({ o, game, equipped, owned, canEquip, level, mats, dismantleBlock, onClose }: { o: OwnedItem; game: GameState; equipped: boolean; owned: OwnedItem[]; canEquip: boolean; level: number; mats: Record<Mat, number>; dismantleBlock: string | null; onClose: () => void }) {
  const r = o.worn ?? o.unlocked;
  const st = o.worn ? itemStats(o.def.id, o.worn, level) : o.def.source.kind === 'weapon' ? weaponStats(weaponById(o.def.id)!) : itemStats(o.def.id, 'common');
  const next = o.worn && level < MAX_FORGE_LEVEL ? itemStats(o.def.id, o.worn, level + 1) : null;
  const cost = level < MAX_FORGE_LEVEL ? upgradeCost(level + 1, isUnique(o.def.id)) : null;
  const set = o.def.source.kind === 'armor' ? ARMOR_SETS[o.def.source.setIdx]! : null;
  const setOwned = set ? owned.filter((x) => x.def.source.kind === 'armor' && x.def.source.setIdx === set.idx).length : 0;
  const slotLabel = SLOTS.find((s) => s.id === o.def.slot)!.label;
  return (
    <Sheet open onClose={onClose} title={`${o.def.name}${level > 0 && o.worn ? ` +${level}` : ''}`}>
      <div className="space-y-3" data-testid="item-sheet">
        <div className="flex items-center gap-4">
          <ItemIcon item={o.def} rarity={r} locked={!o.worn} size={96} />
          <div className="min-w-0 space-y-1 text-sm">
            <div className="text-muted">{itemKindLabel(o)}</div>
            <div>
              {slotLabel}
              {o.def.twoHanded && ' · Zweihand'}
            </div>
            {r && <div style={{ color: RARITY_COLOR[r] }}>{RARITY_LABEL[r]}</div>}
          </div>
        </div>
        <div className="flex gap-2 text-sm" data-testid="item-stats">
          {st.atk != null && <Badge>Angriff +{st.atk}</Badge>}
          {st.def != null && <Badge>Abwehr +{st.def}</Badge>}
        </div>
        {set && (
          <div className="rounded-xl bg-fg/[0.04] p-3 text-xs">
            <div className="font-medium">
              Set {set.name}: {setOwned}/5 Teile
            </div>
            <div className="text-gold">Set-Bonus: {setBonuses(set).map(bonusText).join(', ')}</div>
          </div>
        )}
        {!o.worn && o.hint && <p className="text-xs text-muted">So bekommst du es: {o.hint}</p>}
        {o.worn &&
          (equipped ? (
            <Badge tone="accent">
              <Check className="h-3 w-3" /> angelegt
            </Badge>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!canEquip}
                data-testid="item-equip"
                onClick={async () => {
                  try {
                    const notice = await equipToHero(o.def.id, game);
                    if (notice) toast(notice, 'info');
                    toast(`${o.def.name} angelegt`, 'success');
                    onClose();
                  } catch (e) {
                    toast((e as Error).message, 'error');
                  }
                }}
              >
                Anlegen
              </Button>
              {set && setOwned > 1 && (
                <Button
                  variant="secondary"
                  disabled={!canEquip}
                  onClick={async () => {
                    const n = await equipArmorSet(set.idx, game);
                    toast(`${n} Teile des Sets angelegt`, 'success');
                    onClose();
                  }}
                >
                  ganzes Set
                </Button>
              )}
            </div>
          ))}
        {o.worn && (
          <div className="rounded-xl border border-gold/25 p-3" data-testid="forge-section">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-1">
                <Hammer className="h-4 w-4 text-gold" /> Schmiede
              </span>
              <span className="text-gold" data-testid="forge-level">
                +{level} / +{MAX_FORGE_LEVEL}
              </span>
            </div>
            {next && cost ? (
              <>
                <div className="mb-2 text-xs text-muted">
                  Auf +{level + 1}: {next.atk != null && `Angriff ${st.atk} → ${next.atk}`}
                  {next.atk != null && next.def != null && ' · '}
                  {next.def != null && `Abwehr ${st.def} → ${next.def}`}
                </div>
                <MatRow have={mats} need={cost} />
                <Button
                  className="mt-2 w-full"
                  disabled={!canAfford(mats, cost)}
                  data-testid="forge-upgrade"
                  onClick={async () => {
                    try {
                      const to = await upgradeItem(o.def.id, game);
                      toast(`${o.def.name} ist jetzt +${to}`, 'success');
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    }
                  }}
                >
                  <Hammer className="h-4 w-4" /> Verbessern auf +{level + 1}
                </Button>
              </>
            ) : (
              <p className="text-xs text-gold">Meisterhaft geschmiedet – höchste Stufe erreicht.</p>
            )}
            <div className="mt-3 border-t pt-2">
              {dismantleBlock ? (
                <p className="text-[11px] text-muted">{dismantleBlock}</p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  data-testid="forge-dismantle"
                  onClick={async () => {
                    const gain = dismantleGain(o.worn!, level);
                    if (!(await confirmDialog({ title: `${o.def.name} zerlegen?`, text: `Du bekommst ${matText(gain)}. Das Teil ist danach weg (es kann später erneut als Beute fallen).`, confirmLabel: 'Zerlegen' }))) return;
                    try {
                      const g = await dismantleItem(o.def.id, game);
                      toast(`Zerlegt: ${matText(g)}`, 'success');
                      onClose();
                    } catch (e) {
                      toast((e as Error).message, 'error');
                    }
                  }}
                >
                  Zerlegen · {matText(dismantleGain(o.worn, level))}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Materialbestand, optional mit Bedarf (rot, wenn es nicht reicht) */
export function MatRow({ have, need }: { have: Record<Mat, number>; need?: Mats }) {
  const list = need ? MATS.filter((m) => (need[m.id] ?? 0) > 0) : MATS;
  return (
    <div className="flex flex-wrap gap-2" data-testid={need ? 'forge-cost' : 'mats'}>
      {list.map((m) => {
        const n = need?.[m.id];
        const ok = n == null || have[m.id] >= n;
        return (
          <span key={m.id} className={cn('inline-flex items-center gap-1 rounded-full bg-fg/[0.06] px-2 py-0.5 text-xs tabular-nums', !ok && 'text-danger')} data-testid={`mat-${m.id}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
            {m.label} {n != null ? `${have[m.id]}/${n}` : have[m.id]}
          </span>
        );
      })}
    </div>
  );
}
