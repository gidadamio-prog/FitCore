import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { Barcode, Heart, Search, Star, AlertTriangle, ExternalLink, Check, ChefHat, Bookmark, Plus, Zap, X, ChevronLeft } from 'lucide-react';
import { Badge, Button, Field, Input, NumberInput, Select, Sheet, Tabs, cn, fmt } from '@/components/ui';
import { baseState, per100For, prepHint, prepProfile } from '@/domain/preparation';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { db } from '@/data/db';
import type { DiaryEntry, FoodItem, MealId, Nutrients, Recipe } from '@/domain/types';
import { addEntry, createCustomFood, lastEntriesByFood, logRecipe, logSavedMeal, quickAdd, repeatEntry, searchLocalFoods, toggleFavorite, upsertFood, type CustomFoodInput } from '@/data/nutritionRepo';
import { lookupBarcode, openFoodFacts, usdaFoodData, ProviderError, dedupe, offEditUrl } from '@/data/foodProviders';
import { checkKcal, completeness, recipeNutrition, scaleNutrients, NUTRIENT_LABELS, type NutrientKey } from '@/domain/nutrition';
import { firstError, fieldErrors } from '@/domain/schemas';
import { z } from 'zod';
import { toast } from '@/stores/ui';
import { RecipeAmount, type RecipeAmountValue } from './Recipes';
import { useMeals, useSettings } from '@/hooks/data';

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

type View = 'browse' | 'scan' | 'recipes' | 'saved' | 'custom' | 'quick';
type Suggest = 'recent' | 'frequent' | 'favorites';
interface Added {
  label: string;
  kcal: number | null | undefined;
}

export function AddFoodSheet({ open, onClose, date, meal: initialMeal }: { open: boolean; onClose: () => void; date: string; meal: MealId }) {
  const [view, setView] = useState<View>('browse');
  const [meal, setMeal] = useState(initialMeal);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [added, setAdded] = useState<Added[]>([]);
  const meals = useMeals();
  useEffect(() => setMeal(initialMeal), [initialMeal, open]);
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setView('browse');
      setNotFound(null);
      setQ('');
      setAdded([]);
    }
  }, [open]);
  const mealLabel = meals.find((m) => m.id === meal)?.label ?? 'Mahlzeit';

  const onAdded = (a: Added) => {
    setAdded((l) => [...l, a]);
    setSelected(null);
    setNotFound(null);
    setView('browse');
    setQ('');
  };

  const onBarcode = async (code: string) => {
    setView('browse');
    try {
      const r = await lookupBarcode(code);
      if (r.food) {
        if (r.origin === 'off') await upsertFood(r.food);
        setSelected(r.food);
      } else {
        setNotFound(code);
        setView('custom');
      }
    } catch (e) {
      toast(firstError(e) + (e instanceof ProviderError && e.kind === 'network' ? ' Du kannst das Produkt selbst anlegen.' : ''), 'error');
      setNotFound(code);
      setView('custom');
    }
  };

  const titles: Record<View, string> = { browse: 'Lebensmittel hinzufügen', scan: 'Barcode scannen', recipes: 'Rezept buchen', saved: 'Gespeicherte Mahlzeit', custom: 'Eigenes Lebensmittel', quick: 'Schnell buchen' };
  const back = (
    <button type="button" className="flex items-center gap-1 text-sm text-muted" onClick={() => setView('browse')}>
      <ChevronLeft className="h-4 w-4" /> Zur Suche
    </button>
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={selected ? 'Menge wählen' : titles[view]}
      wide
      full
      headerExtra={
        added.length > 0 ? (
          <Button size="sm" onClick={onClose} data-testid="add-done">
            <Check className="h-4 w-4" /> Fertig
          </Button>
        ) : undefined
      }
    >
      {selected ? (
        <FoodAmount key={selected.id} food={selected} date={date} meal={meal} setMeal={setMeal} onBack={() => setSelected(null)} onDone={onAdded} onReplace={setSelected} />
      ) : view === 'scan' ? (
        <div className="space-y-3">
          {back}
          <BarcodeScanner onCode={onBarcode} />
        </div>
      ) : view !== 'browse' ? (
        <div className="space-y-3">
          {back}
          {view === 'recipes' && <RecipePick date={date} meal={meal} onDone={onAdded} />}
          {view === 'saved' && <SavedPick date={date} meal={meal} onDone={onAdded} />}
          {view === 'custom' && <CustomFoodForm barcode={notFound ?? undefined} onSaved={(f) => setSelected(f)} />}
          {view === 'quick' && <QuickAddForm date={date} meal={meal} onDone={onAdded} />}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="sticky -top-4 z-10 -mx-4 -mt-4 space-y-2 border-b bg-card px-4 pb-3 pt-3">
            <MealChips meals={meals} meal={meal} setMeal={setMeal} />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" />
                <Input
                  aria-label="Lebensmittel suchen"
                  placeholder="Suchen: z. B. Reis, Skyr, Marke …"
                  className="pl-10 pr-9"
                  type="text"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button type="button" aria-label="Suche leeren" className="absolute right-2 top-2.5 rounded-full p-1 text-muted" onClick={() => setQ('')}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" size="icon" onClick={() => setView('scan')} aria-label="Barcode scannen">
                <Barcode className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {added.length > 0 && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-2.5 text-sm" data-testid="added-list">
              <div className="flex items-center gap-1.5 font-medium">
                <Check className="h-4 w-4 text-accent" /> {added.length} zu {mealLabel} hinzugefügt · {fmt(added.reduce((a, x) => a + (x.kcal ?? 0), 0))} kcal
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-muted">{added.map((a) => a.label).join(' · ')}</div>
            </div>
          )}
          {q.trim() ? <SearchResults q={q} onPick={setSelected} /> : <Suggestions date={date} meal={meal} onPick={setSelected} onAdded={onAdded} />}
          {!q.trim() && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <MoreButton icon={<ChefHat className="h-4 w-4" />} label="Rezept" onClick={() => setView('recipes')} />
              <MoreButton icon={<Bookmark className="h-4 w-4" />} label="Gespeicherte Mahlzeit" onClick={() => setView('saved')} />
              <MoreButton icon={<Plus className="h-4 w-4" />} label="Eigenes anlegen" onClick={() => setView('custom')} />
              <MoreButton icon={<Zap className="h-4 w-4" />} label="Schnell buchen" onClick={() => setView('quick')} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function MoreButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium hover:bg-fg/[0.04]">
      <span className="text-muted">{icon}</span> {label}
    </button>
  );
}

function MealChips({ meals, meal, setMeal }: { meals: { id: string; label: string }[]; meal: MealId; setMeal: (m: MealId) => void }) {
  return (
    <div role="group" aria-label="Mahlzeit" className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
      {meals.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={m.id === meal}
          onClick={() => setMeal(m.id)}
          className={cn('h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition', m.id === meal ? 'border-accent bg-accent text-accent-fg' : 'text-muted hover:text-fg')}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

const entryAmountText = (e: DiaryEntry) => (e.unit === 'serving' ? `${fmt(e.amount, 2)} × ${e.servingLabel ?? 'Portion'}` : `${fmt(e.amount, 1)} ${e.unit}`) + (e.prep ? ` ${e.prep}` : '');

function Suggestions({ date, meal, onPick, onAdded }: { date: string; meal: MealId; onPick: (f: FoodItem) => void; onAdded: (a: Added) => void }) {
  const [kind, setKind] = useState<Suggest>('recent');
  const last = useLiveQuery(() => lastEntriesByFood(), []);
  return (
    <div className="space-y-2">
      <Tabs
        value={kind}
        onChange={setKind}
        items={[
          { value: 'recent', label: 'Zuletzt' },
          { value: 'frequent', label: 'Häufig' },
          { value: 'favorites', label: 'Favoriten' },
        ]}
      />
      <LocalList
        kind={kind}
        onPick={onPick}
        right={(f) => {
          const e = last?.get(f.id);
          if (!e) return f.favorite ? <Heart className="h-4 w-4 fill-current text-danger" /> : undefined;
          return (
            <Button
              size="sm"
              variant="secondary"
              className="shrink-0"
              aria-label={`${f.name}: wie zuletzt (${entryAmountText(e)}) hinzufügen`}
              onClick={async () => {
                const c = await repeatEntry(e, date, meal);
                onAdded({ label: `${f.name} ${entryAmountText(e)}`, kcal: c.nutrients.kcal });
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {entryAmountText(e)}
            </Button>
          );
        }}
      />
    </div>
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
  const label = { off: 'Open Food Facts', usda: 'USDA', custom: 'Eigenes', basic: 'Grundnahrungsmittel', recipe: 'Rezept', quick: 'Schnell' }[source];
  return <Badge tone={source === 'off' || source === 'usda' ? 'info' : 'neutral'}>{label}</Badge>;
}

export function SearchResults({ q, onPick }: { q: string; onPick: (f: FoodItem) => void }) {
  const dq = useDebounced(q.trim(), 700);
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
      {local.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Gespeichert & Grundnahrungsmittel</h3>
          <ul className="divide-y" data-testid="local-results">
            {local.map((f) => (
              <FoodRow key={f.id} f={f} onPick={() => pick(f)} />
            ))}
          </ul>
        </section>
      )}
      {!online && local.length === 0 && <p className="py-4 text-center text-sm text-muted">Nichts gefunden. Online-Suche ist in den Einstellungen deaktiviert – du kannst das Lebensmittel selbst anlegen.</p>}
      {online && q.trim().length > 0 && q.trim().length < 3 && <p className="text-xs text-muted">Online-Suche ab 3 Zeichen.</p>}
      {online && dq.length >= 3 && (
        <section>
          <h3 className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">Online {(off.isFetching || usda.isFetching) && <span className="normal-case text-muted">lädt …</span>}</h3>
          {off.error && <ErrorNote e={off.error} label="Open Food Facts" />}
          {usda.error && <ErrorNote e={usda.error} label="USDA" />}
          <ul className="divide-y" data-testid="online-results">
            {remote.map((f) => (
              <FoodRow key={f.id} f={f} onPick={() => pick(f)} />
            ))}
          </ul>
          {!off.isFetching && !off.error && remote.length === 0 && <p className="py-4 text-center text-sm text-muted">Keine Online-Treffer.</p>}
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

function LocalList({ kind, onPick, right }: { kind: Suggest; onPick: (f: FoodItem) => void; right?: (f: FoodItem) => React.ReactNode }) {
  const list =
    useLiveQuery(async () => {
      if (kind === 'favorites') return db.foods.where('favorite').equals(1).sortBy('name');
      if (kind === 'recent') return (await db.foods.orderBy('lastUsedAt').reverse().limit(30).toArray()).filter((f) => f.lastUsedAt);
      return (await db.foods.orderBy('useCount').reverse().limit(30).toArray()).filter((f) => f.useCount > 0);
    }, [kind]) ?? [];
  if (!list.length) return <p className="py-6 text-center text-sm text-muted">{kind === 'favorites' ? 'Noch keine Favoriten – tippe beim Hinzufügen auf das Herz.' : 'Noch nichts gebucht. Such oben nach einem Lebensmittel – z. B. „Reis“.'}</p>;
  return (
    <ul className="divide-y" data-testid="suggest-list">
      {list.map((f) => (
        <FoodRow key={f.id} f={f} onPick={() => onPick(f)} right={right?.(f)} />
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

const G_CHIPS = [50, 100, 150, 200, 250, 300];
const SERVING_CHIPS = [0.5, 1, 2, 3];

function FoodAmount({ food, date, meal, setMeal, onBack, onDone, onReplace }: { food: FoodItem; date: string; meal: MealId; setMeal: (m: MealId) => void; onBack: () => void; onDone: (a: Added) => void; onReplace: (f: FoodItem) => void }) {
  const meals = useMeals();
  const [completing, setCompleting] = useState(false);
  const incomplete = completeness(food.per100) !== 'complete';
  const fresh = useLiveQuery(() => db.foods.get(food.id), [food.id]) ?? food;
  const profile = prepProfile(food);
  const base = profile ? baseState(profile, food) : undefined;
  const lastPrep = useLiveQuery(async () => {
    if (!profile) return null;
    const es = await db.diary.where('foodId').equals(food.id).toArray();
    es.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return profile.states.find((s) => s.label === es[0]?.prep)?.id ?? null;
  }, [food.id]);
  const [prepId, setPrepId] = useState<string | undefined>(undefined);
  const weighed = profile?.states.find((s) => s.id === (prepId ?? lastPrep ?? base?.id)) ?? base;
  const per100 = profile && base && weighed ? per100For(food.per100, base, weighed) : food.per100;
  const [unit, setUnit] = useState<string>(food.servings[0] && !profile ? 'serving:0' : food.unitBase);
  const [amount, setAmount] = useState<number | undefined>(food.servings[0] && !profile ? 1 : 100);
  const [err, setErr] = useState<string>();
  const serving = unit.startsWith('serving:') ? food.servings[Number(unit.split(':')[1])] : undefined;
  const grams = amount && amount > 0 ? (serving ? amount * serving.grams : amount) : 0;
  let preview: Nutrients | null = null;
  try {
    preview = grams > 0 ? scaleNutrients(per100, grams) : null;
  } catch {
    preview = null;
  }
  const kc = checkKcal(food.per100);
  const add = async () => {
    try {
      const e = await addEntry({
        date,
        meal,
        food: fresh,
        amount: amount ?? 0,
        unit: serving ? 'serving' : food.unitBase,
        servingLabel: serving?.label,
        servingGrams: serving?.grams,
        prep: profile && weighed ? { label: weighed.label, per100 } : undefined,
      });
      onDone({ label: `${food.name} ${entryAmountText(e)}`, kcal: e.nutrients.kcal });
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
  const chips = serving ? SERVING_CHIPS : G_CHIPS;
  return (
    <div className="flex min-h-full flex-col gap-4">
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
        {food.imageUrl && <img src={food.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{food.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
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
      {profile && base && weighed && (
        <div className="space-y-1.5" data-testid="prep">
          <div className="text-sm font-medium">Gewogen als</div>
          <div role="group" aria-label="Zubereitung" className="flex gap-1.5">
            {profile.states.map((st) => (
              <button
                key={st.id}
                type="button"
                aria-pressed={st.id === weighed.id}
                onClick={() => setPrepId(st.id)}
                className={cn('h-9 flex-1 rounded-lg border text-sm font-medium transition', st.id === weighed.id ? 'border-accent bg-accent/15 text-fg' : 'text-muted')}
              >
                {st.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted" data-testid="prep-hint">
            {prepHint(profile, base, weighed)} {weighed.id !== base.id && `Bezugswerte ${base.label}: ${fmt(food.per100.kcal)} kcal → ${weighed.label}: ${fmt(per100.kcal)} kcal pro 100 g.`}
          </p>
        </div>
      )}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Menge" error={err}>{(id) => <NumberInput id={id} value={amount} onValue={setAmount} className="text-lg font-semibold" />}</Field>
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
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Schnellauswahl">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => setAmount(c)} className={cn('h-8 rounded-full border px-3 text-xs font-medium', amount === c ? 'border-accent bg-accent/15' : 'text-muted')}>
              {serving ? `${fmt(c, 1)} ×` : `${c} ${food.unitBase}`}
            </button>
          ))}
        </div>
      </div>
      <MealChips meals={meals} meal={meal} setMeal={setMeal} />
      {preview && <NutrientTable n={preview} title={`Für ${fmt(grams, 1)} ${food.unitBase}${weighed && profile ? ` (${weighed.label})` : ''}`} />}
      {kc.diffPct != null && !kc.plausible && (
        <p className="text-xs text-warn">
          Hinweis: Etikett-kcal ({fmt(kc.label)}) und aus Makros berechnete kcal ({fmt(kc.computed)}) weichen um {kc.diffPct} % ab (z. B. durch Ballaststoffe, Alkohol oder Rundung). Gebucht wird der Etikettwert.
        </p>
      )}
      {food.license && <p className="text-[11px] text-muted">{food.license}</p>}
      <div className="sticky -bottom-4 -mx-4 mt-auto flex gap-2 border-t bg-card px-4 pb-4 pt-3">
        <Button variant="secondary" onClick={onBack}>
          Zurück
        </Button>
        <Button className="flex-1" onClick={add} disabled={!preview}>
          Hinzufügen{preview?.kcal != null ? ` · ${fmt(preview.kcal)} kcal` : ''}
        </Button>
      </div>
    </div>
  );
}

function RecipePick({ date, meal, onDone }: { date: string; meal: MealId; onDone: (a: Added) => void }) {
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []) ?? [];
  const [sel, setSel] = useState<Recipe | null>(null);
  const [amount, setAmount] = useState<RecipeAmountValue>({ mode: 'portion', value: 1 });
  if (!recipes.length) return <p className="py-6 text-center text-sm text-muted">Noch keine Rezepte. Lege sie im Tab „Rezepte“ an.</p>;
  if (sel) {
    const n = recipeNutrition(sel);
    const grams = amount.mode === 'gramm' ? amount.value ?? 0 : (n.dishGrams / sel.servings) * (amount.value ?? 0);
    return (
      <div className="space-y-3">
        <div className="font-semibold">{sel.name}</div>
        <RecipeAmount recipe={sel} value={amount} onChange={setAmount} />
        {grams > 0 && <NutrientTable n={scaleNutrients(n.per100, grams)} title={amount.mode === 'gramm' ? `${fmt(grams)} g` : `${fmt(amount.value ?? 0, 1)} Portion(en)`} />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setSel(null)}>
            Zurück
          </Button>
          <Button
            className="flex-1"
            onClick={async () => {
              try {
                await logRecipe(date, meal, sel, amount.value ?? 0, amount.mode);
                onDone({ label: `${sel.name} ${amount.mode === 'gramm' ? `${fmt(amount.value ?? 0)} g` : `${fmt(amount.value ?? 0, 1)} Port.`}`, kcal: ((n.per100.kcal ?? 0) * grams) / 100 });
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

function SavedPick({ date, meal, onDone }: { date: string; meal: MealId; onDone: (a: Added) => void }) {
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
            <Button size="sm" onClick={async () => { await logSavedMeal(s, date, meal); onDone({ label: s.name, kcal: s.items.reduce((a, i) => a + (i.nutrients.kcal ?? 0), 0) }); }}>
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

function QuickAddForm({ date, meal, onDone }: { date: string; meal: MealId; onDone: (a: Added) => void }) {
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
            onDone({ label: name || 'Schnellbuchung', kcal: n.kcal });
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
