import { Coins } from 'lucide-react';
import { Badge, Button, Card, CardTitle, fmt, cn } from '@/components/ui';
import { useSettings } from '@/hooks/data';
import { buyItem, equip } from '@/data/arena';
import { denare, SHOP, XP_PER_DENAR, type ShopItem } from '@/domain/rpg';
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
  const coins = denare(game.xp, purchases);
  const active = (kind: ShopItem['kind']) => (kind === 'palette' ? hero?.palette ?? 'imperium' : kind === 'frame' ? hero?.frame ?? 'bronze' : hero?.title);
  const doEquip = async (kind: ShopItem['kind'], value: string | undefined) => {
    try {
      await equip(kind, value);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <div className="space-y-4">
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
          verdient {fmt(coins.earned)} · ausgegeben {fmt(coins.spent)}
        </div>
      </Card>
      {!hero && <p className="text-sm text-muted">Erschaffe zuerst deinen Helden, um Gegenstände anzulegen.</p>}
      {(['palette', 'frame', 'title'] as const).map((kind) => (
        <Card key={kind}>
          <CardTitle>{KIND_LABEL[kind]}</CardTitle>
          <ul className="divide-y">
            {[{ id: `free-${kind}`, kind, price: 0, ...FREE[kind] }, ...SHOP.filter((s) => s.kind === kind)].map((item) => {
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
                          await buyItem(item.id, game.xp);
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
      <p className="text-[11px] text-muted">Werden EP durch gelöschte Einträge weniger, kann dein Kontostand negativ werden. Gekauftes behältst du; neue Käufe gehen erst wieder mit positivem Stand.</p>
    </div>
  );
}
