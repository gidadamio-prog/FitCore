import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Heart, Plus } from 'lucide-react';
import { Button, Card, Input, Sheet, Tabs, cn } from '@/components/ui';
import { db } from '@/data/db';
import type { FoodItem } from '@/domain/types';
import { CustomFoodForm, FoodRow, NutrientTable } from './AddFood';
import { toggleFavorite } from '@/data/nutritionRepo';
import { confirmDialog } from '@/stores/ui';

export function FoodsManager() {
  const [filter, setFilter] = useState<'custom' | 'favorites' | 'all'>('custom');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<FoodItem | 'new' | null>(null);
  const [view, setView] = useState<FoodItem | null>(null);
  const foods =
    useLiveQuery(async () => {
      let list = await db.foods.orderBy('name').toArray();
      if (filter === 'custom') list = list.filter((f) => f.source === 'custom');
      if (filter === 'favorites') list = list.filter((f) => f.favorite);
      const n = q.trim().toLowerCase();
      return n ? list.filter((f) => (f.name + ' ' + (f.brand ?? '')).toLowerCase().includes(n)) : list;
    }, [filter, q]) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button onClick={() => setEdit('new')}>
          <Plus className="h-4 w-4" /> Eigenes Lebensmittel
        </Button>
      </div>
      <Tabs value={filter} onChange={setFilter} items={[{ value: 'custom', label: 'Eigene' }, { value: 'favorites', label: 'Favoriten' }, { value: 'all', label: 'Alle lokal gespeicherten' }]} />
      <Input aria-label="Lebensmittel filtern" placeholder="Filtern …" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card>
        {foods.length ? (
          <ul className="divide-y">
            {foods.map((f) => (
              <FoodRow
                key={f.id}
                f={f}
                onPick={() => setView(f)}
                right={
                  <Button variant="ghost" size="icon" aria-label="Favorit umschalten" onClick={() => toggleFavorite(f.id)}>
                    <Heart className={cn('h-4 w-4', f.favorite && 'fill-current text-danger')} />
                  </Button>
                }
              />
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Keine Lebensmittel.</p>
        )}
      </Card>
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit === 'new' ? 'Eigenes Lebensmittel' : 'Lebensmittel bearbeiten'}>
          <CustomFoodForm initial={edit === 'new' ? undefined : edit} onSaved={() => setEdit(null)} />
        </Sheet>
      )}
      {view && (
        <Sheet
          open
          onClose={() => setView(null)}
          title={view.name}
          footer={
            view.source === 'custom' ? (
              <>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (await confirmDialog({ title: 'Lebensmittel löschen?', text: 'Bereits gebuchte Einträge bleiben erhalten.', danger: true, confirmLabel: 'Löschen' })) {
                      await db.foods.delete(view.id);
                      setView(null);
                    }
                  }}
                >
                  Löschen
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setEdit(view);
                    setView(null);
                  }}
                >
                  Bearbeiten
                </Button>
              </>
            ) : undefined
          }
        >
          <NutrientTable n={view.per100} title={`pro 100 ${view.unitBase}`} />
          {view.license && <p className="mt-2 text-xs text-muted">{view.license}</p>}
        </Sheet>
      )}
    </div>
  );
}
