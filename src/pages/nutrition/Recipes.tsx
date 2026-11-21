import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Plus, Trash2, Search } from 'lucide-react';
import { Button, Card, Empty, Field, Input, NumberInput, Select, Sheet, Textarea, fmt } from '@/components/ui';
import type { FoodItem, Recipe, RecipeIngredient } from '@/domain/types';
import { recipeNutrition } from '@/domain/nutrition';
import { deleteRecipe, logRecipe, saveRecipe, searchLocalFoods, upsertFood } from '@/data/nutritionRepo';
import { openFoodFacts } from '@/data/foodProviders';
import { NutrientTable } from './AddFood';
import { useMeals, useRecipes } from '@/hooks/data';
import { firstError } from '@/domain/schemas';
import { toast, confirmDialog, useUi } from '@/stores/ui';

const CATEGORIES = ['Frühstück', 'Hauptgericht', 'Snack', 'Dessert', 'Getränk', 'Sonstiges'];

export function Recipes() {
  const recipes = useRecipes();
  const [edit, setEdit] = useState<Partial<Recipe> | null>(null);
  const [log, setLog] = useState<Recipe | null>(null);
  return (
    <div className="space-y-3">
      <Button onClick={() => setEdit({ name: '', category: 'Hauptgericht', servings: 2, instructions: '', ingredients: [] })}>
        <Plus className="h-4 w-4" /> Neues Rezept
      </Button>
      {!recipes.length && <Empty icon={<BookOpen className="h-8 w-8" />} title="Noch keine Rezepte" text="Rezepte berechnen Nährwerte automatisch aus den Zutaten." />}
      <div className="grid gap-3 md:grid-cols-2">
        {recipes.map((r) => {
          const n = recipeNutrition(r);
          return (
            <Card key={r.id} data-testid="recipe-card">
              <div className="flex gap-3">
                {r.imageDataUrl && <img src={r.imageDataUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-muted">
                    {r.category} · {r.servings} Portionen · {r.ingredients.length} Zutaten
                  </div>
                  <div className="mt-1 text-sm tabular-nums">
                    {fmt(n.perServing.kcal)} kcal · P {fmt(n.perServing.protein, 1)} · KH {fmt(n.perServing.carbs, 1)} · F {fmt(n.perServing.fat, 1)} <span className="text-xs text-muted">/ Portion</span>
                  </div>
                  {n.unknownIngredients.length > 0 && <div className="text-xs text-warn">Unvollständige Werte: {n.unknownIngredients.join(', ')}</div>}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setLog(r)}>
                  Ins Tagebuch
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEdit(r)}>
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Rezept löschen"
                  onClick={async () => {
                    if (await confirmDialog({ title: 'Rezept löschen?', text: 'Bereits gebuchte Mahlzeiten bleiben erhalten.', danger: true, confirmLabel: 'Löschen' })) deleteRecipe(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {edit && <RecipeEditor initial={edit} onClose={() => setEdit(null)} />}
      {log && <LogRecipe recipe={log} onClose={() => setLog(null)} />}
    </div>
  );
}

function LogRecipe({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const meals = useMeals();
  const { date } = useUi();
  const [d, setD] = useState(date);
  const [meal, setMeal] = useState('lunch');
  const [servings, setServings] = useState<number | undefined>(1);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${recipe.name} buchen`}
      footer={
        <Button
          className="flex-1"
          onClick={async () => {
            try {
              await logRecipe(d, meal, recipe, servings ?? 0);
              toast('Rezept ins Tagebuch übernommen', 'success');
              onClose();
            } catch (e) {
              toast(firstError(e), 'error');
            }
          }}
        >
          Buchen
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Datum">{(id) => <Input id={id} type="date" value={d} onChange={(e) => setD(e.target.value)} />}</Field>
        <Field label="Mahlzeit">
          {(id) => (
            <Select id={id} value={meal} onChange={(e) => setMeal(e.target.value)}>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Portionen">{(id) => <NumberInput id={id} value={servings} onValue={setServings} />}</Field>
      </div>
    </Sheet>
  );
}

function RecipeEditor({ initial, onClose }: { initial: Partial<Recipe>; onClose: () => void }) {
  const [r, setR] = useState<Partial<Recipe>>(structuredClone(initial));
  const [q, setQ] = useState('');
  const [online, setOnline] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const local = useLiveQuery(() => searchLocalFoods(q, 8), [q]) ?? [];
  const ingredients = useMemo(() => r.ingredients ?? [], [r.ingredients]);
  const n = useMemo(() => {
    try {
      return ingredients.length && (r.servings ?? 0) > 0 ? recipeNutrition({ ingredients, servings: r.servings! }) : null;
    } catch {
      return null;
    }
  }, [ingredients, r.servings]);

  const addIng = async (f: FoodItem) => {
    const saved = f.source === 'custom' ? f : await upsertFood(f);
    const ing: RecipeIngredient = { foodId: saved.id, name: saved.name, grams: 100, per100: { ...saved.per100 } };
    setR((s) => ({ ...s, ingredients: [...(s.ingredients ?? []), ing] }));
    setQ('');
    setOnline([]);
  };
  const searchOnline = async () => {
    setSearching(true);
    try {
      setOnline(await openFoodFacts.search(q));
    } catch (e) {
      toast(firstError(e), 'error');
    } finally {
      setSearching(false);
    }
  };
  const onImage = (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast('Bild ist zu groß (max. 3 MB).', 'error');
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const c = document.createElement('canvas');
        const scale = Math.min(1, 480 / Math.max(img.width, img.height));
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        setR((s) => ({ ...s, imageDataUrl: c.toDataURL('image/jpeg', 0.8) }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  const save = async () => {
    try {
      await saveRecipe({ id: r.id, name: r.name ?? '', category: r.category ?? 'Sonstiges', servings: r.servings ?? 0, instructions: r.instructions ?? '', ingredients, imageDataUrl: r.imageDataUrl });
      toast('Rezept gespeichert', 'success');
      onClose();
    } catch (e) {
      toast(firstError(e), 'error');
    }
  };
  return (
    <Sheet open onClose={onClose} title={r.id ? 'Rezept bearbeiten' : 'Neues Rezept'} wide footer={<Button className="flex-1" onClick={save}>Rezept speichern</Button>}>
      <div className="space-y-3">
        <Field label="Name">{(id) => <Input id={id} value={r.name ?? ''} onChange={(e) => setR((s) => ({ ...s, name: e.target.value }))} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategorie">
            {(id) => (
              <Select id={id} value={r.category} onChange={(e) => setR((s) => ({ ...s, category: e.target.value }))}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Portionen">{(id) => <NumberInput id={id} value={r.servings} onValue={(v) => setR((s) => ({ ...s, servings: v }))} />}</Field>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-muted">Zutaten</div>
          <ul className="divide-y rounded-xl border">
            {ingredients.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2 p-2">
                <div className="min-w-0 flex-1 truncate text-sm">{i.name}</div>
                <NumberInput
                  aria-label={`Menge ${i.name} (g)`}
                  className="h-9 w-24"
                  value={i.grams}
                  onValue={(v) => setR((s) => ({ ...s, ingredients: s.ingredients!.map((x, j) => (j === idx ? { ...x, grams: v ?? 0 } : x)) }))}
                />
                <span className="text-xs text-muted">g</span>
                <Button variant="ghost" size="icon" aria-label={`${i.name} entfernen`} onClick={() => setR((s) => ({ ...s, ingredients: s.ingredients!.filter((_, j) => j !== idx) }))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {!ingredients.length && <li className="p-3 text-sm text-muted">Noch keine Zutaten.</li>}
          </ul>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
          <Input aria-label="Zutat suchen" className="pl-10" placeholder="Zutat suchen (lokal) …" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {q && (
          <ul className="divide-y rounded-xl border">
            {local.map((f) => (
              <li key={f.id}>
                <button className="w-full p-2 text-left text-sm" onClick={() => addIng(f)}>
                  {f.name} <span className="text-xs text-muted">{fmt(f.per100.kcal)} kcal/100 {f.unitBase}</span>
                </button>
              </li>
            ))}
            {online.map((f) => (
              <li key={f.id}>
                <button className="w-full p-2 text-left text-sm" onClick={() => addIng(f)}>
                  {f.name} <span className="text-xs text-muted">· Open Food Facts · {fmt(f.per100.kcal)} kcal</span>
                </button>
              </li>
            ))}
            <li className="p-2">
              <Button size="sm" variant="secondary" disabled={q.trim().length < 3 || searching} onClick={searchOnline}>
                {searching ? 'Suche …' : 'Online bei Open Food Facts suchen'}
              </Button>
            </li>
          </ul>
        )}
        {n && (
          <div className="grid gap-3 sm:grid-cols-2" data-testid="recipe-nutrition">
            <NutrientTable n={n.total} title={`Gesamt (${fmt(n.totalGrams)} g)`} />
            <NutrientTable n={n.perServing} title="Pro Portion" />
          </div>
        )}
        <Field label="Zubereitung">{(id) => <Textarea id={id} value={r.instructions ?? ''} onChange={(e) => setR((s) => ({ ...s, instructions: e.target.value }))} />}</Field>
        <Field label="Bild (optional)">{(id) => <input id={id} type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0])} className="text-sm" />}</Field>
        <p className="text-xs text-muted">Änderungen am Rezept wirken nur auf künftige Buchungen – bereits gebuchte Mahlzeiten behalten ihre Nährwerte.</p>
      </div>
    </Sheet>
  );
}
