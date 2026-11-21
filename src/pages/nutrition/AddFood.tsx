import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { Barcode, Heart, Search, Star, AlertTriangle, ExternalLink } from 'lucide-react';
import { Badge, Button, Field, Input, NumberInput, Select, Sheet, Tabs, cn, fmt } from '@/components/ui';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { db } from '@/data/db';
import type { FoodItem, MealId, Nutrients, Recipe } from '@/domain/types';
import { addEntry, createCustomFood, logRecipe, logSavedMeal, quickAdd, searchLocalFoods, toggleFavorite, upsertFood, type CustomFoodInput } from '@/data/nutritionRepo';
import { lookupBarcode, openFoodFacts, usdaFoodData, ProviderError, dedupe, offEditUrl } from '@/data/foodProviders';
import { checkKcal, completeness, recipeNutrition, scaleNutrients, NUTRIENT_LABELS, type NutrientKey } from '@/domain/nutrition';
import { firstError, fieldErrors } from '@/domain/schemas';
import { z } from 'zod';
import { toast } from '@/stores/ui';
import { useMeals, useSettings } from '@/hooks/data';

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

type Tab = 'search' | 'favorites' | 'recent' | 'frequent' | 'recipes' | 'saved' | 'custom' | 'quick';

export function AddFoodSheet({ open, onClose, date, meal: initialMeal }: { open: boolean; onClose: () => void; date: string; meal: MealId }) {
  const [tab, setTab] = useState<Tab>('search');
  const [meal, setMeal] = useState(initialMeal);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [scan, setScan] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const meals = useMeals();
  useEffect(() => setMeal(initialMeal), [initialMeal, open]);
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setScan(false);
      setNotFound(null);
    }
  }, [open]);

  const onBarcode = async (code: string) => {
    setScan(false);
    try {
      const r = await lookupBarcode(code);
      if (r.food) {
        if (r.origin === 'off') await upsertFood(r.food);
        setSelected(r.food);
      } else {
        setNotFound(code);
        setTab('custom');
      }
    } catch (e) {
      toast(firstError(e) + (e instanceof ProviderError && e.kind === 'network' ? ' Du kannst das Produkt selbst anlegen.' : ''), 'error');
      setNotFound(code);
      setTab('custom');
    }
  };

  const title = selected ? 'Menge wählen' : scan ? 'Barcode scannen' : 'Lebensmittel hinzufügen';
  return (
    <Sheet open={open} onClose={onClose} title={title} wide>
      {selected ? (
        <FoodAmount key={selected.id} food={selected} date={date} meal={meal} setMeal={setMeal} onBack={() => setSelected(null)} onDone={onClose} onReplace={setSelected} />
      ) : scan ? (
        <BarcodeScanner onCode={onBarcode} />
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select aria-label="Mahlzeit" value={meal} onChange={(e) => setMeal(e.target.value)} className="flex-1">
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => setScan(true)} aria-label="Barcode scannen">
              <Barcode className="h-5 w-5" /> Scan
            </Button>
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'search', label: 'Suche' },
              { value: 'favorites', label: 'Favoriten' },
              { value: 'recent', label: 'Zuletzt' },
              { value: 'frequent', label: 'Häufig' },
              { value: 'recipes', label: 'Rezepte' },
              { value: 'saved', label: 'Mahlzeiten' },
              { value: 'custom', label: 'Eigenes' },
              { value: 'quick', label: 'Schnell' },
            ]}
          />
          {tab === 'search' && <SearchTab onPick={setSelected} />}
          {tab === 'favorites' && <LocalList kind="favorites" onPick={setSelected} />}
          {tab === 'recent' && <LocalList kind="recent" onPick={setSelected} />}
          {tab === 'frequent' && <LocalList kind="frequent" onPick={setSelected} />}
          {tab === 'recipes' && <RecipePick date={date} meal={meal} onDone={onClose} />}
          {tab === 'saved' && <SavedPick date={date} meal={meal} onDone={onClose} />}
          {tab === 'custom' && <CustomFoodForm barcode={notFound ?? undefined} onSaved={(f) => setSelected(f)} />}
          {tab === 'quick' && <QuickAddForm date={date} meal={meal} onDone={onClose} />}
        </div>
      )}
    </Sheet>
  );
}

export function FoodRow({ f, onPick, right }: { f: FoodItem; onPick: () => void; right?: React.ReactNode }) {
  const comp = completeness(f.per100);
  return (
    <li className="flex items-center gap-3 py-2">
      {f.imageUrl ? <img src={f.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-fg/5 object-cover" loading="lazy" /> : <div className="h-10 w-10 shrink-0 rounded-lg bg-fg/5" />}
      <button className="min-w-0 flex-1 text-left" onClick={onPick}>
        <div className="truncate text-sm font-medium">{f.name}</div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {f.brand && <span className="truncate">{f.brand} ·</span>}
          <span>{f.per100.kcal != null ? `${fmt(f.per100.kcal)} kcal` : 'kcal unbekannt'} /100 {f.unitBase}</span>
          <SourceBadge source={f.source} />
          {comp !== 'complete' && <Badge tone="warn">unvollständig</Badge>}
        </div>
      </button>
      {right}
    </li>
  );
}

export function SourceBadge({ source }: { source: FoodItem['source'] | 'recipe' | 'quick' }) {
  const label = { off: 'Open Food Facts', usda: 'USDA', custom: 'Eigenes', recipe: 'Rezept', quick: 'Schnell' }[source];
  return <Badge tone={source === 'off' || source === 'usda' ? 'info' : 'neutral'}>{label}</Badge>;
}

function SearchTab({ onPick }: { onPick: (f: FoodItem) => void }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 800);
  const settings = useSettings();
  const localRaw = useLiveQuery(() => searchLocalFoods(q), [q]);
  const local = useMemo(() => localRaw ?? [], [localRaw]);
  const online = settings.externalSearchConsent;
  const off = useQuery({ queryKey: ['off', dq.toLowerCase()], queryFn: ({ signal }) => openFoodFacts.search(dq, signal), enabled: online && dq.length >= 3, retry: false });
  const usda = useQuery({ queryKey: ['usda', dq.toLowerCase()], queryFn: ({ signal }) => usdaFoodData.search(dq, signal), enabled: online && dq.length >= 3 && usdaFoodData.isConfigured(), retry: false });
  const remote = useMemo(() => dedupe([...(off.data ?? []), ...(usda.data ?? [])]).filter((r) => !local.some((l) => l.id === r.id)), [off.data, usda.data, local]);
  const pick = async (f: FoodItem) => {
    const saved = f.source === 'custom' ? f : await upsertFood(f);
    onPick(saved);
  };
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
        <Input aria-label="Lebensmittel suchen" placeholder="Lebensmittel oder Marke suchen …" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {local.length > 0 && (
        <section>
          <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Auf diesem Gerät</h3>
          <ul className="divide-y">
            {local.map((f) => (
              <FoodRow key={f.id} f={f} onPick={() => pick(f)} />
            ))}
          </ul>
        </section>
      )}
      {!online && <p className="text-xs text-muted">Online-Suche ist in den Einstellungen deaktiviert.</p>}
      {online && q.trim().length > 0 && q.trim().length < 3 && <p className="text-xs text-muted">Online-Suche ab 3 Zeichen.</p>}
      {online && dq.length >= 3 && (
        <section>
          <h3 className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">Online {(off.isFetching || usda.isFetching) && <span className="normal-case text-muted">lädt …</span>}</h3>
          {off.error && <ErrorNote e={off.error} label="Open Food Facts" />}
          {usda.error && <ErrorNote e={usda.error} label="USDA" />}
          {!usdaFoodData.isConfigured() && <p className="text-xs text-muted">USDA FoodData Central: API-Schlüssel in den Einstellungen hinterlegen, um Grundnahrungsmittel zu ergänzen.</p>}
          <ul className="divide-y" data-testid="online-results">
            {remote.map((f) => (
              <FoodRow key={f.id} f={f} onPick={() => pick(f)} />
            ))}
          </ul>
          {!off.isFetching && !off.error && remote.length === 0 && <p className="py-4 text-center text-sm text-muted">Keine Online-Treffer. Du kannst das Lebensmittel unter „Eigenes“ anlegen.</p>}
          <p className="mt-2 text-[11px] text-muted">{openFoodFacts.attribution}</p>
        </section>
      )}
    </div>
  );
}

function ErrorNote({ e, label }: { e: unknown; label: string }) {
  return (
    <p role="alert" className="flex items-center gap-1 rounded-lg bg-warn/10 p-2 text-xs text-warn">
      <AlertTriangle className="h-3.5 w-3.5" /> {label}: {firstError(e)}
    </p>
  );
}

function LocalList({ kind, onPick }: { kind: 'favorites' | 'recent' | 'frequent'; onPick: (f: FoodItem) => void }) {
  const list =
    useLiveQuery(async () => {
      if (kind === 'favorites') return db.foods.where('favorite').equals(1).sortBy('name');
      if (kind === 'recent') return (await db.foods.orderBy('lastUsedAt').reverse().limit(30).toArray()).filter((f) => f.lastUsedAt);
      return (await db.foods.orderBy('useCount').reverse().limit(30).toArray()).filter((f) => f.useCount > 0);
    }, [kind]) ?? [];
  if (!list.length) return <p className="py-6 text-center text-sm text-muted">{kind === 'favorites' ? 'Noch keine Favoriten – tippe beim Hinzufügen auf das Herz.' : 'Noch keine Einträge.'}</p>;
  return (
    <ul className="divide-y">
      {list.map((f) => (
        <FoodRow key={f.id} f={f} onPick={() => onPick(f)} right={f.favorite ? <Heart className="h-4 w-4 fill-current text-danger" /> : undefined} />
      ))}
    </ul>
  );
}

export function NutrientTable({ n, title }: { n: Nutrients; title?: string }) {
  const keys: NutrientKey[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'salt', 'satFat'];
  return (
    <table className="w-full text-sm">
      {title && <caption className="mb-1 text-left text-xs text-muted">{title}</caption>}
      <tbody>
        {keys
          .filter((k) => n[k] !== undefined)
          .map((k) => (
            <tr key={k} className="border-b last:border-0">
              <td className="py-1.5 text-muted">{NUTRIENT_LABELS[k]}</td>
              <td className="py-1.5 text-right tabular-nums" data-testid={`nut-${k}`}>
                {n[k] == null ? <span className="text-warn">unbekannt</span> : `${fmt(n[k], k === 'salt' ? 2 : 1)} ${k === 'kcal' ? 'kcal' : 'g'}`}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function FoodAmount({ food, date, meal, setMeal, onBack, onDone, onReplace }: { food: FoodItem; date: string; meal: MealId; setMeal: (m: MealId) => void; onBack: () => void; onDone: () => void; onReplace: (f: FoodItem) => void }) {
  const meals = useMeals();
  const [completing, setCompleting] = useState(false);
  const incomplete = completeness(food.per100) !== 'complete';
  const fresh = useLiveQuery(() => db.foods.get(food.id), [food.id]) ?? food;
  const [unit, setUnit] = useState<string>(food.servings[0] ? 'serving:0' : food.unitBase);
  const [amount, setAmount] = useState<number | undefined>(food.servings[0] ? 1 : 100);
  const [err, setErr] = useState<string>();
  const serving = unit.startsWith('serving:') ? food.servings[Number(unit.split(':')[1])] : undefined;
  const grams = amount && amount > 0 ? (serving ? amount * serving.grams : amount) : 0;
  let preview: Nutrients | null = null;
  try {
    preview = grams > 0 ? scaleNutrients(food.per100, grams) : null;
  } catch {
    preview = null;
  }
  const kc = checkKcal(food.per100);
  const add = async () => {
    try {
      await addEntry({ date, meal, food: fresh, amount: amount ?? 0, unit: serving ? 'serving' : food.unitBase, servingLabel: serving?.label, servingGrams: serving?.grams });
      toast(`${food.name} hinzugefügt`, 'success');
      onDone();
    } catch (e) {
      setErr(firstError(e));
    }
  };
  if (completing)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Trag die Werte von der Packung ein (pro 100 g bzw. 100 ml). Das Produkt wird als eigenes Lebensmittel mit diesem Barcode gespeichert und beim nächsten Scan direkt gefunden – auch offline.</p>
        <CustomFoodForm prefill={food} onSaved={(f) => onReplace(f)} />
        <Button variant="secondary" onClick={() => setCompleting(false)}>
          Abbrechen
        </Button>
      </div>
    );
  return (
    <div className="space-y-4">
      {incomplete && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm" data-testid="incomplete-hint">
          <div className="flex items-center gap-2 font-medium text-warn">
            <AlertTriangle className="h-4 w-4" /> {food.per100.kcal == null ? 'Keine Nährwerte hinterlegt' : 'Nährwerte unvollständig'}
          </div>
          <p className="mt-1 text-muted">
            {food.source === 'custom' ? 'Bei diesem eigenen Lebensmittel fehlen Angaben.' : `${food.source === 'off' ? 'Open Food Facts' : 'Die Datenquelle'} kennt das Produkt, aber nicht alle Nährwerte.`} Fehlende Werte werden nicht geschätzt.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCompleting(true)}>
              Nährwerte von der Packung ergänzen
            </Button>
            {food.source === 'off' && food.barcode && (
              <a href={offEditUrl(food.barcode)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 px-2 text-xs text-accent underline">
                Auch bei Open Food Facts ergänzen <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        {food.imageUrl && <img src={food.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{food.name}</div>
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
            {food.brand} <SourceBadge source={food.source} /> {food.barcode && <span>EAN {food.barcode}</span>}
          </div>
          {food.sourceUrl && (
            <a href={food.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent">
              Quelle ansehen <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label={fresh.favorite ? 'Favorit entfernen' : 'Als Favorit speichern'} onClick={() => toggleFavorite(food.id)}>
          <Heart className={cn('h-5 w-5', fresh.favorite && 'fill-current text-danger')} />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Menge" error={err}>{(id) => <NumberInput id={id} value={amount} onValue={setAmount} autoFocus />}</Field>
        <Field label="Einheit">
          {(id) => (
            <Select id={id} value={unit} onChange={(e) => { setUnit(e.target.value); setAmount(e.target.value.startsWith('serving') ? 1 : 100); }}>
              <option value={food.unitBase}>{food.unitBase}</option>
              {food.servings.map((s, i) => (
                <option key={i} value={`serving:${i}`}>
                  {s.label} ({s.grams} {food.unitBase})
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Select aria-label="Mahlzeit" value={meal} onChange={(e) => setMeal(e.target.value)}>
        {meals.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>
      {preview && <NutrientTable n={preview} title={`Für ${fmt(grams, 1)} ${food.unitBase}`} />}
      {kc.diffPct != null && !kc.plausible && (
        <p className="text-xs text-warn">
          Hinweis: Etikett-kcal ({fmt(kc.label)}) und aus Makros berechnete kcal ({fmt(kc.computed)}) weichen um {kc.diffPct} % ab (z. B. durch Ballaststoffe, Alkohol oder Rundung). Gebucht wird der Etikettwert.
        </p>
      )}
      {food.license && <p className="text-[11px] text-muted">{food.license}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          Zurück
        </Button>
        <Button className="flex-1" onClick={add} disabled={!preview}>
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}

function RecipePick({ date, meal, onDone }: { date: string; meal: MealId; onDone: () => void }) {
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []) ?? [];
  const [sel, setSel] = useState<Recipe | null>(null);
  const [servings, setServings] = useState<number | undefined>(1);
  if (!recipes.length) return <p className="py-6 text-center text-sm text-muted">Noch keine Rezepte. Lege sie im Tab „Rezepte“ an.</p>;
  if (sel) {
    const n = recipeNutrition(sel);
    return (
      <div className="space-y-3">
        <div className="font-semibold">{sel.name}</div>
        <Field label={`Portionen (Rezept ergibt ${sel.servings})`}>{(id) => <NumberInput id={id} value={servings} onValue={setServings} />}</Field>
        {servings && servings > 0 && <NutrientTable n={scaleNutrients(n.per100, (n.totalGrams / sel.servings) * servings)} title={`${servings} Portion(en)`} />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSel(null)}>
            Zurück
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              try {
                await logRecipe(date, meal, sel, servings ?? 0);
                toast('Rezept gebucht', 'success');
                onDone();
              } catch (e) {
                toast(firstError(e), 'error');
              }
            }}
          >
            Ins Tagebuch
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {recipes.map((r) => {
        const n = recipeNutrition(r);
        return (
          <li key={r.id}>
            <button className="w-full py-2 text-left" onClick={() => setSel(r)}>
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-xs text-muted">
                {fmt(n.perServing.kcal)} kcal / Portion · {r.servings} Portionen
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SavedPick({ date, meal, onDone }: { date: string; meal: MealId; onDone: () => void }) {
  const saved = useLiveQuery(() => db.savedMeals.orderBy('name').toArray(), []) ?? [];
  if (!saved.length) return <p className="py-6 text-center text-sm text-muted">Noch keine gespeicherten Mahlzeiten. Speichere eine Mahlzeit über ihr Menü im Tagebuch.</p>;
  return (
    <ul className="divide-y">
      {saved.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{s.name}</div>
            <div className="text-xs text-muted">
              {s.items.length} Lebensmittel · {fmt(s.items.reduce((a, i) => a + (i.nutrients.kcal ?? 0), 0))} kcal
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={async () => { await logSavedMeal(s, date, meal); toast('Mahlzeit gebucht', 'success'); onDone(); }}>
              Buchen
            </Button>
            <Button size="sm" variant="ghost" aria-label="Löschen" onClick={() => db.savedMeals.delete(s.id)}>
              ✕
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CustomFoodForm({ barcode, onSaved, initial, prefill }: { barcode?: string; onSaved: (f: FoodItem) => void; initial?: FoodItem; prefill?: FoodItem }) {
  const src = initial ?? prefill;
  const [f, setF] = useState<Partial<CustomFoodInput>>(
    src
      ? { name: src.name, brand: src.brand, barcode: src.barcode, unitBase: src.unitBase, kcal: src.per100.kcal, protein: src.per100.protein, carbs: src.per100.carbs, fat: src.per100.fat, fiber: src.per100.fiber ?? null, sugar: src.per100.sugar ?? null, salt: src.per100.salt ?? null, servingLabel: src.servings[0]?.label, servingGrams: src.servings[0]?.grams }
      : { unitBase: 'g', barcode, kcal: null, protein: null, carbs: null, fat: null },
  );
  const [errs, setErrs] = useState<Record<string, string>>({});
  const n = (k: keyof CustomFoodInput, label: string) => (
    <Field label={label} error={errs[k]}>
      {(id) => <NumberInput id={id} value={f[k] as number | null | undefined} onValue={(v) => setF((s) => ({ ...s, [k]: v ?? (['servingGrams'].includes(k) ? undefined : null) }))} />}
    </Field>
  );
  const save = async () => {
    try {
      const food = await createCustomFood({ ...f, brand: f.brand || undefined, barcode: f.barcode || undefined, servingLabel: f.servingLabel || undefined } as CustomFoodInput, initial?.id);
      toast('Lebensmittel gespeichert', 'success');
      onSaved(food);
    } catch (e) {
      if (e instanceof z.ZodError) setErrs(fieldErrors(e));
      else toast(firstError(e), 'error');
    }
  };
  return (
    <div className="space-y-3">
      {barcode && !src && <p className="rounded-xl bg-warn/10 p-3 text-sm text-warn">Produkt mit Barcode {barcode} wurde nicht gefunden. Lege es hier selbst an – die Werte findest du auf der Verpackung.</p>}
      <Field label="Name" error={errs.name}>{(id) => <Input id={id} value={f.name ?? ''} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marke (optional)">{(id) => <Input id={id} value={f.brand ?? ''} onChange={(e) => setF((s) => ({ ...s, brand: e.target.value }))} />}</Field>
        <Field label="Barcode (optional)" error={errs.barcode}>{(id) => <Input id={id} inputMode="numeric" value={f.barcode ?? ''} onChange={(e) => setF((s) => ({ ...s, barcode: e.target.value.replace(/\D/g, '') }))} />}</Field>
      </div>
      <Field label="Bezugsmenge">
        {(id) => (
          <Select id={id} value={f.unitBase} onChange={(e) => setF((s) => ({ ...s, unitBase: e.target.value as 'g' | 'ml' }))}>
            <option value="g">pro 100 g</option>
            <option value="ml">pro 100 ml</option>
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {n('kcal', 'Kalorien (kcal)')}
        {n('protein', 'Protein (g)')}
        {n('carbs', 'Kohlenhydrate (g)')}
        {n('fat', 'Fett (g)')}
        {n('fiber', 'Ballaststoffe (g, optional)')}
        {n('sugar', 'Zucker (g, optional)')}
        {n('salt', 'Salz (g, optional)')}
      </div>
      <p className="text-xs text-muted">Leere Felder werden als „unbekannt“ gespeichert, nicht als 0.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Portionsname (optional)">{(id) => <Input id={id} value={f.servingLabel ?? ''} onChange={(e) => setF((s) => ({ ...s, servingLabel: e.target.value }))} placeholder="z. B. 1 Riegel" />}</Field>
        {n('servingGrams', 'Portionsgröße (g/ml)')}
      </div>
      <Button className="w-full" onClick={save}>
        {initial ? 'Änderungen speichern' : 'Speichern und auswählen'}
      </Button>
    </div>
  );
}

function QuickAddForm({ date, meal, onDone }: { date: string; meal: MealId; onDone: () => void }) {
  const [name, setName] = useState('');
  const [n, setN] = useState<Nutrients>({ kcal: null, protein: null, carbs: null, fat: null });
  return (
    <div className="space-y-3">
      <Field label="Bezeichnung">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Kantine" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <Field key={k} label={NUTRIENT_LABELS[k] + (k === 'kcal' ? ' (kcal)' : ' (g, optional)')}>
            {(id) => <NumberInput id={id} value={n[k]} onValue={(v) => setN((s) => ({ ...s, [k]: v ?? null }))} />}
          </Field>
        ))}
      </div>
      <Button
        className="w-full"
        onClick={async () => {
          try {
            await quickAdd(date, meal, name, n);
            toast('Schnellbuchung gespeichert', 'success');
            onDone();
          } catch (e) {
            toast(firstError(e), 'error');
          }
        }}
      >
        <Star className="h-4 w-4" /> Schnell buchen
      </Button>
    </div>
  );
}
