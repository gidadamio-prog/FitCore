import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, CardTitle, Field, Input, NumberInput, Select, fmt } from '@/components/ui';
import { db } from '@/data/db';
import { addDays, formatDate, startOfWeek, today, rangeDates } from '@/domain/dates';
import { addMealPlanItem, generateShoppingList, logRecipe } from '@/data/nutritionRepo';
import { useMeals, useRecipes } from '@/hooks/data';
import { recipeNutrition } from '@/domain/nutrition';
import { toast } from '@/stores/ui';
import { firstError } from '@/domain/schemas';

export function MealPlanning() {
  const [week, setWeek] = useState(startOfWeek(today()));
  const days = rangeDates(week, addDays(week, 6));
  const items = useLiveQuery(() => db.mealPlan.where('date').between(week, addDays(week, 6), true, true).toArray(), [week]) ?? [];
  const recipes = useRecipes();
  const meals = useMeals();
  const shopping = useLiveQuery(() => db.shopping.toArray(), []) ?? [];
  const [form, setForm] = useState({ date: today(), meal: 'lunch', recipeId: '', servings: 1 as number | undefined });
  const [newItem, setNewItem] = useState('');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle
          action={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Vorherige Woche" onClick={() => setWeek(addDays(week, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Nächste Woche" onClick={() => setWeek(addDays(week, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        >
          Wochenplan ab {formatDate(week)}
        </CardTitle>
        <div className="space-y-2">
          {days.map((d) => {
            const list = items.filter((i) => i.date === d);
            const kcal = list.reduce((a, i) => {
              const r = recipes.find((x) => x.id === i.recipeId);
              return a + (r ? (recipeNutrition(r).perServing.kcal ?? 0) * (i.servings ?? 1) : 0);
            }, 0);
            return (
              <div key={d} className="rounded-xl border p-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{formatDate(d)}</span>
                  <span className="tabular-nums text-muted">{kcal ? `${fmt(kcal)} kcal geplant` : ''}</span>
                </div>
                {list.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {meals.find((m) => m.id === i.meal)?.label}: {i.name} {i.servings ? `(${i.servings} P.)` : ''}
                    </span>
                    <span className="flex gap-1">
                      {i.recipeId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const r = recipes.find((x) => x.id === i.recipeId);
                            if (!r) return toast('Rezept existiert nicht mehr.', 'error');
                            await logRecipe(i.date, i.meal, r, i.servings ?? 1);
                            toast('Ins Tagebuch übernommen', 'success');
                          }}
                        >
                          Buchen
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" aria-label="Entfernen" onClick={() => db.mealPlan.delete(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
          <Field label="Datum">{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          <Field label="Mahlzeit">
            {(id) => (
              <Select id={id} value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value })}>
                {meals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Rezept">
            {(id) => (
              <Select id={id} value={form.recipeId} onChange={(e) => setForm({ ...form, recipeId: e.target.value })}>
                <option value="">Bitte wählen</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Portionen">{(id) => <NumberInput id={id} value={form.servings} onValue={(v) => setForm({ ...form, servings: v })} />}</Field>
          <Button
            className="col-span-2"
            disabled={!form.recipeId}
            onClick={async () => {
              const r = recipes.find((x) => x.id === form.recipeId)!;
              await addMealPlanItem({ date: form.date, meal: form.meal, recipeId: r.id, name: r.name, servings: form.servings ?? 1 });
              toast('Eingeplant', 'success');
            }}
          >
            Einplanen
          </Button>
        </div>
      </Card>
      <Card>
        <CardTitle
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const n = await generateShoppingList(week, addDays(week, 6));
                toast(n ? `${n} Positionen ergänzt` : 'Keine geplanten Rezepte in dieser Woche', n ? 'success' : 'info');
              }}
            >
              Aus Wochenplan erzeugen
            </Button>
          }
        >
          <span className="flex items-center gap-1">
            <ShoppingCart className="h-4 w-4" /> Einkaufsliste
          </span>
        </CardTitle>
        <ul className="divide-y">
          {shopping.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={s.checked} onChange={() => db.shopping.update(s.id, { checked: !s.checked })} aria-label={s.name} />
              <span className={s.checked ? 'flex-1 text-muted line-through' : 'flex-1'}>
                {s.name} {s.grams ? <span className="text-xs text-muted">{fmt(s.grams)} g</span> : null}
              </span>
              <Button size="sm" variant="ghost" aria-label="Entfernen" onClick={() => db.shopping.delete(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (!newItem.trim()) throw new Error('Bitte einen Artikel eingeben.');
              await db.shopping.add({ id: crypto.randomUUID(), name: newItem.trim(), checked: false, createdAt: new Date().toISOString() });
              setNewItem('');
            } catch (err) {
              toast(firstError(err), 'error');
            }
          }}
        >
          <Input aria-label="Artikel hinzufügen" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Artikel hinzufügen" />
          <Button type="submit">+</Button>
        </form>
        {shopping.some((s) => s.checked) && (
          <Button variant="ghost" className="mt-2" onClick={() => db.shopping.bulkDelete(shopping.filter((s) => s.checked).map((s) => s.id))}>
            Erledigte entfernen
          </Button>
        )}
      </Card>
    </div>
  );
}
