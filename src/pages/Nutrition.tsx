import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus, Trash2, Droplets, Save, Heart, Swords, Check } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Field, Input, NumberInput, Progress, Select, Sheet, Tabs, fmt } from '@/components/ui';
import { PageHeader } from '@/components/Layout';
import { useDaySummary, useMeals, useSettings } from '@/hooks/data';
import { addDays, formatLongDate, today } from '@/domain/dates';
import { useUi, toast, confirmDialog } from '@/stores/ui';
import { AddFoodSheet, NutrientTable, SourceBadge } from './nutrition/AddFood';
import type { DiaryEntry, MealId } from '@/domain/types';
import { sumEntries, scaleNutrients, effectiveSplit, mealTargets, type MealTarget } from '@/domain/nutrition';
import { addWater, copyDay, copyEntry, copyMeal, deleteEntry, saveMealFromEntries, toggleFavorite, undoLastWater, updateEntryAmount } from '@/data/nutritionRepo';
import { firstError } from '@/domain/schemas';
import { Recipes } from './nutrition/Recipes';
import { MealPlanning } from './nutrition/MealPlanning';
import { FoodsManager } from './nutrition/FoodsManager';
import { DAY_TYPE_LABELS } from '@/domain/coach';
import { db } from '@/data/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { requestBattle } from '@/stores/battle';

type Tab = 'diary' | 'recipes' | 'plan' | 'foods';

export function Nutrition() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'diary');
  return (
    <div className="space-y-4">
      <PageHeader title="Ernährung" />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setParams({ tab: t }, { replace: true });
        }}
        items={[
          { value: 'diary', label: 'Tagebuch' },
          { value: 'recipes', label: 'Rezepte' },
          { value: 'plan', label: 'Planung' },
          { value: 'foods', label: 'Lebensmittel' },
        ]}
      />
      {tab === 'diary' && <Diary />}
      {tab === 'recipes' && <Recipes />}
      {tab === 'plan' && <MealPlanning />}
      {tab === 'foods' && <FoodsManager />}
    </div>
  );
}

function Diary() {
  const { date, setDate } = useUi();
  const [params, setParams] = useSearchParams();
  const s = useDaySummary(date);
  const meals = useMeals();
  const settings = useSettings();
  const [addMeal, setAddMeal] = useState<MealId | null>(null);
  const [edit, setEdit] = useState<DiaryEntry | null>(null);
  const [copyOpen, setCopyOpen] = useState<{ meal?: MealId } | null>(null);
  const [mealMenu, setMealMenu] = useState<MealId | null>(null);

  useEffect(() => {
    if (params.get('add')) {
      const h = new Date().getHours();
      setAddMeal(h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack');
      setParams({}, { replace: true });
    }
    if (params.get('copy')) {
      setCopyOpen({});
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const byMeal = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>();
    for (const e of s?.entries ?? []) m.set(e.meal, [...(m.get(e.meal) ?? []), e]);
    return m;
  }, [s?.entries]);
  const unknownMeals = [...byMeal.keys()].filter((k) => !meals.some((m) => m.id === k));
  const allMeals = [...meals, ...unknownMeals.map((id) => ({ id, label: id }))];
  const dayTotal = s?.goal ? s.goal.calorieTarget + s.credit.creditedKcal : null;
  const targets = useMemo(() => {
    if (dayTotal == null) return new Map<string, MealTarget>();
    const eaten = new Map<string, number>();
    for (const [id, list] of byMeal) if (list.length) eaten.set(id, sumEntries(list).totals.kcal);
    const shares = effectiveSplit(meals.map((m) => m.id), settings.mealSplit);
    return new Map(mealTargets(dayTotal, shares, eaten).map((t) => [t.id, t]));
  }, [dayTotal, byMeal, meals, settings.mealSplit]);

  const closed = useLiveQuery(() => db.settings.get(CLOSED_KEY).then((r) => (r?.value as ClosedMeals | undefined) ?? {}), []) ?? {};

  if (!s) return null;
  const g = s.goal;
  const t = s.sum.totals;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Vorheriger Tag" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button className="min-w-0 flex-1 text-center" onClick={() => setDate(today())}>
          <div className="truncate font-semibold" data-testid="diary-date">
            {formatLongDate(date)}
          </div>
          {date !== today() && <div className="text-xs text-accent">zu heute</div>}
        </button>
        <Button variant="ghost" size="icon" aria-label="Nächster Tag" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted">Kalorien</div>
            <div className="text-xl font-bold tabular-nums" data-testid="day-kcal">
              {fmt(t.kcal)}
            </div>
            <div className="text-xs text-muted">
              Ziel {g ? fmt(g.calorieTarget) : '–'} {s.credit.creditedKcal > 0 && `+ ${fmt(s.credit.creditedKcal)} Training (geschätzt)`}
            </div>
            {s.budget && (
              <div className="text-xs font-medium" data-testid="day-remaining">
                {s.budget.remaining >= 0 ? `${fmt(s.budget.remaining)} übrig` : `${fmt(-s.budget.remaining)} drüber`}
              </div>
            )}
          </div>
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <div key={k}>
              <div className="text-xs text-muted">{{ protein: 'Protein', carbs: 'Kohlenhydrate', fat: 'Fett' }[k]}</div>
              <div className="text-xl font-bold tabular-nums" data-testid={`day-${k}`}>
                {fmt(t[k], 1)} <span className="text-xs font-normal text-muted">g</span>
              </div>
              {g && <Progress value={t[k]} max={{ protein: g.proteinG, carbs: g.carbsG, fat: g.fatG }[k]} color={k} label={k} />}
              {g && <div className="mt-0.5 text-xs text-muted">von {{ protein: g.proteinG, carbs: g.carbsG, fat: g.fatG }[k]} g</div>}
            </div>
          ))}
        </div>
        {(t.fiber > 0 || t.sugar > 0 || t.salt > 0) && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            <span>Ballaststoffe {fmt(t.fiber, 1)} g</span>
            <span>Zucker {fmt(t.sugar, 1)} g</span>
            <span>Salz {fmt(t.salt, 2)} g</span>
          </div>
        )}
        {[...targets.values()].some((x) => x.adjusted != null) && (
          <p className="mt-2 text-xs text-muted" data-testid="meal-adjust-hint">
            Die Ziele der noch offenen Mahlzeiten sind an das bereits Gegessene angepasst, damit der Tag aufgeht.
          </p>
        )}
        {s.sum.unknown.kcal + s.sum.unknown.protein > 0 && <p className="mt-2 text-xs text-warn">Einige Einträge haben unbekannte Nährwerte – Summen sind Mindestwerte.</p>}
      </Card>

      {allMeals.map((m) => {
        const list = byMeal.get(m.id) ?? [];
        const ms = sumEntries(list).totals;
        const tg = targets.get(m.id);
        return (
          <Card key={m.id} data-testid={`meal-${m.id}`}>
            <CardTitle
              action={
                <div className="flex items-center gap-1">
                  <span className="text-sm tabular-nums text-muted" data-testid={`meal-kcal-${m.id}`}>
                    {fmt(ms.kcal)}
                    {tg && tg.target > 0 && <> / {fmt(tg.target)}</>} kcal
                  </span>
                  <Button variant="ghost" size="icon" aria-label={`Menü ${m.label}`} onClick={() => setMealMenu(m.id)}>
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                  <Button variant="secondary" size="icon" aria-label={`${m.label}: Lebensmittel hinzufügen`} onClick={() => setAddMeal(m.id)}>
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              }
            >
              {m.label}
            </CardTitle>
            {tg && (tg.planned > 0 || tg.target > 0) && <MealTargetBar target={tg} eaten={ms.kcal} label={m.label} />}
            {list.length ? (
              <ul className="divide-y">
                {list.map((e) => (
                  <li key={e.id}>
                    <button className="flex w-full items-center gap-3 py-2 text-left" onClick={() => setEdit(e)}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.name}</div>
                        <div className="text-xs text-muted">
                          {e.unit === 'serving' ? `${fmt(e.amount, 2)} × ${e.servingLabel ?? 'Portion'}` : `${fmt(e.amount, 1)} ${e.unit}`} · P {fmt(e.nutrients.protein, 1, '?')} · KH {fmt(e.nutrients.carbs, 1, '?')} · F {fmt(e.nutrients.fat, 1, '?')}
                        </div>
                      </div>
                      <div className="text-sm font-medium tabular-nums">{e.nutrients.kcal == null ? '?' : fmt(e.nutrients.kcal)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Noch nichts eingetragen.</p>
            )}
            {list.length > 0 && date === today() && (
              <div className="mt-2 flex justify-end">
                {closed[date]?.includes(m.id) ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-gold" data-testid={`meal-closed-${m.id}`}>
                    <Check className="h-3.5 w-3.5" /> Abgeschlossen
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    data-testid={`meal-close-${m.id}`}
                    onClick={() =>
                      void closeMeal(date, m.id).then(() =>
                        requestBattle({
                          reason: 'meal',
                          title: `${m.label} abgeschlossen`,
                          lines: [
                            `${fmt(ms.kcal)} kcal`,
                            `Protein ${fmt(ms.protein)} g`,
                            ...(tg && tg.target > 0 ? [tg.hit ? 'Punktlandung ✓' : `Ziel ${fmt(tg.target)} kcal`] : []),
                          ],
                        }),
                      )
                    }
                  >
                    <Swords className="h-4 w-4" /> Mahlzeit abschließen
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <WaterCard date={date} goal={settings.waterGoalMl} total={s.waterMl} />
      {s.training.length > 0 && (
        <Card>
          <CardTitle>Training heute</CardTitle>
          <ul className="space-y-1 text-sm">
            {s.training.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.kind === 'workout' ? i.label : DAY_TYPE_LABELS.endurance + ': ' + i.label}</span>
                <span className="tabular-nums text-muted">
                  {fmt(i.kcal)} kcal {i.estimated ? '(geschätzt)' : '(manuell)'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Angerechnet: {fmt(s.credit.creditedKcal)} kcal ({s.credit.alreadyIncludedKcal > 0 ? `${fmt(s.credit.alreadyIncludedKcal)} kcal bereits im Aktivitätsfaktor, ` : ''}Quote laut Einstellungen)
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setCopyOpen({})}>
          <Copy className="h-4 w-4" /> Tag/Mahlzeit kopieren
        </Button>
      </div>

      <AddFoodSheet open={addMeal != null} onClose={() => setAddMeal(null)} date={date} meal={addMeal ?? 'breakfast'} />
      <EntrySheet entry={edit} onClose={() => setEdit(null)} />
      <CopySheet open={copyOpen != null} initialMeal={copyOpen?.meal} onClose={() => setCopyOpen(null)} date={date} />
      <MealMenu
        meal={mealMenu}
        entries={mealMenu ? byMeal.get(mealMenu) ?? [] : []}
        onClose={() => setMealMenu(null)}
        onCopy={() => {
          const m = mealMenu ?? undefined;
          setMealMenu(null);
          setCopyOpen({ meal: m });
        }}
      />
    </div>
  );
}

const CLOSED_KEY = 'closedMeals';
type ClosedMeals = Record<string, string[]>;

/** Merkt sich abgeschlossene Mahlzeiten (nur die letzten 14 Tage). */
async function closeMeal(date: string, meal: string) {
  const cur = ((await db.settings.get(CLOSED_KEY))?.value as ClosedMeals | undefined) ?? {};
  const next: ClosedMeals = { ...cur, [date]: [...new Set([...(cur[date] ?? []), meal])] };
  const keep = Object.keys(next).sort().slice(-14);
  await db.settings.put({ key: CLOSED_KEY, value: Object.fromEntries(keep.map((k) => [k, next[k]!])) });
}

function MealTargetBar({ target, eaten, label }: { target: MealTarget; eaten: number; label: string }) {
  const goal = target.target;
  const over = target.eaten != null && eaten > goal;
  return (
    <div className="mb-2" data-testid={`meal-target-${target.id}`}>
      <Progress value={eaten} max={goal || 1} color={over && !target.hit ? 'danger' : 'accent'} label={`Mahlzeitziel ${label}`} />
      <div className="mt-0.5 flex justify-between gap-2 text-[11px] text-muted">
        <span>
          Ziel {fmt(goal)} kcal
          {target.adjusted != null && <> · geplant {fmt(target.planned)}</>}
        </span>
        {target.eaten != null &&
          (target.hit ? (
            <span className="font-semibold text-gold" data-testid={`meal-hit-${target.id}`}>
              Punktlandung ✓
            </span>
          ) : (
            <span className={over ? 'text-danger' : ''}>{over ? `${fmt(eaten - goal)} drüber` : `${fmt(goal - eaten)} übrig`}</span>
          ))}
      </div>
    </div>
  );
}

function WaterCard({ date, goal, total }: { date: string; goal: number; total: number }) {
  return (
    <Card>
      <CardTitle>
        <span className="flex items-center gap-1">
          <Droplets className="h-4 w-4 text-protein" /> Trinktagebuch
        </span>
      </CardTitle>
      <div className="mb-2 flex justify-between text-sm">
        <span className="tabular-nums" data-testid="water-total">
          {fmt(total)} ml
        </span>
        <span className="text-muted">Ziel {fmt(goal)} ml</span>
      </div>
      <Progress value={total} max={goal} color="protein" label="Wasser" />
      <div className="mt-3 flex flex-wrap gap-2">
        {[150, 250, 330, 500].map((ml) => (
          <Button key={ml} size="sm" variant="secondary" onClick={() => addWater(date, ml)}>
            +{ml} ml
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => undoLastWater(date)} disabled={total === 0}>
          Rückgängig
        </Button>
      </div>
    </Card>
  );
}

function EntrySheet({ entry, onClose }: { entry: DiaryEntry | null; onClose: () => void }) {
  const meals = useMeals();
  const [amount, setAmount] = useState<number | undefined>();
  const [meal, setMeal] = useState<MealId>('breakfast');
  const [copyDate, setCopyDate] = useState(today());
  const [err, setErr] = useState<string>();
  const food = useLiveQuery(() => (entry?.foodId ? db.foods.get(entry.foodId) : undefined), [entry?.foodId]);
  useEffect(() => {
    if (entry) {
      setAmount(entry.amount);
      setMeal(entry.meal);
      setErr(undefined);
    }
  }, [entry]);
  if (!entry) return null;
  let preview = entry.nutrients;
  try {
    if (amount && amount > 0 && entry.source !== 'quick') preview = scaleNutrients(entry.per100, entry.unit === 'serving' ? (entry.grams / entry.amount) * amount : amount);
  } catch {
    /* Vorschau unverändert */
  }
  const save = async () => {
    try {
      if (entry.source === 'quick') await db.diary.update(entry.id, { meal });
      else await updateEntryAmount(entry.id, amount ?? 0, entry.unit, undefined, meal);
      toast('Eintrag aktualisiert', 'success');
      onClose();
    } catch (e) {
      setErr(firstError(e));
    }
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={entry.name}
      footer={
        <>
          <Button
            variant="danger"
            aria-label="Eintrag löschen"
            onClick={async () => {
              await deleteEntry(entry.id);
              toast('Eintrag gelöscht');
              onClose();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button className="flex-1" onClick={save}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <SourceBadge source={entry.source} /> {entry.brand}
          {entry.recipeId && <Badge>Nährwerte zum Buchungszeitpunkt</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {entry.source !== 'quick' && (
            <Field label={entry.unit === 'serving' ? `Menge (× ${entry.servingLabel ?? 'Portion'})` : `Menge (${entry.unit})`} error={err}>
              {(id) => <NumberInput id={id} value={amount} onValue={setAmount} />}
            </Field>
          )}
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
        </div>
        <NutrientTable n={preview} />
        <div className="flex items-end gap-2 border-t pt-3">
          <Field label="Kopieren auf Datum" className="flex-1">
            {(id) => <Input id={id} type="date" value={copyDate} onChange={(e) => setCopyDate(e.target.value)} />}
          </Field>
          <Button
            variant="outline"
            onClick={async () => {
              await copyEntry(entry.id, copyDate, meal);
              toast('Eintrag kopiert', 'success');
            }}
          >
            <Copy className="h-4 w-4" /> Kopieren
          </Button>
        </div>
        {food && (
          <Button variant="ghost" onClick={() => toggleFavorite(food.id)}>
            <Heart className={food.favorite ? 'h-4 w-4 fill-current text-danger' : 'h-4 w-4'} /> {food.favorite ? 'Favorit entfernen' : 'Als Favorit merken'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function CopySheet({ open, onClose, date, initialMeal }: { open: boolean; onClose: () => void; date: string; initialMeal?: MealId }) {
  const meals = useMeals();
  const [mode, setMode] = useState<'from' | 'to'>('from');
  const [other, setOther] = useState(addDays(date, -1));
  const [meal, setMeal] = useState<string>('all');
  useEffect(() => {
    if (open) {
      setMeal(initialMeal ?? 'all');
      setMode(initialMeal ? 'to' : 'from');
      setOther(initialMeal ? addDays(date, 1) : addDays(date, -1));
    }
  }, [open, initialMeal, date]);
  const run = async () => {
    const [from, to] = mode === 'from' ? [other, date] : [date, other];
    if (from === to) return toast('Quelle und Ziel sind identisch.', 'error');
    const n = meal === 'all' ? await copyDay(from, to) : await copyMeal(from, meal, to);
    toast(n ? `${n} Einträge kopiert` : 'Keine Einträge zum Kopieren gefunden', n ? 'success' : 'info');
    if (n) onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Kopieren" footer={<Button className="flex-1" onClick={run}>Kopieren</Button>}>
      <div className="space-y-3">
        <Tabs value={mode} onChange={setMode} items={[{ value: 'from', label: 'Von anderem Tag hierher' }, { value: 'to', label: 'Von hier auf anderen Tag' }]} />
        <Field label={mode === 'from' ? 'Quelltag' : 'Zieltag'}>{(id) => <Input id={id} type="date" value={other} onChange={(e) => setOther(e.target.value)} />}</Field>
        <Field label="Umfang">
          {(id) => (
            <Select id={id} value={meal} onChange={(e) => setMeal(e.target.value)}>
              <option value="all">Ganzer Tag</option>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  Nur {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-xs text-muted">Kopien sind eigenständige Einträge – die Originale bleiben unverändert.</p>
      </div>
    </Sheet>
  );
}

function MealMenu({ meal, entries, onClose, onCopy }: { meal: MealId | null; entries: DiaryEntry[]; onClose: () => void; onCopy: () => void }) {
  const [name, setName] = useState('');
  const meals = useMeals();
  if (!meal) return null;
  const label = meals.find((m) => m.id === meal)?.label ?? meal;
  return (
    <Sheet open onClose={onClose} title={label}>
      <div className="space-y-3">
        <Button variant="outline" className="w-full" onClick={onCopy}>
          <Copy className="h-4 w-4" /> Mahlzeit auf anderen Tag kopieren
        </Button>
        <div className="flex items-end gap-2">
          <Field label="Als gespeicherte Mahlzeit sichern" className="flex-1">
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={`z. B. Mein ${label}`} />}
          </Field>
          <Button
            onClick={async () => {
              try {
                await saveMealFromEntries(name || label, entries);
                toast('Mahlzeit gespeichert', 'success');
                onClose();
              } catch (e) {
                toast(firstError(e), 'error');
              }
            }}
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            className="w-full text-danger"
            onClick={async () => {
              if (await confirmDialog({ title: 'Mahlzeit leeren?', text: `${entries.length} Einträge werden gelöscht.`, danger: true, confirmLabel: 'Löschen' })) {
                await db.diary.bulkDelete(entries.map((e) => e.id));
                onClose();
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Alle Einträge löschen
          </Button>
        )}
      </div>
    </Sheet>
  );
}

