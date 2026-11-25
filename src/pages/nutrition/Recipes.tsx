import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BookOpen, Copy, Minus, Plus, Trash2, Search } from "lucide-react";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  NumberInput,
  Select,
  Sheet,
  Textarea,
  cn,
  fmt,
} from "@/components/ui";
import type { FoodItem, Recipe, RecipeIngredient } from "@/domain/types";
import { recipeNutrition } from "@/domain/nutrition";
import {
  deleteRecipe,
  logRecipe,
  saveRecipe,
  upsertFood,
} from "@/data/nutritionRepo";
import { NutrientTable, SearchResults } from "./AddFood";
import { db } from "@/data/db";
import { BASIC_BY_ID } from "@/data/basicFoods";
import { useMeals, useRecipes } from "@/hooks/data";
import { firstError } from "@/domain/schemas";
import { toast, confirmDialog, useUi } from "@/stores/ui";
import { useGame } from "@/hooks/game";
import { COOK_SETS, MAX_RECIPE_USES_PER_DAY, nextCookSet } from "@/domain/armor";

const CATEGORIES = [
  "Frühstück",
  "Hauptgericht",
  "Snack",
  "Dessert",
  "Getränk",
  "Sonstiges",
];

export function Recipes() {
  const recipes = useRecipes();
  const [edit, setEdit] = useState<Partial<Recipe> | null>(null);
  const [log, setLog] = useState<Recipe | null>(null);
  return (
    <div className="space-y-3">
      <Button
        onClick={() =>
          setEdit({
            name: "",
            category: "Hauptgericht",
            servings: 2,
            instructions: "",
            ingredients: [],
          })
        }
      >
        <Plus className="h-4 w-4" /> Neues Rezept
      </Button>
      <KitchenProgress />
      {!recipes.length && (
        <Empty
          icon={<BookOpen className="h-8 w-8" />}
          title="Noch keine Rezepte"
          text="Rezepte berechnen Nährwerte automatisch aus den Zutaten."
        />
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {recipes.map((r) => {
          const n = recipeNutrition(r);
          return (
            <Card key={r.id} data-testid="recipe-card">
              <div className="flex gap-3">
                {r.imageDataUrl && (
                  <img
                    src={r.imageDataUrl}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-muted">
                    {r.category} · {r.servings} Portionen ·{" "}
                    {r.ingredients.length} Zutaten
                  </div>
                  <div className="mt-1 text-sm tabular-nums">
                    {fmt(n.perServing.kcal)} kcal · P{" "}
                    {fmt(n.perServing.protein, 1)} · KH{" "}
                    {fmt(n.perServing.carbs, 1)} · F {fmt(n.perServing.fat, 1)}{" "}
                    <span className="text-xs text-muted">/ Portion</span>
                  </div>
                  {n.unknownIngredients.length > 0 && (
                    <div className="text-xs text-warn">
                      Unvollständige Werte: {n.unknownIngredients.join(", ")}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setLog(r)}>
                  Ins Tagebuch
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEdit(r)}
                >
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Rezept kopieren"
                  onClick={() =>
                    setEdit({
                      ...structuredClone(r),
                      id: undefined,
                      name: `${r.name} (Kopie)`,
                    })
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Rezept löschen"
                  onClick={async () => {
                    if (
                      await confirmDialog({
                        title: "Rezept löschen?",
                        text: "Bereits gebuchte Mahlzeiten bleiben erhalten.",
                        danger: true,
                        confirmLabel: "Löschen",
                      })
                    )
                      deleteRecipe(r.id);
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

function LogRecipe({
  recipe,
  onClose,
}: {
  recipe: Recipe;
  onClose: () => void;
}) {
  const meals = useMeals();
  const { date } = useUi();
  const [d, setD] = useState(date);
  const [meal, setMeal] = useState("lunch");
  const [amount, setAmount] = useState<RecipeAmountValue>({
    mode: "portion",
    value: 1,
  });
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
              await logRecipe(d, meal, recipe, amount.value ?? 0, amount.mode);
              toast("Rezept ins Tagebuch übernommen", "success");
              onClose();
            } catch (e) {
              toast(firstError(e), "error");
            }
          }}
        >
          Buchen
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Datum">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={d}
              onChange={(e) => setD(e.target.value)}
            />
          )}
        </Field>
        <Field label="Mahlzeit">
          {(id) => (
            <Select
              id={id}
              value={meal}
              onChange={(e) => setMeal(e.target.value)}
            >
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="mt-3">
        <RecipeAmount recipe={recipe} value={amount} onChange={setAmount} />
      </div>
    </Sheet>
  );
}

export interface RecipeAmountValue {
  mode: "portion" | "gramm";
  value: number | undefined;
}

/** Menge zum Buchen: Portionen (Stepper) oder Gramm vom fertigen Gericht, mit Vorschau. */
export function RecipeAmount({
  recipe,
  value,
  onChange,
}: {
  recipe: Recipe;
  value: RecipeAmountValue;
  onChange: (v: RecipeAmountValue) => void;
}) {
  const n = recipeNutrition(recipe);
  const grams =
    value.mode === "gramm"
      ? (value.value ?? 0)
      : (n.dishGrams / recipe.servings) * (value.value ?? 0);
  const kcal = n.per100.kcal != null ? (n.per100.kcal * grams) / 100 : null;
  return (
    <div className="space-y-2" data-testid="recipe-amount">
      <div className="flex gap-1" role="tablist" aria-label="Menge in">
        {(["portion", "gramm"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={value.mode === m}
            onClick={() =>
              onChange({
                mode: m,
                value:
                  m === "portion"
                    ? 1
                    : Math.round(n.dishGrams / recipe.servings),
              })
            }
            className={cn(
              "flex-1 rounded-lg py-1.5 text-sm",
              value.mode === m
                ? "bg-accent/15 font-semibold text-accent"
                : "bg-fg/[0.05] text-muted",
            )}
          >
            {m === "portion" ? "Portionen" : "Gramm"}
          </button>
        ))}
      </div>
      {value.mode === "portion" ? (
        <Stepper
          label="Portionen"
          value={value.value ?? 0}
          step={0.5}
          min={0.5}
          onChange={(v) => onChange({ mode: "portion", value: v })}
        />
      ) : (
        <Field
          label="Gramm vom fertigen Gericht"
          hint={
            recipe.cookedGrams
              ? `Gericht wiegt fertig ${fmt(recipe.cookedGrams)} g`
              : `Summe der Zutaten ${fmt(n.totalGrams)} g – trag im Rezept das Fertiggewicht ein, wenn du nach dem Kochen wiegst`
          }
        >
          {(id) => (
            <NumberInput
              id={id}
              inputMode="numeric"
              value={value.value}
              onValue={(v) => onChange({ mode: "gramm", value: v })}
            />
          )}
        </Field>
      )}
      <div className="text-sm text-muted" data-testid="recipe-amount-preview">
        ≈ {fmt(grams)} g ·{" "}
        <span className="font-semibold text-fg">{fmt(kcal)} kcal</span>
      </div>
    </div>
  );
}

/** Große −/+ Knöpfe für Zählmengen (Portionen, Eier …) */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <Button
        variant="secondary"
        size="icon"
        aria-label={`${label} weniger`}
        disabled={value - step < min - 1e-9}
        onClick={() =>
          onChange(Math.max(min, Math.round((value - step) * 100) / 100))
        }
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span
        className="min-w-[3.5rem] text-center text-lg font-semibold tabular-nums"
        data-testid={`stepper-${label}`}
      >
        {fmt(value, 1)}
        {unit && (
          <span className="ml-1 text-xs font-normal text-muted">{unit}</span>
        )}
      </span>
      <Button
        variant="secondary"
        size="icon"
        aria-label={`${label} mehr`}
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Neue Zutat: zählbare Lebensmittel starten mit 1 Stück (bei Eiern Größe M), sonst 100 g. */
export function ingredientFrom(f: FoodItem): RecipeIngredient {
  const pieces = f.servings
    .map((sv, i) => ({ sv, i }))
    .filter((x) => x.sv.piece);
  const def = pieces.find((x) => /\bM$/.test(x.sv.label)) ?? pieces[0];
  if (def)
    return {
      foodId: f.id,
      name: f.name,
      per100: { ...f.per100 },
      servings: f.servings,
      servingIdx: def.i,
      count: 1,
      grams: def.sv.grams,
    };
  return {
    foodId: f.id,
    name: f.name,
    per100: { ...f.per100 },
    servings: f.servings,
    grams: 100,
  };
}

function IngredientRow({
  i,
  onChange,
  onRemove,
}: {
  i: RecipeIngredient;
  onChange: (next: RecipeIngredient) => void;
  onRemove: () => void;
}) {
  const sv = i.servingIdx != null ? i.servings?.[i.servingIdx] : undefined;
  const setUnit = (v: string) => {
    if (v === "g")
      return onChange({ ...i, servingIdx: undefined, count: undefined });
    const idx = Number(v);
    const s = i.servings![idx]!;
    const count = i.count ?? Math.max(1, Math.round(i.grams / s.grams));
    onChange({
      ...i,
      servingIdx: idx,
      count,
      grams: Math.round(count * s.grams * 10) / 10,
    });
  };
  const kcal = i.per100.kcal != null ? (i.per100.kcal * i.grams) / 100 : null;
  return (
    <li className="space-y-2 p-3" data-testid="ingredient">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{i.name}</div>
          <div className="text-xs text-muted tabular-nums">
            {fmt(i.grams)} g · {fmt(kcal)} kcal
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${i.name} entfernen`}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {i.servings && i.servings.length > 0 && (
          <Select
            aria-label={`Einheit ${i.name}`}
            className="h-10 w-auto"
            value={i.servingIdx != null ? String(i.servingIdx) : "g"}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="g">Gramm</option>
            {i.servings.map((s, k) => (
              <option key={k} value={k}>
                {s.label.replace(/^1 /, "")} ({fmt(s.grams)} g)
              </option>
            ))}
          </Select>
        )}
        {sv ? (
          <Stepper
            label={`Anzahl ${i.name}`}
            value={i.count ?? 1}
            step={sv.piece ? 1 : 0.5}
            min={sv.piece ? 1 : 0.5}
            onChange={(c) =>
              onChange({
                ...i,
                count: c,
                grams: Math.round(c * sv.grams * 10) / 10,
              })
            }
          />
        ) : (
          <div className="flex items-center gap-1">
            <NumberInput
              aria-label={`Menge ${i.name} (g)`}
              className="h-10 w-24"
              value={i.grams}
              onValue={(v) => onChange({ ...i, grams: v ?? 0 })}
            />
            <span className="text-xs text-muted">g</span>
          </div>
        )}
      </div>
    </li>
  );
}

function RecipeEditor({
  initial,
  onClose,
}: {
  initial: Partial<Recipe>;
  onClose: () => void;
}) {
  const [r, setR] = useState<Partial<Recipe>>(structuredClone(initial));
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const recentAll =
    useLiveQuery(
      () => db.foods.orderBy("useCount").reverse().limit(16).toArray(),
      [],
    ) ?? [];
  const ingredients = useMemo(() => r.ingredients ?? [], [r.ingredients]);
  const recent = recentAll
    .filter((f) => !ingredients.some((i) => i.foodId === f.id))
    .slice(0, 8);
  const n = useMemo(() => {
    try {
      return ingredients.length && (r.servings ?? 0) > 0
        ? recipeNutrition({
            ingredients,
            servings: r.servings!,
            cookedGrams: r.cookedGrams,
          })
        : null;
    } catch {
      return null;
    }
  }, [ingredients, r.servings, r.cookedGrams]);

  const addIng = async (f: FoodItem) => {
    const saved = f.source === "custom" ? f : await upsertFood(f);
    const ing = ingredientFrom(saved);
    setR((s) => ({ ...s, ingredients: [...(s.ingredients ?? []), ing] }));
    setQ("");
    toast(`${saved.name} hinzugefügt`, "success");
    searchRef.current?.focus();
  };
  const setIng = (idx: number, next: RecipeIngredient) =>
    setR((s) => ({
      ...s,
      ingredients: s.ingredients!.map((x, j) => (j === idx ? next : x)),
    }));
  const onImage = (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024)
      return toast("Bild ist zu groß (max. 3 MB).", "error");
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const c = document.createElement("canvas");
        const scale = Math.min(1, 480 / Math.max(img.width, img.height));
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        setR((s) => ({ ...s, imageDataUrl: c.toDataURL("image/jpeg", 0.8) }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  const save = async () => {
    try {
      await saveRecipe({
        id: r.id,
        name: r.name ?? "",
        category: r.category ?? "Sonstiges",
        servings: r.servings ?? 0,
        instructions: r.instructions ?? "",
        ingredients,
        cookedGrams: r.cookedGrams || undefined,
        imageDataUrl: r.imageDataUrl,
      });
      toast("Rezept gespeichert", "success");
      onClose();
    } catch (e) {
      toast(firstError(e), "error");
    }
  };
  const ps = n?.perServing;
  return (
    <Sheet
      open
      onClose={onClose}
      title={r.id ? "Rezept bearbeiten" : "Neues Rezept"}
      wide
      full
      footer={
        <Button className="flex-1" onClick={save}>
          Rezept speichern
          {ps?.kcal != null ? ` · ${fmt(ps.kcal)} kcal/Portion` : ""}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          {(id) => (
            <Input
              id={id}
              value={r.name ?? ""}
              placeholder="z. B. Eierpfannkuchen"
              onChange={(e) => setR((s) => ({ ...s, name: e.target.value }))}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Kategorie" className="min-w-[9rem] flex-1">
            {(id) => (
              <Select
                id={id}
                value={r.category}
                onChange={(e) =>
                  setR((s) => ({ ...s, category: e.target.value }))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <div>
            <div className="mb-1 text-xs font-medium text-muted">Portionen</div>
            <Stepper
              label="Portionen"
              value={r.servings ?? 1}
              min={1}
              onChange={(v) => setR((s) => ({ ...s, servings: v }))}
            />
          </div>
        </div>

        {/* Live-Bilanz pro Portion */}
        <div
          className="sticky top-0 z-10 rounded-xl border border-accent/30 bg-card/95 p-3 backdrop-blur"
          data-testid="recipe-summary"
        >
          {ps ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted">Pro Portion</span>
                <span className="text-lg font-bold tabular-nums">
                  {fmt(ps.kcal)} kcal
                </span>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
                <span>
                  Protein <b>{fmt(ps.protein, 1)} g</b>
                </span>
                <span>
                  KH <b>{fmt(ps.carbs, 1)} g</b>
                </span>
                <span>
                  Fett <b>{fmt(ps.fat, 1)} g</b>
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {ingredients.length} Zutaten · {fmt(n!.totalGrams)} g roh
                {r.cookedGrams ? ` · ${fmt(r.cookedGrams)} g fertig` : ""} ·{" "}
                {fmt(n!.dishGrams / (r.servings ?? 1))} g je Portion
              </div>
              {n!.unknownIngredients.length > 0 && (
                <div className="text-[11px] text-warn">
                  Unvollständige Werte: {n!.unknownIngredients.join(", ")}
                </div>
              )}
            </>
          ) : (
            <span className="text-sm text-muted">
              Füge Zutaten hinzu – die Nährwerte pro Portion stehen dann hier.
            </span>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted">Zutaten</div>
          <ul className="divide-y rounded-xl border">
            {ingredients.map((i, idx) => (
              <IngredientRow
                key={idx}
                i={i}
                onChange={(next) => setIng(idx, next)}
                onRemove={() =>
                  setR((s) => ({
                    ...s,
                    ingredients: s.ingredients!.filter((_, j) => j !== idx),
                  }))
                }
              />
            ))}
            {!ingredients.length && (
              <li className="p-3 text-sm text-muted">
                Noch keine Zutaten – such unten nach Lebensmitteln.
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
            <Input
              ref={searchRef}
              aria-label="Zutat suchen"
              className="pl-10"
              placeholder="Zutat suchen, z. B. Mehl, Ei, Milch …"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {q.trim() ? (
            <div
              className="rounded-xl border p-2"
              data-testid="ingredient-results"
            >
              <SearchResults q={q} onPick={addIng} />
            </div>
          ) : (
            recent.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] text-muted">
                  Schnell hinzufügen
                </div>
                <div
                  className="flex flex-wrap gap-1.5"
                  data-testid="recent-foods"
                >
                  {recent.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addIng(BASIC_BY_ID.get(f.id) ?? f)}
                      className="rounded-full bg-fg/[0.06] px-3 py-1 text-xs"
                    >
                      + {f.name.replace(/ \(.*\)$/, "")}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        <Field
          label="Gewicht fertig (optional, g)"
          hint="Topf nach dem Kochen wiegen (ohne Topf) – dann kannst du auch in Gramm buchen und Wasserverlust oder Aufnahme wird berücksichtigt."
        >
          {(id) => (
            <NumberInput
              id={id}
              inputMode="numeric"
              value={r.cookedGrams}
              placeholder={
                n ? `Summe der Zutaten: ${fmt(n.totalGrams)}` : undefined
              }
              onValue={(v) => setR((s) => ({ ...s, cookedGrams: v }))}
            />
          )}
        </Field>

        {n && (
          <details
            open={showAll}
            onToggle={(e) => setShowAll((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer text-sm font-medium">
              Alle Nährwerte
            </summary>
            <div
              className="mt-2 grid gap-3 sm:grid-cols-2"
              data-testid="recipe-nutrition"
            >
              <NutrientTable
                n={n.total}
                title={`Gesamt (${fmt(n.totalGrams)} g)`}
              />
              <NutrientTable n={n.perServing} title="Pro Portion" />
            </div>
          </details>
        )}
        <Field label="Zubereitung">
          {(id) => (
            <Textarea
              id={id}
              value={r.instructions ?? ""}
              onChange={(e) =>
                setR((s) => ({ ...s, instructions: e.target.value }))
              }
            />
          )}
        </Field>
        <Field label="Bild (optional)">
          {(id) => (
            <input
              id={id}
              type="file"
              accept="image/*"
              onChange={(e) => onImage(e.target.files?.[0])}
              className="text-sm"
            />
          )}
        </Field>
        <p className="text-xs text-muted">
          Änderungen am Rezept wirken nur auf künftige Buchungen – bereits
          gebuchte Mahlzeiten behalten ihre Nährwerte.
        </p>
      </div>
    </Sheet>
  );
}

/** Küchen-Rüstung: Fortschritt zum nächsten Set aus eigenen Rezepten */
function KitchenProgress() {
  const game = useGame();
  if (!game) return null;
  const c = game.cooking;
  const next = nextCookSet(c);
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] p-3 text-xs"
      data-testid="kitchen-progress"
    >
      <span className="text-xl" aria-hidden>
        🍳
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">
          Küchen-Rüstung {next ? next.earned : COOK_SETS.length}/
          {COOK_SETS.length}
        </div>
        {next ? (
          <div className="text-muted">
            Nächstes Set „{next.set.name}“: {Math.min(c.recipes, next.recipes)}/
            {next.recipes} Rezepte angelegt
            {next.uses
              ? ` · ${Math.min(c.uses, next.uses)}/${next.uses}× eigenes Rezept gegessen (max. ${MAX_RECIPE_USES_PER_DAY} pro Tag)`
              : ""}
          </div>
        ) : (
          <div className="text-muted">
            Alle Küchen-Sets verdient – Meisterkoch!
          </div>
        )}
      </div>
    </div>
  );
}
