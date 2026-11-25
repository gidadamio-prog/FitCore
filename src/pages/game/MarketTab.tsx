import { Coins } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Tabs, fmt, cn } from '@/components/ui';
import { useSettings } from '@/hooks/data';
import { buyArmor, buyItem, buyWeapon, equip, equipArmorSet, equipToHero, extraPrices } from '@/data/arena';
import { denare, SHOP, XP_PER_DENAR, type ShopItem } from '@/domain/rpg';
import { inventory, itemById } from '@/domain/equipment';
import { WEAPON_ARTS, WEAPONS, isBuyable, minRankForQuality, weaponPrice, weaponStats, type WeaponArt } from '@/domain/weapons';
import { ARMOR_CLASS_LABEL, ARMOR_CLASS_MIN_RANK, ARMOR_SETS, ARMOR_SLOTS, armorItemId, armorPrice, bonusText, setBonuses, type ArmorClass } from '@/domain/armor';
import { gearExtra } from '@/domain/gear';
import { RANKS } from '@/domain/gamification';
import { useState } from 'react';
import { ItemIcon } from '@/components/rpg/Visuals';
import type { GameState } from '@/domain/gamification';
import { confirmDialog, toast } from '@/stores/ui';

const KIND_LABEL: Record<ShopItem['kind'], string> = { palette: 'Farbpaletten der App', frame: 'Kränze für dein Wappen', title: 'Titel' };
const FREE: Record<ShopItem['kind'], { name: string; value: string | undefined; description: string }> = {
  palette: { name: 'Imperium', value: 'imperium', description: 'Purpur und Gold – Standard.' },
  frame: { name: 'Bronzekranz', value: 'bronze', description: 'Standard.' },
  title: { name: 'Kein Titel', value: undefined, description: 'Nur dein Name.' },
};

export function MarketTab({ game }: { game: GameState }) {
  const { hero, purchases } = useSettings();
  const coins = denare(game.xp, purchases, game.bonusDenare, extraPrices(purchases));
  const titlesFromAchievements = game.secrets.filter((x) => x.achieved).map((x) => ({ id: `ach-${x.id}`, kind: 'title' as const, price: 0, name: x.reward.title, value: x.reward.title, description: `Erfolg „${x.name}“` }));
  const active = (kind: ShopItem['kind']) => (kind === 'palette' ? hero?.palette ?? 'imperium' : kind === 'frame' ? hero?.frame ?? 'bronze' : hero?.title);
  const doEquip = async (kind: ShopItem['kind'], value: string | undefined) => {
    try {
      await equip(kind, value);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="stagger space-y-4">
      <Card className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted">Deine Denare</div>
          <div className="flex items-center gap-2 text-2xl font-bold tabular-nums" data-testid="denare">
            <Coins className="h-6 w-6 text-gold" /> {fmt(coins.balance)}
          </div>
        </div>
        <div className="text-right text-[11px] text-muted">
          1 Denar je {XP_PER_DENAR} EP
          <br />
          verdient {fmt(coins.earned)}
          {game.bonusDenare > 0 && ` (davon ${fmt(game.bonusDenare)} aus Erfolgen)`} · ausgegeben {fmt(coins.spent)}
        </div>
      </Card>
      {!hero && <p className="text-sm text-muted">Erschaffe zuerst deinen Helden, um Gegenstände anzulegen.</p>}
      {(['palette', 'frame', 'title'] as const).map((kind) => (
        <Card key={kind}>
          <CardTitle>{KIND_LABEL[kind]}</CardTitle>
          <ul className="divide-y">
            {[{ id: `free-${kind}`, kind, price: 0, ...FREE[kind] }, ...(kind === 'title' ? titlesFromAchievements : []), ...SHOP.filter((s) => s.kind === kind)].map((item) => {
              const owned = item.price === 0 || purchases.includes(item.id);
              const isActive = active(kind) === item.value;
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2" data-testid={`shop-${item.id}`}>
                  <div className="min-w-0">
                    <div className={cn('text-sm font-medium', isActive && 'text-gold')}>{item.name}</div>
                    <div className="text-[11px] text-muted">{item.description}</div>
                  </div>
                  {isActive ? (
                    <Badge tone="accent">aktiv</Badge>
                  ) : owned ? (
                    <Button size="sm" variant="secondary" disabled={!hero} onClick={() => doEquip(kind, item.value)}>
                      Anlegen
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={coins.balance < item.price}
                      onClick={async () => {
                        if (!(await confirmDialog({ title: `${item.name} kaufen?`, text: `Kostet ${item.price} Denare. Denare entstehen aus EP und werden nicht mit echtem Geld gekauft.`, confirmLabel: 'Kaufen' }))) return;
                        try {
                          await buyItem(item.id, game.xp, game.bonusDenare);
                          if (hero) await equip(kind, item.value);
                          toast(`${item.name} gehört dir`, 'success');
                        } catch (e) {
                          toast((e as Error).message, 'error');
                        }
                      }}
                    >
                      <Coins className="h-4 w-4" /> {item.price}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      {hero && <ArmorShop game={game} balance={coins.balance} />}
      {hero && <WeaponShop game={game} balance={coins.balance} />}
      <p className="text-[11px] text-muted">Werden EP durch gelöschte Einträge weniger, kann dein Kontostand negativ werden. Gekauftes behältst du; neue Käufe gehen erst wieder mit positivem Stand.</p>
    </div>
  );
}

function ArmorShop({ game, balance }: { game: GameState; balance: number }) {
  const { hero, purchases, armorLoot, forgeLog } = useSettings();
  const [cls, setCls] = useState<Exclude<ArmorClass, 'boss'>>('stoff');
  const inv = inventory(game.badges, hero?.classId, game.rank.rank.level, purchases, gearExtra(game, armorLoot, forgeLog));
  const owned = new Set(inv.filter((o) => o.unlocked).map((o) => o.def.id));
  const rank = game.rank.rank.level;
  const open = rank >= ARMOR_CLASS_MIN_RANK[cls];
  const buy = async (ids: string[], label: string, price: number, idx: number) => {
    if (!(await confirmDialog({ title: `${label} kaufen?`, text: `Kostet ${price} Denare. Danach im Inventar anlegbar.`, confirmLabel: 'Kaufen' }))) return;
    try {
      await buyArmor(ids, game);
      if (ids.length > 1 && (await confirmDialog({ title: 'Gleich anziehen?', text: 'Alle Teile des Sets jetzt anlegen?', confirmLabel: 'Anlegen' }))) await equipArmorSet(idx, game);
      toast(`${label} gehört dir`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Card data-testid="armor-shop">
      <CardTitle>Rüstung</CardTitle>
      <p className="mb-2 text-[11px] text-muted">Einzelteile oder ganze Sets. Boss-Rüstung gibt es nur von den Bossen auf der Weltkarte. Teile bekommst du auch als Beute nach Kämpfen.</p>
      <Tabs
        value={cls}
        onChange={setCls}
        items={(['stoff', 'leder', 'schwer'] as const).map((c) => ({ value: c, label: `${ARMOR_CLASS_LABEL[c]}${rank < ARMOR_CLASS_MIN_RANK[c] ? ' 🔒' : ''}` }))}
      />
      {!open && <p className="py-3 text-sm text-muted">{ARMOR_CLASS_LABEL[cls]}-Rüstung gibt es ab Rang {RANKS[ARMOR_CLASS_MIN_RANK[cls] - 1]?.name}.</p>}
      <ul className="mt-2 divide-y">
        {ARMOR_SETS.filter((st) => st.cls === cls).map((st) => {
          const ids = ARMOR_SLOTS.map((sl) => armorItemId(st.idx, sl));
          const missing = ids.filter((id) => !owned.has(id));
          const piece = armorPrice(st);
          return (
            <li key={st.idx} className="py-2" data-testid={`armor-set-${st.idx}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{st.name}</div>
                  <div className="text-[10px] text-gold">Set-Bonus: {setBonuses(st).map(bonusText).join(', ')}</div>
                </div>
                {missing.length === 0 ? (
                  <Badge>komplett</Badge>
                ) : (
                  <Button size="sm" disabled={!open || balance < piece * missing.length} onClick={() => buy(missing, `${st.name} (${missing.length} Teile)`, piece * missing.length, st.idx)}>
                    <Coins className="h-4 w-4" /> {piece * missing.length}
                  </Button>
                )}
              </div>
              <div className="mt-1 flex gap-1.5">
                {ids.map((id) => {
                  const def = itemById(id)!;
                  const have = owned.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={have || !open}
                      onClick={() => buy([id], def.name, piece, st.idx)}
                      aria-label={have ? `${def.name}: im Inventar` : `${def.name} für ${piece} Denare kaufen`}
                      className="flex flex-col items-center"
                    >
                      <ItemIcon item={def} rarity={have ? 'common' : null} locked={!have} size={46} animate={false} />
                      <span className="text-[9px] text-muted">{have ? '✓' : piece}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function WeaponShop({ game, balance }: { game: GameState; balance: number }) {
  const { hero, purchases, armorLoot, forgeLog } = useSettings();
  const [art, setArt] = useState<WeaponArt>('schwert');
  const inv = inventory(game.badges, hero?.classId, game.rank.rank.level, purchases, gearExtra(game, armorLoot, forgeLog));
  const owned = new Set(inv.filter((o) => o.unlocked).map((o) => o.def.id));
  const rank = game.rank.rank.level;
  const list = WEAPONS.filter((w) => w.art === art && isBuyable(w));
  const buy = async (id: string) => {
    const w = WEAPONS.find((x) => x.id === id)!;
    if (!(await confirmDialog({ title: `${w.name} kaufen?`, text: `Kostet ${weaponPrice(w)} Denare. Danach im Inventar anlegbar.`, confirmLabel: 'Kaufen' }))) return;
    try {
      await buyWeapon(id, game);
      if (await confirmDialog({ title: 'Gleich anlegen?', text: `${w.name} jetzt in die ${w.slot === 'main' ? 'Haupthand' : 'Nebenhand'} nehmen?`, confirmLabel: 'Anlegen' })) {
        const notice = await equipToHero(id, game);
        if (notice) toast(notice, 'info');
      }
      toast(`${w.name} gehört dir`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Card data-testid="weapon-shop">
      <CardTitle>Waffen</CardTitle>
      <p className="mb-2 text-[11px] text-muted">Im Markt gibt es die Stufen I–V, je nach Rang. Stärkere Waffen bekommst du als Beute, über Abzeichen und von den Bossen.</p>
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Waffenart">
        {WEAPON_ARTS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={a.id === art} onClick={() => setArt(a.id)} className={cn('shrink-0 rounded-full px-3 py-1 text-xs', a.id === art ? 'bg-gold/20 text-gold' : 'bg-fg/[0.06] text-muted')}>
            {a.label}
          </button>
        ))}
      </div>
      <ul className="mt-2 divide-y">
        {list.map((w) => {
          const def = itemById(w.id)!;
          const have = owned.has(w.id);
          const open = rank >= minRankForQuality(w.q);
          const st = weaponStats(w);
          return (
            <li key={w.id} className="flex items-center gap-3 py-2" data-testid={`shop-weapon-${w.id}`}>
              <ItemIcon item={def} rarity={have ? 'common' : null} locked={!have && !open} size={46} animate={false} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{w.name}</div>
                <div className="text-[11px] text-muted">
                  Stufe {ROM[w.q]}
                  {w.twoHanded && ' · Zweihand'}
                  {st.atk != null && ` · Angriff +${st.atk}`}
                  {st.def != null && ` · Abwehr +${st.def}`}
                </div>
                {!open && <div className="text-[11px] text-warn">ab Rang {RANKS[minRankForQuality(w.q) - 1]?.name}</div>}
              </div>
              {have ? (
                <Badge>im Inventar</Badge>
              ) : (
                <Button size="sm" disabled={!open || balance < weaponPrice(w)} onClick={() => buy(w.id)}>
                  <Coins className="h-4 w-4" /> {weaponPrice(w)}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
